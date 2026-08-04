#!/usr/bin/env node

// Read-only context planner. It inspects vault metadata and relevant log text to
// return paths; it never copies learning content into its output or writes files.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_INSTRUCTIONS = path.resolve(
  SCRIPT_DIR,
  "../Learning.example/.system",
);

const PHASE_PROMPT = {
  "setup-book": "prompts/setup-book.md",
  interrogation: "prompts/interrogation.md",
  "reconstruction-review": "prompts/reconstruction-review.md",
  "card-generation": "prompts/card-generation.md",
  recall: "prompts/recall.md",
  feynman: "prompts/feynman.md",
  examination: "prompts/examination.md",
};

const VALID_MODES = new Set([
  "setup-book",
  "independent-reading",
  "interrogation",
  "learner-reconstruction",
  "reconstruction-review",
  "card-generation",
  "card-editing",
  "recall",
  "feynman",
  "examination",
]);

const CLOSE_FILES = [
  "protocols/session-close.md",
  "protocols/vault-contract.md",
  "schemas/session-log.md",
];

const REQUIRED_BUNDLE_FILES = [
  "ROUTER.md",
  ...Object.values(PHASE_PROMPT),
  ...CLOSE_FILES,
];

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function filesIn(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

async function completeInstructionBundle(dir) {
  const checks = await Promise.all(
    REQUIRED_BUNDLE_FILES.map((relative) => exists(path.join(dir, relative))),
  );
  return checks.every(Boolean);
}

function cleanYamlScalar(value) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function frontmatterValue(markdown, key) {
  const block = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return undefined;
  const pattern = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const match = block[1].match(pattern);
  return match ? cleanYamlScalar(match[1]) : undefined;
}

function segmentIdentity(bookMarkdown, requested) {
  const entryPattern =
    /^\s*-\s+id:\s*["']?([^\n"']+)["']?\s*\r?\n\s+slug:\s*["']?([^\n"']+)["']?/gm;
  for (const match of bookMarkdown.matchAll(entryPattern)) {
    const id = match[1].trim();
    const slug = match[2].trim();
    if (requested === id || requested === slug || requested === `${id}-${slug}`) {
      return { id, slug, refs: new Set([id, slug, `${id}-${slug}`]) };
    }
  }
  return { id: undefined, slug: requested, refs: new Set([requested]) };
}

async function findSegmentFile(dir, slug) {
  const files = (await filesIn(dir)).filter((name) => name.endsWith(".md"));
  const exact = files.find((name) => name === `${slug}.md`);
  const numbered = files.find((name) => name.endsWith(`-${slug}.md`));
  return exact ?? numbered;
}

function diagnosticallyImportant(markdown) {
  if (
    /\b(distort|confus|misunderst|faded|fragile|difficulty|gap|distor|mal-entend|esquec|fr[aá]gil|dificuldade|lacuna)\w*/i.test(
      markdown,
    )
  ) {
    return true;
  }
  const block = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return false;
  const values = [...block[1].matchAll(/^\s+[a-z0-9-]+:\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*$/gim)]
    .map((match) => Number(match[1]));
  return values.some((value) => value < 0.5);
}

async function selectLogs(logsDir, refs) {
  const matches = [];
  for (const name of await filesIn(logsDir)) {
    if (!name.endsWith(".md")) continue;
    const abs = path.join(logsDir, name);
    const markdown = await fs.readFile(abs, "utf8");
    const segment = frontmatterValue(markdown, "segment");
    if (!segment || !refs.has(segment)) continue;
    matches.push({ name, important: diagnosticallyImportant(markdown) });
  }
  matches.sort((a, b) => b.name.localeCompare(a.name));
  if (matches.length <= 4) return matches.map((item) => item.name);
  const selected = unique([
    ...matches.filter((item) => item.important).map((item) => item.name),
    ...matches.slice(0, 3).map((item) => item.name),
  ]);
  return selected.slice(0, 8);
}

function relativeToWorkspace(workspace, abs) {
  return path.relative(workspace, abs).split(path.sep).join("/");
}

function displayPath(workspace, abs) {
  const fromWorkspace = path.relative(workspace, abs);
  if (!fromWorkspace.startsWith("..") && !path.isAbsolute(fromWorkspace)) {
    return fromWorkspace.split(path.sep).join("/");
  }
  const fromCwd = path.relative(process.cwd(), abs);
  if (!fromCwd.startsWith("..") && !path.isAbsolute(fromCwd)) {
    return fromCwd.split(path.sep).join("/");
  }
  return abs;
}

export async function buildContextPlan({
  workspace,
  instructions,
  book,
  segment,
  mode,
}) {
  if (!workspace) throw new Error("--workspace is required");
  if (!VALID_MODES.has(mode)) {
    throw new Error(`unsupported --mode: ${mode ?? "(missing)"}`);
  }
  if (mode !== "setup-book" && !book) throw new Error("--book is required");
  if (
    !["setup-book", "examination", "card-editing"].includes(mode) &&
    !segment
  ) {
    throw new Error("--segment is required for this mode");
  }

  const workspaceAbs = path.resolve(workspace);
  if (!(await exists(workspaceAbs))) {
    throw new Error(`workspace not found: ${workspaceAbs}`);
  }

  const workspaceSystem = path.join(workspaceAbs, ".system");
  const instructionRoot = instructions
    ? path.resolve(instructions)
    : (await completeInstructionBundle(workspaceSystem))
      ? workspaceSystem
      : BUNDLED_INSTRUCTIONS;
  if (!(await completeInstructionBundle(instructionRoot))) {
    throw new Error(`instruction bundle not found: ${instructionRoot}`);
  }

  const instructionFile = async (relative) => {
    const abs = path.join(instructionRoot, relative);
    if (!(await exists(abs))) {
      throw new Error(`instruction file not found: ${abs}`);
    }
    return displayPath(workspaceAbs, abs);
  };

  const workspaceContext = path.join(workspaceSystem, "CONTEXT.md");
  const contextFile = (await exists(workspaceContext))
    ? workspaceContext
    : path.join(instructionRoot, "CONTEXT.md");
  if (!(await exists(contextFile))) {
    throw new Error(`workspace context not found: ${contextFile}`);
  }

  const loadNow = [
    displayPath(workspaceAbs, contextFile),
    await instructionFile("ROUTER.md"),
  ];
  const learnerReads = [];
  const loadAfterRetrieval = [];
  const loadWhenNeeded = [];
  const loadAtClose = [];
  const warnings = [];

  if (instructionRoot !== workspaceSystem) {
    warnings.push(
      `using external instruction bundle: ${displayPath(workspaceAbs, instructionRoot)}`,
    );
  }

  const prompt = PHASE_PROMPT[mode];
  if (prompt) loadNow.push(await instructionFile(prompt));

  const closeFiles = await Promise.all(CLOSE_FILES.map(instructionFile));
  const vaultContract = await instructionFile("protocols/vault-contract.md");

  if (mode === "setup-book") {
    loadWhenNeeded.push("cross-book/connections.md");
    loadAtClose.push(vaultContract);
    return {
      workspace: workspaceAbs,
      instructions: instructionRoot,
      mode,
      book,
      segment,
      load_now: unique(loadNow),
      learner_reads: learnerReads,
      load_after_retrieval: loadAfterRetrieval,
      load_when_needed: loadWhenNeeded,
      load_at_close: unique(loadAtClose),
      do_not_load: ["App/", "unrelated phase prompts", "private data from another workspace"],
      warnings,
    };
  }

  const bookDir = path.join(workspaceAbs, "books", book);
  const bookFile = path.join(bookDir, "book.md");
  if (!(await exists(bookFile))) throw new Error(`book not found: ${book}`);
  loadNow.push(relativeToWorkspace(workspaceAbs, bookFile));

  let identity = segment
    ? { id: undefined, slug: segment, refs: new Set([segment]) }
    : undefined;
  if (segment) {
    identity = segmentIdentity(await fs.readFile(bookFile, "utf8"), segment);
  }

  const sourceDir = path.join(bookDir, "source");
  const sourceName = identity
    ? await findSegmentFile(sourceDir, identity.slug)
    : undefined;
  const sourceRel = sourceName
    ? relativeToWorkspace(workspaceAbs, path.join(sourceDir, sourceName))
    : undefined;

  const selectedLogs = identity
    ? await selectLogs(path.join(bookDir, "logs"), identity.refs)
    : [];
  const logPaths = selectedLogs.map((name) =>
    relativeToWorkspace(workspaceAbs, path.join(bookDir, "logs", name)),
  );

  if (segment && !sourceRel && !["card-editing"].includes(mode)) {
    warnings.push(`source file not found for segment: ${identity.slug}`);
  }

  switch (mode) {
    case "independent-reading":
      if (sourceRel) learnerReads.push(sourceRel);
      loadAtClose.push(vaultContract);
      break;
    case "interrogation":
    case "feynman":
      if (sourceRel) loadNow.push(sourceRel);
      loadNow.push(...logPaths);
      loadWhenNeeded.push("cross-book/connections.md", "earlier source segments");
      loadAtClose.push(...closeFiles);
      break;
    case "learner-reconstruction":
      loadAtClose.push(vaultContract);
      break;
    case "reconstruction-review": {
      const reconstructionDir = path.join(bookDir, "reconstructions");
      const reconstructionName = await findSegmentFile(
        reconstructionDir,
        identity.slug,
      );
      if (reconstructionName) {
        loadNow.push(
          relativeToWorkspace(
            workspaceAbs,
            path.join(reconstructionDir, reconstructionName),
          ),
        );
      } else {
        warnings.push(`reconstruction not found for segment: ${identity.slug}`);
      }
      if (sourceRel) loadNow.push(`${sourceRel} (after reconstruction is fixed)`);
      loadNow.push(...logPaths);
      loadAtClose.push(...closeFiles);
      break;
    }
    case "card-generation": {
      if (sourceRel) loadNow.push(sourceRel);
      loadNow.push(...logPaths);
      const reconstructionDir = path.join(bookDir, "reconstructions");
      const reconstructionName = await findSegmentFile(
        reconstructionDir,
        identity.slug,
      );
      if (reconstructionName) {
        loadNow.push(
          relativeToWorkspace(
            workspaceAbs,
            path.join(reconstructionDir, reconstructionName),
          ),
        );
      }
      loadAtClose.push(...closeFiles);
      break;
    }
    case "card-editing": {
      const cardsDir = path.join(bookDir, "cards");
      const cards = (await filesIn(cardsDir)).filter((name) =>
        name.includes(segment ?? ""),
      );
      loadNow.push(
        ...cards.map((name) =>
          relativeToWorkspace(workspaceAbs, path.join(cardsDir, name)),
        ),
      );
      loadAtClose.push(vaultContract);
      break;
    }
    case "recall":
      loadNow.push(...logPaths);
      if (sourceRel) loadAfterRetrieval.push(sourceRel);
      loadAtClose.push(...closeFiles);
      break;
    case "examination":
      loadNow.push(
        `books/${book}/logs/ (inventory first)`,
        `books/${book}/reconstructions/ (selective)`,
        `books/${book}/cards/ (selective)`,
        "cross-book/connections.md",
      );
      loadWhenNeeded.push(`books/${book}/source/ (targeted passages)`);
      loadAtClose.push(...closeFiles);
      break;
  }

  return {
    workspace: workspaceAbs,
    instructions: instructionRoot,
    mode,
    book,
    segment: identity?.slug ?? segment,
    load_now: unique(loadNow),
    learner_reads: unique(learnerReads),
    load_after_retrieval: unique(loadAfterRetrieval),
    load_when_needed: unique(loadWhenNeeded),
    load_at_close: unique(loadAtClose),
    do_not_load: ["App/", "unrelated phase prompts", "private data from another workspace"],
    warnings,
  };
}

export function formatContextPlan(plan) {
  const lines = [
    "# Learning Context Plan",
    "",
    `Workspace: ${plan.workspace}`,
    `Instructions: ${plan.instructions}`,
    `Mode: ${plan.mode}`,
  ];
  if (plan.book) lines.push(`Book: ${plan.book}`);
  if (plan.segment) lines.push(`Segment: ${plan.segment}`);

  const section = (title, items) => {
    lines.push("", `## ${title}`, "");
    if (items.length === 0) lines.push("- None");
    else lines.push(...items.map((item) => `- ${item}`));
  };

  section("Load now", plan.load_now);
  section("Learner reads without agent ingestion", plan.learner_reads);
  section("Load after unaided retrieval", plan.load_after_retrieval);
  section("Load only when needed", plan.load_when_needed);
  section("Load at close", plan.load_at_close);
  section("Do not load", plan.do_not_load);
  if (plan.warnings.length > 0) section("Warnings", plan.warnings);
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const options = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
    } else if (
      ["--workspace", "--instructions", "--book", "--segment", "--mode"].includes(
        arg,
      )
    ) {
      options[arg.slice(2)] = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function usage() {
  return `Usage:
  node scripts/learning-context.mjs --workspace PATH [--instructions PATH] --book SLUG --segment SLUG --mode MODE [--json]

Modes:
  ${[...VALID_MODES].join("\n  ")}
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const plan = await buildContextPlan(options);
  process.stdout.write(
    options.json ? `${JSON.stringify(plan, null, 2)}\n` : formatContextPlan(plan),
  );
}

const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsScript) {
  main().catch((error) => {
    process.stderr.write(`learning-context: ${error.message}\n\n${usage()}`);
    process.exitCode = 1;
  });
}
