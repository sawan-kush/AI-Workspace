// "Read full email" and "Suggest reply". Both go through n8n (Gmail and the Groq LLM live there).
// Nothing is stored in a database: full emails are kept in memory for a few minutes only.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postToN8n } from "./n8nClient.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fail = (message, status = 502) => Object.assign(new Error(message), { status, expose: true });

const READ_TTL_MS = 5 * 60_000;
const MAX_CACHED = 50;
const readCache = new Map(); // email id -> { at, email }
const readInflight = new Map(); // so a double click shares one Gmail read
const draftInflight = new Map(); // ...and one LLM call

const isMock = () => (process.env.EMAIL_SOURCE || "mock") === "mock";

// Everything goes to the ONE "Specific Email Agent" workflow. Its Switch node reads `action`
// ("read" or "draft"). Your enabled rules go along so n8n can double-check the email too.
const WORKFLOW_URL = "N8N_WEBHOOK_URL";
const common = (rules) => ({ rules, utcOffsetMinutes: -new Date().getTimezoneOffset() });

async function fetchFull(id, rules) {
  if (isMock()) {
    const all = JSON.parse(await readFile(path.join(here, "sample-emails.json"), "utf8"));
    const e = all.find((x) => x.id === id);
    if (!e) throw fail("Email not found.", 404);
    return { id: e.id, from: e.from, to: "", subject: e.subject, receivedAt: e.receivedAt, body: e.body };
  }

  const data = await postToN8n(WORKFLOW_URL, { action: "read", emailId: id, ...common(rules) });
  if (data?.error) throw fail(String(data.error));
  const e = data?.email;
  if (!e || typeof e.from?.email !== "string" || typeof e.subject !== "string" || Number.isNaN(Date.parse(e.receivedAt))) {
    throw fail("n8n sent back an email in a format I can't read. Check the Code node in the Read Full Email workflow.");
  }
  // Safety check: never show a different message than the one that was asked for.
  if (String(e.id) !== id) throw fail("n8n returned a different email than requested. Check the Message ID field in the Gmail node.");
  return { id, from: e.from, to: String(e.to ?? ""), subject: e.subject, receivedAt: e.receivedAt, body: String(e.body ?? "").slice(0, 20_000) };
}

export function readFullEmail(id, rules = []) {
  const hit = readCache.get(id);
  if (hit && Date.now() - hit.at < READ_TTL_MS) return Promise.resolve(hit.email);
  if (readInflight.has(id)) return readInflight.get(id);

  const run = fetchFull(id, rules)
    .then((email) => {
      if (readCache.size >= MAX_CACHED) readCache.delete(readCache.keys().next().value); // drop the oldest
      readCache.set(id, { at: Date.now(), email });
      return email;
    })
    .finally(() => readInflight.delete(id));
  readInflight.set(id, run);
  return run;
}

async function makeDraft(id, rules) {
  const email = await readFullEmail(id, rules);
  if (isMock()) {
    return `Hi ${email.from.name.split(" ")[0]},\n\nThanks for your email about "${email.subject}". I've read it and will get back to you shortly.\n\n(This is a sample draft. Set EMAIL_SOURCE=n8n to get real AI drafts.)`;
  }

  const data = await postToN8n(
    WORKFLOW_URL,
    {
      action: "draft",
      email: { from: email.from, subject: email.subject, receivedAt: email.receivedAt, body: email.body },
      signOffName: process.env.REPLY_SIGN_OFF_NAME || "",
      ...common(rules),
    },
    { timeoutMs: 60_000 }
  );
  if (data?.error) throw fail(String(data.error));
  const draft = typeof data?.draft === "string" ? data.draft.trim() : "";
  if (!draft) throw fail("The AI sent back an empty draft. Please try again.");
  return draft.slice(0, 8_000);
}

export function suggestReply(id, rules = []) {
  if (draftInflight.has(id)) return draftInflight.get(id);
  const run = makeDraft(id, rules).finally(() => draftInflight.delete(id));
  draftInflight.set(id, run);
  return run;
}