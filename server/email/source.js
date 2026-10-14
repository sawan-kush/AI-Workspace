// Where emails come from. Phase 1B uses a built-in sample inbox so the rules
// can be tested without Gmail. Phase 1C adds the n8n source here and nothing
// else in the app changes.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export async function getEmails() {
  const source = process.env.EMAIL_SOURCE || "mock";
  if (source === "mock") {
    return JSON.parse(await readFile(path.join(here, "sample-emails.json"), "utf8"));
  }
  throw new Error(`Unknown EMAIL_SOURCE "${source}"`);
}