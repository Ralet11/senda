#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile, access, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_ROOT = path.join(CLI_ROOT, "templates");
const VALID_STATUSES = new Set(["IDEAS", "IN_PROGRESS", "APPLIED", "DONE"]);
const VALID_PHASES = new Set(["DISCOVERY", "DESIGN", "DEVELOPMENT", "QA", "LAUNCHED"]);
const SECRET_PATTERN = /(-----BEGIN [^-]+-----|\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}|\b(?:postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\/)|senda_(?:pt|dt)_[A-Za-z0-9_-]{20,})/i;
const KEYRING_SERVICE = "com.prismadevs.senda-cli";

export function parseArgs(argv) {
  const positionals = [];
  const flags = new Map();
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (!value.startsWith("--")) { positionals.push(value); continue; }
    const [key, inline] = value.slice(2).split("=", 2);
    flags.set(key, inline ?? (argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true));
  }
  return { command: positionals[0], target: positionals[1], args: positionals.slice(2), flags };
}

function fail(message) { throw new Error(message); }
function rootFrom(flags) { return path.resolve(String(flags.get("cwd") || process.cwd())); }
async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function json(file) { try { return JSON.parse(await readFile(file, "utf8")); } catch { fail(`No pude leer JSON válido: ${path.relative(process.cwd(), file)}`); } }
function projectDir(root) { return path.join(root, ".senda"); }
function assertText(value, label, max = 4000) { if (typeof value !== "string" || !value.trim() || value.trim().length > max) fail(`${label} debe ser texto no vacío de hasta ${max} caracteres.`); return value.trim(); }
function assertId(value, label) { const id = assertText(value, label, 120); if (!/^[A-Za-z0-9._:-]+$/.test(id)) fail(`${label} sólo puede usar letras, números, punto, guion, guion bajo y dos puntos.`); return id; }

async function loadConfig(root) {
  const configFile = path.join(projectDir(root), "senda.config.json");
  if (!await exists(configFile)) fail("Falta .senda/senda.config.json. Ejecuta senda init primero.");
  const config = await json(configFile);
  if (config.version !== 1) fail("senda.config.json requiere version: 1.");
  const projectId = assertText(config.projectId, "projectId", 128);
  const baseUrl = new URL(assertText(config.baseUrl, "baseUrl", 300));
  if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost") fail("baseUrl debe usar HTTPS, excepto localhost.");
  return { projectId, baseUrl: baseUrl.toString().replace(/\/$/, "") };
}

async function keyringEntry(config) {
  try {
    const { Entry } = await import("@napi-rs/keyring");
    return new Entry(KEYRING_SERVICE, config.baseUrl);
  } catch {
    fail("No se pudo acceder al almacén seguro del sistema. Podés usar SENDA_DEV_TOKEN temporalmente.");
  }
}

async function storedDeveloperToken(config) {
  try {
    return (await keyringEntry(config)).getPassword()?.trim() || null;
  } catch {
    return null;
  }
}

async function developerToken(config) {
  const token = process.env.SENDA_DEV_TOKEN?.trim();
  if (token) return token;
  const stored = await storedDeveloperToken(config);
  if (stored) return stored;
  fail("No hay una sesiÃ³n de Senda CLI en esta computadora. EjecutÃ¡ `senda login`. Como alternativa temporal podÃ©s usar SENDA_DEV_TOKEN sÃ³lo en la sesiÃ³n actual.");
}

async function developerRequest(config, pathName, options = {}) {
  const response = await fetch(`${config.baseUrl}/api/external/v1/developer-tasks${pathName}`, {
    ...options,
    headers: { authorization: `Bearer ${await developerToken(config)}`, ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers ?? {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const hint = data?.error === "TASK_NOT_AVAILABLE" ? "La tarea ya no esta libre; ejecuta senda tasks available para refrescar la lista." : data?.error === "TASK_NOT_ASSIGNED_TO_YOU" ? "No podes cambiar el estado de una tarea que no te pertenece." : null;
    fail(hint ?? data?.error ?? `Senda respondio HTTP ${response.status}.`);
  }
  return data;
}

function showTasks(result, asJson) {
  if (asJson) { console.log(JSON.stringify(result, null, 2)); return; }
  if (!result.tasks?.length) { console.log(result.view === "available" ? "No hay ideas libres en este proyecto." : "No tenes tareas asignadas en este proyecto."); return; }
  console.log(result.view === "available" ? "Ideas libres:" : "Tus tareas:");
  for (const task of result.tasks) {
    const urgency = task.urgency === "URGENT" ? " [URGENTE]" : task.urgency === "HIGH" ? " [ATENCION]" : "";
    console.log(`- ${task.title}${urgency}`);
    console.log(`  id: ${task.id} | ${task.status} | prioridad ${task.priority} | ${task.notes.length} nota(s)`);
    if (task.description) console.log(`  ${task.description}`);
  }
}

async function ensureLocalContextIsIgnored(base) {
  const gitignore = path.join(base, ".gitignore");
  const entry = ".local/";
  if (!await exists(gitignore)) {
    await writeFile(gitignore, `${entry}\n`);
    return;
  }
  const content = await readFile(gitignore, "utf8");
  if (!content.split(/\r?\n/).map((line) => line.trim()).includes(entry)) {
    await writeFile(gitignore, `${content.replace(/\s*$/, "")}\n${entry}\n`);
  }
}

export async function writePersonalTaskContext(root, config, result) {
  const base = projectDir(root);
  const local = path.join(base, ".local");
  await mkdir(base, { recursive: true });
  await ensureLocalContextIsIgnored(base);
  await mkdir(local, { recursive: true });
  const snapshot = {
    version: 1,
    source: "senda-cli/tasks-mine",
    fetchedAt: new Date().toISOString(),
    projectId: config.projectId,
    tasks: result.tasks ?? [],
  };
  await writeFile(path.join(local, "my-tasks.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
}

export function parseClaimTargets(args) {
  const values = args.flatMap((value) => String(value).split(",").map((part) => part.trim()).filter(Boolean));
  if (!values.length) fail("Indicá un id, una cantidad o all.");
  if (values.length === 1 && /^\d+$/.test(values[0])) return { type: "count", count: Number(values[0]) };
  if (values.length === 1 && values[0].toLowerCase() === "all") return { type: "all" };
  return { type: "ids", ids: values };
}

async function availableTasks(config) {
  return developerRequest(config, `?projectId=${encodeURIComponent(config.projectId)}&view=available`);
}

async function claimTask(config, taskId) {
  return developerRequest(config, "", { method: "POST", body: JSON.stringify({ projectId: config.projectId, action: "claim", taskId }) });
}

async function claimMany(config, requested) {
  let targets;
  if (requested.type === "ids") {
    targets = requested.ids;
  } else {
    const available = await availableTasks(config);
    targets = available.tasks.map((task) => task.id);
    if (requested.type === "count") {
      if (!Number.isSafeInteger(requested.count) || requested.count < 1) fail("La cantidad debe ser un entero mayor a cero.");
      targets = targets.slice(0, requested.count);
    }
  }

  if (!targets.length) {
    console.log("No hay ideas libres para reclamar.");
    return;
  }

  const claimed = [];
  const unavailable = [];
  for (const taskId of targets) {
    try {
      const result = await claimTask(config, taskId);
      claimed.push(result.task?.title ?? taskId);
    } catch (error) {
      unavailable.push({ taskId, message: error.message });
    }
  }

  if (claimed.length) console.log(`Reclamaste ${claimed.length} tarea(s):\n${claimed.map((title) => `- ${title}`).join("\n")}`);
  if (unavailable.length) console.log(`No se pudieron reclamar ${unavailable.length} tarea(s), posiblemente porque otro dev las tomó:\n${unavailable.map(({ taskId }) => `- ${taskId}`).join("\n")}`);
  if (!claimed.length) fail("No se pudo reclamar ninguna de las tareas solicitadas.");
  return developerRequest(config, `?projectId=${encodeURIComponent(config.projectId)}&view=mine`);
}

async function tasks(root, target, args, flags) {
  if (!target || flags.get("help")) {
    console.log("Uso: senda tasks pull|mine|available [--json] | senda tasks claim <id>|<cantidad>|all|<id1,id2,...> | senda tasks status <task-id> <IDEAS|IN_PROGRESS|APPLIED|DONE> | senda tasks note <task-id> <texto>");
    return;
  }
  const config = await loadConfig(root);
  if (target === "pull" || target === "mine" || target === "available") {
    const view = target === "available" ? "available" : "mine";
    const result = await developerRequest(config, `?projectId=${encodeURIComponent(config.projectId)}&view=${view}`);
    if (view === "mine") await writePersonalTaskContext(root, config, result);
    showTasks(result, Boolean(flags.get("json")));
    return;
  }
  if (target === "claim") {
    const mine = await claimMany(config, parseClaimTargets(args));
    if (mine) await writePersonalTaskContext(root, config, mine);
    return;
  }
  const taskId = args[0];
  if (!taskId) fail("Indicá el id de la tarea.");
  if (target === "status") {
    const status = args[1];
    if (!VALID_STATUSES.has(status)) fail("Estado invalido. Usa IDEAS, IN_PROGRESS, APPLIED o DONE.");
    await developerRequest(config, "", { method: "POST", body: JSON.stringify({ projectId: config.projectId, action: "status", taskId, status }) });
    await writePersonalTaskContext(root, config, await developerRequest(config, `?projectId=${encodeURIComponent(config.projectId)}&view=mine`));
    console.log(`Estado actualizado a ${status}.`);
    return;
  }
  if (target === "note") {
    const content = args.slice(1).join(" ").trim();
    if (!content) fail("Escribi la nota despues del id de la tarea.");
    await developerRequest(config, "", { method: "POST", body: JSON.stringify({ projectId: config.projectId, action: "note", taskId, content }) });
    await writePersonalTaskContext(root, config, await developerRequest(config, `?projectId=${encodeURIComponent(config.projectId)}&view=mine`));
    console.log("Nota agregada.");
    return;
  }
  fail("Usá: senda tasks pull|mine|available|claim|status|note");
}

async function prompt(question) {
  const terminal = createInterface({ input, output });
  try { return (await terminal.question(question)).trim(); } finally { terminal.close(); }
}

async function promptPassword(question) {
  if (!input.isTTY) fail("`senda login` requiere una terminal interactiva para proteger tu contraseña.");
  return new Promise((resolve, reject) => {
    let value = "";
    const wasRaw = input.isRaw;
    output.write(question);
    input.setRawMode(true);
    input.resume();
    const finish = () => {
      input.removeListener("data", onData);
      input.setRawMode(Boolean(wasRaw));
      output.write("\n");
    };
    const onData = (chunk) => {
      const char = chunk.toString("utf8");
      if (char === "\u0003") { finish(); reject(new Error("Inicio de sesión cancelado.")); return; }
      if (char === "\r" || char === "\n") { finish(); resolve(value); return; }
      if (char === "\u007f" || char === "\b") { value = value.slice(0, -1); return; }
      if (!/\p{C}/u.test(char)) value += char;
    };
    input.on("data", onData);
  });
}

async function login(root, flags) {
  const config = await loadConfig(root);
  const email = String(flags.get("email") || await prompt("Email de Senda: ")).trim().toLowerCase();
  const password = String(flags.get("password") || await promptPassword("Contraseña de Senda: "));
  const label = String(flags.get("label") || `Senda CLI · ${process.env.COMPUTERNAME || process.env.HOSTNAME || "esta computadora"}`).trim().slice(0, 80);
  if (!email || !password || !label) fail("Email, contraseña y etiqueta son obligatorios.");

  const response = await fetch(`${config.baseUrl}/api/external/v1/developer-cli/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, label }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.token !== "string") fail(data?.error || `Senda respondió HTTP ${response.status}.`);
  try {
    (await keyringEntry(config)).setPassword(data.token);
  } catch {
    fail("No se pudo guardar la sesión en el almacén seguro del sistema. No se guardó ninguna credencial; podés usar SENDA_DEV_TOKEN temporalmente.");
  }
  console.log(`Sesión iniciada para ${data.user?.name || email}. La credencial quedó en el almacén seguro de esta computadora, fuera del repositorio.`);
}

async function logout(root) {
  const config = await loadConfig(root);
  try { (await keyringEntry(config)).deletePassword(); } catch { /* no persisted session */ }
  console.log("Sesión local de Senda CLI eliminada de esta computadora.");
}

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.isFile() && entry.name.endsWith(".md") ? [full] : [];
  }));
  return nested.flat();
}

async function copyMissing(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyMissing(from, to);
    } else if (entry.isFile() && !await exists(to)) {
      await copyFile(from, to);
    }
  }
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
  await copyMissing(TEMPLATE_ROOT, destination);
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
  // `senda login` is enough for a developer. SENDA_TOKEN stays available for
  // non-interactive CI or repository agents that cannot access a keychain.
  const token = process.env.SENDA_TOKEN?.trim() || await developerToken(await loadConfig(root));
  const raw = JSON.stringify(payload);
  const response = await fetch(`${String(config.baseUrl).replace(/\/$/, "")}/api/external/v1/sync`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "idempotency-key": createHash("sha256").update(raw).digest("hex") }, body: raw });
  const data = await response.json().catch(() => null);
  if (!response.ok) fail(data?.error || `Senda respondió HTTP ${response.status}.`);
  console.log(`Sincronización correcta: ${JSON.stringify(data.counts)}`);
}

export async function run(argv = process.argv.slice(2)) {
  const { command, target, args, flags } = parseArgs(argv); const root = rootFrom(flags);
  if (!command || flags.get("help")) { console.log("Uso: senda init [--project-id ID] | senda login | senda logout | senda validate | senda push knowledge|tasks|milestones|project-state|all [--apply] | senda tasks pull|mine|available|claim|status|note"); return; }
  if (command === "init") return init(root, flags);
  if (command === "login") return login(root, flags);
  if (command === "logout") return logout(root);
  if (command === "validate") { const errors = await validateRoot(root); if (errors.length) fail(`Validación fallida:\n- ${errors.join("\n- ")}`); console.log("Validación correcta: .senda está lista."); return; }
  if (command === "push") return push(root, target, flags);
  if (command === "tasks") return tasks(root, target, args, flags);
  fail(`Comando desconocido: ${command}`);
}

if (process.argv[1] && path.basename(process.argv[1]) === "senda.mjs") run().catch((error) => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
