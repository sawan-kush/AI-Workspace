import test from "node:test";
import assert from "node:assert/strict";
import { getEmails } from "../email/source.js";

const good = { id: "a1", from: { name: "P", email: "p@x.example" }, subject: "Hi", receivedAt: "2026-10-12T09:00:00.000Z", body: "hello" };
const reply = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

function setup(t, env = {}) {
  const old = { ...process.env };
  Object.assign(process.env, { EMAIL_SOURCE: "n8n", N8N_WEBHOOK_URL: "https://n8n.example/webhook/x", N8N_WEBHOOK_SECRET: "s3cret", N8N_CACHE_SECONDS: "0", ...env });
  t.after(() => { process.env = old; });
}

test("not configured -> clear message, nothing is fetched", async (t) => {
  setup(t, { N8N_WEBHOOK_URL: "", N8N_WEBHOOK_SECRET: "" });
  await assert.rejects(getEmails([]), (e) => e.expose && e.status === 503 && /N8N_WEBHOOK_URL/.test(e.message));
});

test("sends the secret header and the rules, keeps only well-formed emails", async (t) => {
  setup(t);
  let seen;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    seen = { url, init };
    return reply(200, { emails: [good, { id: "bad" }, { ...good, id: "a2", receivedAt: "nonsense" }], meta: { fetched: 3, matched: 3 } })();
  });
  const rules = [{ id: "r", name: "n", enabled: true, operator: "AND", conditions: [{ field: "subject", op: "contains", value: "hi" }] }];
  const emails = await getEmails(rules);
  assert.deepEqual(emails.map((e) => e.id), ["a1"]);
  assert.equal(seen.init.headers["X-Workspace-Secret"], "s3cret");
  const body = JSON.parse(seen.init.body);
  assert.deepEqual(body.rules, rules);
  assert.equal(typeof body.utcOffsetMinutes, "number");
});

test("wrong secret, missing webhook, network failure -> readable errors", async (t) => {
  setup(t);
  t.mock.method(globalThis, "fetch", reply(403, {}));
  await assert.rejects(getEmails([]), /rejected the secret/);
  t.mock.method(globalThis, "fetch", reply(404, {}));
  await assert.rejects(getEmails([]), /Production URL/);
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("fetch failed"); });
  await assert.rejects(getEmails([]), /Can't reach n8n/);
});

// ---- live refresh: cache + overlap behaviour ----
test("fresh requests skip a cache older than 10s, normal ones still use it (60s cache)", async (t) => {
  setup(t, { N8N_CACHE_SECONDS: "60" });
  let now = 1_000_000, calls = 0;
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async () => { calls++; return reply(200, { emails: [{ ...good, id: `c${calls}` }] })(); });
  const rules = [{ id: "r", name: "cache-test", enabled: true, operator: "AND", conditions: [{ field: "subject", op: "contains", value: "hi" }] }];

  assert.deepEqual((await getEmails(rules, { fresh: true })).map((e) => e.id), ["c1"]); // first call asks n8n
  now += 5_000;
  await getEmails(rules, { fresh: true });
  assert.equal(calls, 1, "a fresh request within 10s reuses the answer (protects n8n from double refreshes)");
  now += 6_000; // 11s old
  assert.deepEqual((await getEmails(rules, { fresh: true })).map((e) => e.id), ["c2"]);
  assert.equal(calls, 2, "a fresh request older than 10s goes to n8n again");
  now += 20_000; // 20s old: still inside the normal 60s cache
  await getEmails(rules);
  assert.equal(calls, 2, "a normal request may still use the 60s cache");
});

test("failed n8n calls are never cached", async (t) => {
  setup(t, { N8N_CACHE_SECONDS: "60" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return (calls === 1 ? reply(500, {}) : reply(200, { emails: [good] }))(); });
  const rules = [{ id: "r", name: "fail-test", enabled: true, operator: "AND", conditions: [{ field: "subject", op: "contains", value: "hi" }] }];
  await assert.rejects(getEmails(rules, { fresh: true }), /HTTP 500/);
  assert.equal((await getEmails(rules, { fresh: true })).length, 1);
  assert.equal(calls, 2);
});

test("two requests at the same moment share one n8n run", async (t) => {
  setup(t, { N8N_CACHE_SECONDS: "0" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; await new Promise((r) => setTimeout(r, 50)); return reply(200, { emails: [good] })(); });
  const rules = [{ id: "r", name: "inflight-test", enabled: true, operator: "AND", conditions: [{ field: "subject", op: "contains", value: "hi" }] }];
  const [a, b] = await Promise.all([getEmails(rules, { fresh: true }), getEmails(rules, { fresh: true })]);
  assert.equal(calls, 1);
  assert.equal(a.length + b.length, 2);
});