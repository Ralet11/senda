#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile, access, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_ROOT = path.join(CLI_ROOT, "templates");
const VALID_STATUSES = new Set(["IDEAS", "IN_PROGRESS", "APPLIED", "DONE"]);
const VALID_PHASES = new Set(["DISCOVERY", "DESIGN", "DEVELOPMENT", "QA", "LAUNCHED"]);
const SECRET_PATTERN = /(-----BEGIN [^-]+-----|\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}|\b(?:postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\/)|senda_pt_[A-Za-z0-9_-]{20,})/i;

export function parseArgs(argv) {
  const positionals = [];
  const flags = new Map();
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (!value.startsWith("--")) { positionals.push(value); continue; }
    const [key, inline] = value.slice(2).split("=", 2);
    flags.set(key, inline ?? (argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true));
  }
  return { command: positionals[0], target: positionals[1], flags };
}

function fail(message) { throw new Error(message); }
function rootFrom(flags) { return path.resolve(String(flags.get("cwd") || process.cwd())); }
async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function json(file) { try { return JSON.parse(await readFile(file, "utf8")); } catch { fail(`No pude leer JSON válido: ${path.relative(process.cwd(), file)}`); } }
function projectDir(root) { return path.join(root, ".senda"); }
function assertText(value, label, max = 4000) { if (typeof value !== "string" || !value.trim() || value.trim().length > max) fail(`${label} debe ser texto no vacío de hasta ${max} caracteres.`); return value.trim(); }
function assertId(value, label) { const id = assertText(value, label, 120); if (!/^[A-Za-z0-9._:-]+$/.test(id)) fail(`${label} sólo puede usar letras, números, punto, guion, guion bajo y dos puntos.`); return id; }

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.isFile() && entry.name.endsWith(".md") ? [full] : [];
  }));
  return nested.flat();
}

async function knowledgePayload(base) {
  const root = path.join(base, "knowledge");
  return Promise.all((await markdownFiles(root)).sort().map(async (file) => ({ path: path.relative(root, file).replace(/\\/g, "/"), content: await readFile(file, "utf8") })));
}

export async function validateRoot(root) {
  const base = projectDir(root);
  const configFile = path.join(base, "senda.config.json");
  const errors = [];
  if (!await exists(configFile)) errors.push("Falta .senda/senda.config.json.");
  if (!await exists(path.join(base, "knowledge", "README.md"))) errors.push("Falta .senda/knowledge/README.md.");
  if (errors.length) return errors;
  for (const file of await markdownFiles(path.join(base, "knowledge"))) {
    const content = await readFile(file, "utf8");
    if (SECRET_PATTERN.test(content)) errors.push(`${path.relative(base, file)} parece contener un secreto.`);
  }
  const config = await json(configFile);
  try {
    if (config.version !== 1) fail("senda.config.json requiere version: 1.");
    assertText(config.projectId, "projectId", 128);
    const baseUrl = new URL(assertText(config.baseUrl, "baseUrl", 300));
    if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost") fail("baseUrl debe usar HTTPS, excepto localhost.");
    if (Object.keys(config).some((key) => /token|secret|password|key/i.test(key))) fail("senda.config.json no puede contener secretos.");
  } catch (error) { errors.push(error.message); }
  for (const file of ["tasks.json", "milestones.json", "project-state.json"]) {
    const full = path.join(base, file);
    if (!await exists(full)) { errors.push(`Falta .senda/${file}.`); continue; }
    try {
      const content = await readFile(full, "utf8");
      if (SECRET_PATTERN.test(content)) fail(`${file} parece contener un secreto.`);
      const data = JSON.parse(content);
      if (data.version !== 1) fail(`${file} requiere version: 1.`);
      if (file === "tasks.json") for (const task of data.tasks ?? []) { assertId(task.id, "task.id"); assertText(task.title, "task.title", 180); if (!VALID_STATUSES.has(task.status)) fail("task.status inválido."); if (!Number.isInteger(task.priority) || task.priority < 1 || task.priority > 3) fail("task.priority debe ser 1, 2 o 3."); }
      if (file === "milestones.json") for (const milestone of data.milestones ?? []) { assertId(milestone.id, "milestone.id"); assertText(milestone.title, "milestone.title", 180); if (milestone.dueDate !== null && milestone.dueDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(milestone.dueDate)) fail("milestone.dueDate debe ser YYYY-MM-DD o null."); if (typeof milestone.done !== "boolean") fail("milestone.done debe ser boolean."); }
      if (file === "project-state.json") { assertText(data.summary, "project-state.summary"); if (!VALID_PHASES.has(data.phase)) fail("project-state.phase inválida."); if (!Number.isInteger(data.progress) || data.progress < 0 || data.progress > 100) fail("project-state.progress debe ser entero entre 0 y 100."); if (data.activity !== undefined) assertText(data.activity, "project-state.activity", 1000); }
    } catch (error) { errors.push(error.message); }
  }
  return errors;
}

async function init(root, flags) {
  const destination = projectDir(root);
  if (await exists(destination) && !flags.get("force")) fail("Ya existe .senda/. Usá --force sólo para completar archivos faltantes.");
  await mkdir(destination, { recursive: true });
  await cp(TEMPLATE_ROOT, destination, { recursive: true, force: Boolean(flags.get("force")), errorOnExist: !Boolean(flags.get("force")) });
  const configFile = path.join(destination, "senda.config.json");
  const config = await json(configFile);
  if (flags.get("project-id")) config.projectId = String(flags.get("project-id"));
  if (flags.get("base-url")) config.baseUrl = String(flags.get("base-url")).replace(/\/$/, "");
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
  console.log("Senda inicializado.");
  console.log("1. Completá .senda/knowledge/ con información funcional confirmada.");
  console.log("2. El agente debe seguir .senda/SENDA_AGENT.md.");
  console.log("3. Ejecutá: senda validate");
}

async function push(root, target, flags) {
  if (!target || !["knowledge", "tasks", "milestones", "project-state", "all"].includes(target)) fail("Usá: senda push knowledge|tasks|milestones|project-state|all --apply");
  const errors = await validateRoot(root); if (errors.length) fail(`Validación fallida:\n- ${errors.join("\n- ")}`);
  const base = projectDir(root); const config = await json(path.join(base, "senda.config.json"));
  const payload = { version: 1, action: target === "project-state" ? "project-state" : target, projectId: config.projectId, agent: process.env.SENDA_AGENT_NAME || "repository-agent" };
  if (target === "knowledge" || target === "all") payload.knowledge = await knowledgePayload(base);
  if (target === "tasks" || target === "all") payload.tasks = (await json(path.join(base, "tasks.json"))).tasks;
  if (target === "milestones" || target === "all") payload.milestones = (await json(path.join(base, "milestones.json"))).milestones;
  if (target === "project-state" || target === "all") payload.projectState = await json(path.join(base, "project-state.json"));
  if (!flags.get("apply")) { console.log("Validación correcta. No se envió nada: agregá --apply para sincronizar."); return; }
  const token = process.env.SENDA_TOKEN; if (!token) fail("Falta SENDA_TOKEN en el entorno. Nunca lo guardes en .senda/.");
  const raw = JSON.stringify(payload);
  const response = await fetch(`${String(config.baseUrl).replace(/\/$/, "")}/api/external/v1/sync`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "idempotency-key": createHash("sha256").update(raw).digest("hex") }, body: raw });
  const data = await response.json().catch(() => null);
  if (!response.ok) fail(data?.error || `Senda respondió HTTP ${response.status}.`);
  console.log(`Sincronización correcta: ${JSON.stringify(data.counts)}`);
}

export async function run(argv = process.argv.slice(2)) {
  const { command, target, flags } = parseArgs(argv); const root = rootFrom(flags);
  if (!command || flags.get("help")) { console.log("Uso: senda init [--project-id ID] | senda validate | senda push knowledge|tasks|milestones|project-state|all [--apply]"); return; }
  if (command === "init") return init(root, flags);
  if (command === "validate") { const errors = await validateRoot(root); if (errors.length) fail(`Validación fallida:\n- ${errors.join("\n- ")}`); console.log("Validación correcta: .senda está lista."); return; }
  if (command === "push") return push(root, target, flags);
  fail(`Comando desconocido: ${command}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run().catch((error) => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
