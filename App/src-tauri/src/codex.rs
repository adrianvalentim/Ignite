use serde::Serialize;
use std::{env, ffi::OsString, path::PathBuf, process::Stdio, sync::Arc, time::Duration};
use tauri::{ipc::Channel, State};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, Command},
    sync::Mutex,
    time::sleep,
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexProcessEvent {
    stream: &'static str,
    line: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexStartResult {
    executable: String,
}

struct CodexProcess {
    stdin: ChildStdin,
    child: Arc<Mutex<Child>>,
}

async fn stop_process(process: CodexProcess) -> Result<(), String> {
    drop(process.stdin);
    let mut child = process.child.lock().await;
    let status = child
        .try_wait()
        .map_err(|error| format!("Could not inspect Codex before stopping it: {error}"))?;
    if status.is_some() {
        return Ok(());
    }

    if let Err(error) = child.start_kill() {
        let exited = child
            .try_wait()
            .map_err(|inspect_error| {
                format!("Could not inspect Codex after a stop failure: {inspect_error}")
            })?
            .is_some();
        if exited {
            return Ok(());
        }
        return Err(format!("Could not stop Codex: {error}"));
    }
    child
        .wait()
        .await
        .map_err(|error| format!("Could not finish stopping Codex: {error}"))?;
    Ok(())
}

#[derive(Clone, Default)]
pub struct CodexState {
    process: Arc<Mutex<Option<CodexProcess>>>,
}

fn executable_candidates() -> Vec<OsString> {
    let mut candidates = Vec::new();

    if let Some(configured) = env::var_os("CODEX_EXECUTABLE") {
        if !configured.is_empty() {
            candidates.push(configured);
        }
    }

    #[cfg(target_os = "macos")]
    candidates.push("/Applications/ChatGPT.app/Contents/Resources/codex".into());

    #[cfg(unix)]
    {
        candidates.push("/opt/homebrew/bin/codex".into());
        candidates.push("/usr/local/bin/codex".into());
    }

    candidates.push("codex".into());
    candidates
}

fn display_executable(executable: &OsString) -> String {
    PathBuf::from(executable).to_string_lossy().into_owned()
}

fn send_event(channel: &Channel<CodexProcessEvent>, stream: &'static str, line: String) {
    let _ = channel.send(CodexProcessEvent { stream, line });
}

#[tauri::command]
pub async fn codex_start(
    state: State<'_, CodexState>,
    on_event: Channel<CodexProcessEvent>,
) -> Result<CodexStartResult, String> {
    let mut process_slot = state.process.lock().await;
    if let Some(existing) = process_slot.take() {
        stop_process(existing).await?;
    }

    let mut failures = Vec::new();
    for executable in executable_candidates() {
        let executable_label = display_executable(&executable);
        let spawn_result = Command::new(&executable)
            .arg("app-server")
            .arg("--stdio")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn();

        let mut child = match spawn_result {
            Ok(child) => child,
            Err(error) => {
                failures.push(format!("{executable_label}: {error}"));
                continue;
            }
        };

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Codex started without a writable stdin pipe".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Codex started without a readable stdout pipe".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Codex started without a readable stderr pipe".to_string())?;

        let stdout_channel = on_event.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => send_event(&stdout_channel, "stdout", line),
                    Ok(None) => break,
                    Err(error) => {
                        send_event(
                            &stdout_channel,
                            "bridgeError",
                            format!("Could not read Codex stdout: {error}"),
                        );
                        break;
                    }
                }
            }
        });

        let stderr_channel = on_event.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => send_event(&stderr_channel, "stderr", line),
                    Ok(None) => break,
                    Err(error) => {
                        send_event(
                            &stderr_channel,
                            "bridgeError",
                            format!("Could not read Codex stderr: {error}"),
                        );
                        break;
                    }
                }
            }
        });

        let child = Arc::new(Mutex::new(child));
        let monitored_child = Arc::clone(&child);
        let monitored_process = Arc::clone(&state.process);
        let monitor_channel = on_event.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                let status = monitored_child.lock().await.try_wait();
                match status {
                    Ok(Some(status)) => {
                        send_event(
                            &monitor_channel,
                            "exit",
                            status.code().map_or_else(
                                || "Codex exited".to_string(),
                                |code| format!("Codex exited with status {code}"),
                            ),
                        );
                        let mut slot = monitored_process.lock().await;
                        let is_current = slot
                            .as_ref()
                            .is_some_and(|process| Arc::ptr_eq(&process.child, &monitored_child));
                        if is_current {
                            slot.take();
                        }
                        break;
                    }
                    Ok(None) => sleep(Duration::from_millis(500)).await,
                    Err(error) => {
                        send_event(
                            &monitor_channel,
                            "bridgeError",
                            format!("Could not monitor Codex: {error}"),
                        );
                        let mut slot = monitored_process.lock().await;
                        let is_current = slot
                            .as_ref()
                            .is_some_and(|process| Arc::ptr_eq(&process.child, &monitored_child));
                        if is_current {
                            slot.take();
                        }
                        break;
                    }
                }
            }
        });

        *process_slot = Some(CodexProcess { stdin, child });
        return Ok(CodexStartResult {
            executable: executable_label,
        });
    }

    Err(format!(
        "Could not start the installed Codex CLI. Install Codex, sign in with `codex login`, or set CODEX_EXECUTABLE. Attempts: {}",
        failures.join("; ")
    ))
}

#[tauri::command]
pub async fn codex_send(state: State<'_, CodexState>, line: String) -> Result<(), String> {
    if line.contains('\n') || line.contains('\r') {
        return Err("Codex protocol messages must fit on one JSON line".into());
    }

    let mut process_slot = state.process.lock().await;
    let process = process_slot
        .as_mut()
        .ok_or_else(|| "The Codex bridge is not running".to_string())?;
    process
        .stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|error| format!("Could not write to Codex: {error}"))?;
    process
        .stdin
        .write_all(b"\n")
        .await
        .map_err(|error| format!("Could not finish the Codex message: {error}"))?;
    process
        .stdin
        .flush()
        .await
        .map_err(|error| format!("Could not flush the Codex message: {error}"))
}

#[tauri::command]
pub async fn codex_stop(state: State<'_, CodexState>) -> Result<(), String> {
    let process = state.process.lock().await.take();
    let Some(process) = process else {
        return Ok(());
    };
    stop_process(process).await
}
