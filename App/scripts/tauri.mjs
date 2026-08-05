import { spawn } from "node:child_process";
import { readdirSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/tauri.mjs <dev|build|check|info>");
  process.exit(2);
}

// The repository may live on a filesystem that stores macOS metadata as
// AppleDouble files. Tauri scans generated permission directories, so keep
// Cargo's disposable cache on the native temporary filesystem.
const environment = {
  ...process.env,
  CARGO_TARGET_DIR:
    process.env.CARGO_TARGET_DIR ??
    path.join(os.tmpdir(), "effortful-learning-tauri-target"),
};

function removeAppleDoubleFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) removeAppleDoubleFiles(entryPath);
    else if (entry.name.startsWith("._")) unlinkSync(entryPath);
  }
}

if (process.platform === "darwin") {
  removeAppleDoubleFiles(path.join(process.cwd(), "src-tauri", "capabilities"));
}

const executable = command === "check" ? "cargo" : "tauri";
const executableArgs =
  command === "check"
    ? ["check", "--manifest-path", "src-tauri/Cargo.toml", ...args]
    : [command, ...args];

const child = spawn(executable, executableArgs, {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
