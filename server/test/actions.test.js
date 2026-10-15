import test from "node:test";
import assert from "node:assert/strict";
import { readFullEmail, suggestReply } from "../email/actions.js";

const full = (id, extra = {}) => ({ id, from: { name: "HR Team", email: "hr@co.example" }, to: "me@x.example", subject: "Interview", receivedAt: "2026-10-13T08:10:00.000Z", body: "Can you attend Friday at 11?", ...extra });
const RULES = [{ id: "r", name: "Interviews", enabled: true, operator: "AND", conditions: [{ field: "subject", op: "contains", value: "interview" }] }];
const reply = (body, status = 200) => async () => ({ status, ok: status < 300, json: async () => body });

function setup(t) {
  const old = { ...process.env };
  Object.assign(process.env, { EMAIL_SOURCE: "n8n", N8N_WEBHOOK_URL: "https://n8n.example/webhook/specific-email-agent", N8N_WEBHOOK_SECRET: "s3cret", REPLY_SIGN_OFF_NAME: "Sawan" });
  t.after(() => { process.env = old; });
}

test("read: asks n8n by email id, keeps it in memory so a second open doesn't call n8n again", async (t) => {
  setup(t);
  let calls = 0, seen;
  t.mock.method(globalThis, "fetch", async (url, init) => { calls++; seen = { url, init }; return reply({ email: full("r1") })(); });
  assert.equal((await readFullEmail("r1", RULES)).subject, "Interview");
  await readFullEmail("r1", RULES);
  assert.equal(calls, 1);
  assert.equal(seen.url, process.env.N8N_WEBHOOK_URL);
  assert.equal(seen.init.headers["X-Workspace-Secret"], "s3cret");
  const sent = JSON.parse(seen.init.body);
  assert.equal(sent.action, "read");
  assert.equal(sent.emailId, "r1");
  assert.deepEqual(sent.rules, RULES, "the enabled rules go to n8n so it can verify the email too");
  assert.equal(typeof sent.utcOffsetMinutes, "number");
});

test("read: refuses an answer for a different email than the one requested", async (t) => {
  setup(t);
  t.mock.method(globalThis, "fetch", reply({ email: full("someone-else") }));
  await assert.rejects(readFullEmail("r2"), /different email/);
});

test("read: n8n error message and unreadable format are reported clearly", async (t) => {
  setup(t);
  t.mock.method(globalThis, "fetch", reply({ error: "Could not read this email from Gmail (unexpected format)." }));
  await assert.rejects(readFullEmail("r3"), /unexpected format/);
  t.mock.method(globalThis, "fetch", reply({ email: { id: "r4" } }));
  await assert.rejects(readFullEmail("r4"), /format I can't read/);
});

test("draft: sends the email content + sign-off name to the draft workflow and returns the text", async (t) => {
  setup(t);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return reply(calls[calls.length - 1].body.action === "read" ? { email: full("d1") } : { draft: "  Hi,\nYes, Friday works.  " })();
  });
  assert.equal(await suggestReply("d1", RULES), "Hi,\nYes, Friday works.");
  assert.ok(calls.every((c) => c.url === process.env.N8N_WEBHOOK_URL), "one workflow handles everything");
  const d = calls.find((c) => c.body.action === "draft");
  assert.deepEqual(d.body.rules, RULES);
  assert.equal(d.body.signOffName, "Sawan");
  assert.equal(d.body.email.body, "Can you attend Friday at 11?");
  assert.equal(d.body.email.from.email, "hr@co.example");
});

test("draft: Groq problems and empty drafts become readable errors; double clicks share one LLM call", async (t) => {
  setup(t);
  let llm = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (JSON.parse(init.body).action === "read") return reply({ email: full("d2") })();
    llm++;
    await new Promise((r) => setTimeout(r, 40));
    return reply(llm === 1 ? { error: "Groq error: Invalid API Key" } : { draft: "   " })();
  });
  await assert.rejects(suggestReply("d2", RULES), /Invalid API Key/);
  await assert.rejects(suggestReply("d2", RULES), /empty draft/);
  llm = 5;
  const [a, b] = [suggestReply("d2", RULES), suggestReply("d2", RULES)];
  await Promise.allSettled([a, b]);
  assert.equal(llm, 6, "two simultaneous requests share a single LLM call");
});