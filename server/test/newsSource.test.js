import test from "node:test";
import assert from "node:assert/strict";
import { getNews, normalizeArticles, clearNewsCache } from "../news/source.js";

const good = { id: "a1", title: "A model", summary: "It is new.", source: "OpenAI", category: "Model Releases", url: "https://openai.com/x", published_at: "2026-10-16T05:00:00.000Z", added_at: "2026-10-16T06:00:00.000Z" };
const reply = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

function setup(t, env = {}) {
  const old = { ...process.env };
  Object.assign(process.env, { NEWS_SOURCE: "n8n", N8N_NEWS_WEBHOOK_URL: "https://n8n.example/webhook/news", N8N_WEBHOOK_SECRET: "s3cret", NEWS_CACHE_SECONDS: "0", ...env });
  clearNewsCache();
  t.after(() => { process.env = old; clearNewsCache(); });
}

test("normalize: drops bad links and bad dates, removes duplicates, newest first", () => {
  const out = normalizeArticles([
    good,
    { ...good, id: "a2", url: "javascript:alert(1)" },
    { ...good, id: "a3", url: "https://x.example/3", published_at: "nonsense" },
    { ...good, id: "a1" }, // same id
    { ...good, id: "a4" }, // same url
    { ...good, id: "a5", url: "https://x.example/5", published_at: "2026-10-16T07:00:00.000Z", category: "Nonsense" },
    null,
    { title: "" },
  ]);
  assert.deepEqual(out.map((a) => a.id), ["a5", "a1"]);
  assert.equal(out[0].category, "Industry"); // unknown category falls back
});

test("normalize: not a list -> empty list", () => {
  assert.deepEqual(normalizeArticles(undefined), []);
  assert.deepEqual(normalizeArticles({}), []);
});

test("mock source works without n8n", async (t) => {
  setup(t, { NEWS_SOURCE: "mock" });
  const list = await getNews();
  assert.ok(list.length > 0);
  assert.ok(list.every((a) => /^https?:\/\//.test(a.url)));
});

test("n8n: not configured -> clear message", async (t) => {
  setup(t, { N8N_NEWS_WEBHOOK_URL: "" });
  await assert.rejects(getNews(), (e) => e.expose && e.status === 503 && /N8N_NEWS_WEBHOOK_URL/.test(e.message));
});

test("n8n: sends the secret header and keeps only well-formed articles", async (t) => {
  setup(t);
  let seen;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    seen = { url, init };
    return reply(200, { articles: [good, { id: "bad" }], total: 2 })();
  });
  const list = await getNews();
  assert.deepEqual(list.map((a) => a.id), ["a1"]);
  assert.equal(seen.url, "https://n8n.example/webhook/news");
  assert.equal(seen.init.headers["X-Workspace-Secret"], "s3cret");
});

test("n8n: answers are cached, and a manual refresh skips an old cache", async (t) => {
  setup(t, { NEWS_CACHE_SECONDS: "300" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls += 1; return reply(200, { articles: [good] })(); });
  await getNews();
  await getNews();
  assert.equal(calls, 1);
  await getNews({ fresh: true }); // cache is younger than 10s, so still reused
  assert.equal(calls, 1);
});

test("n8n: errors are not cached and carry a helpful message", async (t) => {
  setup(t, { NEWS_CACHE_SECONDS: "300" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls += 1; return calls === 1 ? reply(404, {})() : reply(200, { articles: [good] })(); });
  await assert.rejects(getNews(), (e) => /webhook not found/.test(e.message));
  assert.equal((await getNews()).length, 1);
});