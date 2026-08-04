import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildContextPlan, formatContextPlan } from "./learning-context.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.join(repoRoot, "Learning.example");

test("interrogation loads one phase, source, relevant logs, and defers closing", async () => {
  const plan = await buildContextPlan({
    workspace,
    book: "clear-thinking-primer",
    segment: "claims-and-reasons",
    mode: "interrogation",
  });

  assert(plan.load_now.includes(".system/prompts/interrogation.md"));
  assert(
    plan.load_now.includes(
      "books/clear-thinking-primer/source/01-claims-and-reasons.md",
    ),
  );
  assert(
    plan.load_now.some((item) => item.includes("interrogation-claims-and-reasons")),
  );
  assert(
    plan.load_now.some((item) => item.includes("recall-claims-and-reasons")),
  );
  assert(!plan.load_now.some((item) => item.startsWith("App/")));
  assert(plan.load_at_close.includes(".system/protocols/session-close.md"));
});

test("recall keeps source out of context until retrieval finishes", async () => {
  const plan = await buildContextPlan({
    workspace,
    book: "systems-and-feedback",
    segment: "01-loops",
    mode: "recall",
  });

  const source = "books/systems-and-feedback/source/01-loops.md";
  assert(!plan.load_now.includes(source));
  assert(plan.load_after_retrieval.includes(source));
  assert.equal(plan.segment, "loops");
});

test("independent reading gives the source to the learner without agent ingestion", async () => {
  const plan = await buildContextPlan({
    workspace,
    book: "systems-and-feedback",
    segment: "delays",
    mode: "independent-reading",
  });

  const source = "books/systems-and-feedback/source/02-delays.md";
  assert(!plan.load_now.includes(source));
  assert(plan.learner_reads.includes(source));
});

test("formatted plan makes the app boundary explicit", async () => {
  const plan = await buildContextPlan({
    workspace,
    book: "systems-and-feedback",
    segment: "loops",
    mode: "feynman",
  });
  const rendered = formatContextPlan(plan);
  assert.match(rendered, /## Do not load/);
  assert.match(rendered, /- App\//);
});

test("rejects unsupported modes", async () => {
  await assert.rejects(
    buildContextPlan({
      workspace,
      book: "clear-thinking-primer",
      segment: "claims-and-reasons",
      mode: "summarize-everything",
    }),
    /unsupported --mode/,
  );
});

test("every routed mode produces a context plan", async () => {
  const cases = [
    { mode: "setup-book" },
    { mode: "independent-reading", book: "systems-and-feedback", segment: "delays" },
    { mode: "interrogation", book: "clear-thinking-primer", segment: "claims-and-reasons" },
    { mode: "learner-reconstruction", book: "clear-thinking-primer", segment: "counterexamples" },
    { mode: "reconstruction-review", book: "systems-and-feedback", segment: "loops" },
    { mode: "card-generation", book: "systems-and-feedback", segment: "loops" },
    { mode: "card-editing", book: "clear-thinking-primer", segment: "hidden-assumptions" },
    { mode: "recall", book: "systems-and-feedback", segment: "loops" },
    { mode: "feynman", book: "systems-and-feedback", segment: "loops" },
    { mode: "examination", book: "clear-thinking-primer" },
  ];

  for (const entry of cases) {
    const plan = await buildContextPlan({ workspace, ...entry });
    assert.equal(plan.mode, entry.mode);
    assert(plan.load_now.includes(".system/CONTEXT.md"));
    assert(plan.load_now.includes(".system/ROUTER.md"));
    assert(plan.do_not_load.includes("App/"));
  }
});

test("external legacy vault uses its context with the bundled router", async (t) => {
  const external = await fs.mkdtemp(path.join(os.tmpdir(), "learning-context-"));
  t.after(() => fs.rm(external, { recursive: true, force: true }));

  await fs.mkdir(path.join(external, ".system"), { recursive: true });
  await fs.copyFile(
    path.join(workspace, ".system", "CONTEXT.md"),
    path.join(external, ".system", "CONTEXT.md"),
  );
  await fs.writeFile(
    path.join(external, ".system", "ROUTER.md"),
    "# Legacy incomplete router\n",
    "utf8",
  );
  await fs.cp(path.join(workspace, "books"), path.join(external, "books"), {
    recursive: true,
  });

  const plan = await buildContextPlan({
    workspace: external,
    book: "clear-thinking-primer",
    segment: "claims-and-reasons",
    mode: "interrogation",
  });

  assert.equal(plan.load_now[0], ".system/CONTEXT.md");
  assert(plan.load_now[1].endsWith("Learning.example/.system/ROUTER.md"));
  assert(plan.warnings.some((warning) => warning.includes("external instruction bundle")));
});
