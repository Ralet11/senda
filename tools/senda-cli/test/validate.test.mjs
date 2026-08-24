import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs, parseClaimTargets, validateRoot } from "../bin/senda.mjs";

test("parses flags before or after positional arguments", () => {
  assert.deepEqual(parseArgs(["init", "--project-id", "project-1"]), { command: "init", target: undefined, args: [], flags: new Map([["project-id", "project-1"]]) });
  assert.equal(parseArgs(["push", "tasks", "--apply"]).target, "tasks");
  assert.deepEqual(parseArgs(["tasks", "note", "task-1", "Seguimos", "mañana"]).args, ["task-1", "Seguimos", "mañana"]);
});

test("runs when invoked through the package binary", () => {
  const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/senda.mjs");
  const output = execFileSync(process.execPath, [bin], { encoding: "utf8" });
  assert.match(output, /Uso: senda init/);
});

test("init creates the local commands guide", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "senda-cli-init-"));
  const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/senda.mjs");
  execFileSync(process.execPath, [bin, "init", "--project-id", "project-1"], { cwd: root, encoding: "utf8" });
  const guide = await readFile(path.join(root, ".senda", "SENDA_COMMANDS.txt"), "utf8");
  assert.match(guide, /senda tasks claim all/);
});

test("rejects a missing Senda structure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "senda-cli-"));
  const errors = await validateRoot(root);
  assert.ok(errors.some((item) => item.includes("senda.config")));
});

test("parses single, multiple, counted and all task claims", () => {
  assert.deepEqual(parseClaimTargets(["task-1"]), { type: "ids", ids: ["task-1"] });
  assert.deepEqual(parseClaimTargets(["task-1,task-2", "task-3"]), { type: "ids", ids: ["task-1", "task-2", "task-3"] });
  assert.deepEqual(parseClaimTargets(["4"]), { type: "count", count: 4 });
  assert.deepEqual(parseClaimTargets(["all"]), { type: "all" });
});

test("accepts the minimum valid structure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "senda-cli-"));
  await mkdir(path.join(root, ".senda", "knowledge"), { recursive: true });
  await writeFile(path.join(root, ".senda", "knowledge", "README.md"), "# Producto\nTexto confirmado.");
  await writeFile(path.join(root, ".senda", "senda.config.json"), '{"version":1,"projectId":"project-1","baseUrl":"https://senda.example.com"}');
  await writeFile(path.join(root, ".senda", "tasks.json"), '{"version":1,"tasks":[]}');
  await writeFile(path.join(root, ".senda", "milestones.json"), '{"version":1,"milestones":[]}');
  await writeFile(path.join(root, ".senda", "project-state.json"), '{"version":1,"summary":"Estado confirmado","phase":"DISCOVERY","progress":0}');
  assert.deepEqual(await validateRoot(root), []);
});
