import test from "node:test";
import assert from "node:assert/strict";
import { getJobs, normalizeJobs, startRun, clearJobsCache } from "../jobs/source.js";

const good = { id: "j1", title: "ML Engineer", company: "Acme", status: "emailed", score: 82, match_category: "Good", apply_url: "https://acme.example/jobs/1", first_seen: "2026-10-16T05:00:00.000Z", verification: "employer_ats" };
const reply = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

function setup(t, env = {}) {
  const old = { ...process.env };
  Object.assign(process.env, { JOBS_SOURCE: "n8n", N8N_JOBS_WEBHOOK_URL: "https://n8n.example/webhook/job-hunter-agent", N8N_WEBHOOK_SECRET: "s3cret", JOBS_CACHE_SECONDS: "0", ...env });
  clearJobsCache();
  t.after(() => { process.env = old; clearJobsCache(); });
}

test("normalize: drops bad entries, duplicates, javascript: links; clamps unknown values", () => {
  const out = normalizeJobs([
    good,
    { ...good }, // same id
    { ...good, id: "j2", apply_url: "javascript:alert(1)", status: "weird", work_mode: "nope", score: 500, verification: "x" },
    { id: "", title: "x" },
    null,
  ]);
  assert.deepEqual(out.map((j) => j.id), ["j1", "j2"]);
  const j2 = out[1];
  assert.equal(j2.apply_url, "");
  assert.equal(j2.score, null);
  assert.equal(j2.work_mode, "unknown");
  assert.equal(j2.verification, "unverified");
});

test("normalize: not a list -> empty", () => {
  assert.deepEqual(normalizeJobs(undefined), []);
  assert.deepEqual(normalizeJobs({}), []);
});

test("mock source works without n8n and is labelled as sample data", async (t) => {
  setup(t, { JOBS_SOURCE: "mock" });
  const d = await getJobs();
  assert.ok(d.jobs.length > 0);
  assert.ok(d.jobs.every((j) => j.title.startsWith("SAMPLE")));
  assert.ok(d.stats.emailed >= 1);
});

test("n8n: not configured -> clear message", async (t) => {
  setup(t, { N8N_JOBS_WEBHOOK_URL: "" });
  await assert.rejects(getJobs(), (e) => e.expose && e.status === 503 && /N8N_JOBS_WEBHOOK_URL/.test(e.message));
});

test("n8n: sends the secret and action, builds stats", async (t) => {
  setup(t);
  let seen;
  t.mock.method(globalThis, "fetch", async (url, init) => { seen = { url, init }; return reply(200, { ok: true, jobs: [good, { id: "r", title: "Rejected", status: "rejected", reject_reasons: ["senior_role"] }], stats: {} })(); });
  const d = await getJobs();
  assert.equal(seen.init.headers["X-Workspace-Secret"], "s3cret");
  assert.equal(JSON.parse(seen.init.body).action, "list");
  assert.equal(d.stats.emailed, 1);
  assert.deepEqual(d.stats.reject_reasons, { senior_role: 1 });
});

test("n8n: an answer that is not Job Hunter data is rejected with a hint", async (t) => {
  setup(t);
  t.mock.method(globalThis, "fetch", reply(200, { articles: [] }));
  await assert.rejects(getJobs(), /Dashboard API/);
});

test("run: starts once, refuses a quick second click, and resets on failure", async (t) => {
  setup(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls += 1; return calls === 1 ? reply(500, {})() : reply(200, { ok: true, started: true })(); });
  await assert.rejects(startRun(), /HTTP 500/);
  assert.equal((await startRun()).started, true); // failure did not lock the button
  await assert.rejects(startRun(), (e) => e.status === 429);
  assert.equal(calls, 2);
});

test("run in sample mode does nothing", async (t) => {
  setup(t, { JOBS_SOURCE: "mock" });
  assert.equal((await startRun()).started, false);
});