// File-backed rule storage. Rules live only on the server (never in browser
// storage), are written atomically, and the file is readable only by you.
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { MAX_RULES } from "./validate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.RULES_FILE || path.join(here, "..", "data", "rules.json");

// One write at a time, so two quick clicks can't overwrite each other.
let queue = Promise.resolve();
const locked = (fn) => {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
};

async function read() {
  try {
    const data = JSON.parse(await fs.readFile(FILE, "utf8"));
    return Array.isArray(data.rules) ? data.rules : [];
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function write(rules) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ rules }, null, 2), { mode: 0o600 });
  await fs.rename(tmp, FILE);
}

export const list = () => locked(read);

export const create = (value) =>
  locked(async () => {
    const rules = await read();
    if (rules.length >= MAX_RULES) {
      throw Object.assign(new Error(`You can have at most ${MAX_RULES} rules.`), { status: 400 });
    }
    const rule = { id: randomUUID(), ...value };
    await write([...rules, rule]);
    return rule;
  });

export const replace = (id, value) =>
  locked(async () => {
    const rules = await read();
    const i = rules.findIndex((r) => r.id === id);
    if (i === -1) return null;
    rules[i] = { id, ...value };
    await write(rules);
    return rules[i];
  });

export const setEnabled = (id, enabled) =>
  locked(async () => {
    const rules = await read();
    const rule = rules.find((r) => r.id === id);
    if (!rule) return null;
    rule.enabled = enabled;
    await write(rules);
    return rule;
  });

export const remove = (id) =>
  locked(async () => {
    const rules = await read();
    const next = rules.filter((r) => r.id !== id);
    if (next.length === rules.length) return false;
    await write(next);
    return true;
  });