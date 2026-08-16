import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseArgs, validateRoot } from "../bin/senda.mjs";

test("parses flags before or after positional arguments", () => {
  assert.deepEqual(parseArgs(["init", "--project-id", "project-1"]), { command: "init", target: undefined, flags: new Map([["project-id", "project-1"]]) });
  assert.equal(parseArgs(["push", "tasks", "--apply"]).target, "tasks");
});

test("rejects a missing Senda structure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "senda-cli-"));
  const errors = await validateRoot(root);
  assert.ok(errors.some((item) => item.includes("senda.config")));
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
