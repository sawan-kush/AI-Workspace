// Where AI news comes from.
//   NEWS_SOURCE=mock  -> built-in sample articles (no n8n needed)
//   NEWS_SOURCE=n8n   -> the "AI News Agent" workflow in n8n (RSS + Groq + Data Table)
// The n8n workflow collects and classifies articles on its own schedule. This file only READS
// the saved results, so opening the page never costs a Groq call.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postToN8n } from "../email/n8nClient.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const CATEGORIES = ["Model Releases", "Tools & Libraries", "Company News", "Research", "Industry"];

// A manual "Refresh" never accepts a cached answer older than this; normal loads use NEWS_CACHE_SECONDS.
const FRESH_MAX_AGE_MS = 10_000;

let cache = null; // { at, articles } the last successful answer
let inflight = null; // callers asking at the same moment share ONE n8n run

const validDate = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** Keeps only well-formed articles, removes duplicates, newest first. */
export function normalizeArticles(list) {
  const seen = new Set();
  const out = [];
  for (const a of Array.isArray(list) ? list : []) {
    if (!a || typeof a !== "object") continue;
    const title = typeof a.title === "string" ? a.title.trim() : "";
    const url = typeof a.url === "string" ? a.url.trim() : "";
    // Only real web links ever reach the browser (blocks "javascript:" and similar).
    if (!title || !/^https?:\/\//i.test(url) || !validDate(a.published_at)) continue;

    const id = typeof a.id === "string" && a.id ? a.id : url;
    if (seen.has(id) || seen.has(url)) continue;
    seen.add(id);
    seen.add(url);

    out.push({
      id,
      title: title.slice(0, 300),
      summary: typeof a.summary === "string" ? a.summary.trim().slice(0, 400) : "",
      source: typeof a.source === "string" && a.source.trim() ? a.source.trim().slice(0, 60) : "Unknown",
      category: CATEGORIES.includes(a.category) ? a.category : "Industry",
      url,
      published_at: new Date(a.published_at).toISOString(),
      added_at: validDate(a.added_at) ? new Date(a.added_at).toISOString() : new Date(a.published_at).toISOString(),
    });
  }
  return out.sort((x, y) => Date.parse(y.published_at) - Date.parse(x.published_at));
}

async function fromMock() {
  const raw = JSON.parse(await readFile(path.join(here, "sample-news.json"), "utf8"));
  const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();
  return normalizeArticles(
    raw.map(({ hours_ago, ...a }) => ({ ...a, published_at: hoursAgo(hours_ago), added_at: hoursAgo(Math.max(hours_ago - 1, 0)) }))
  );
}

async function fromN8n() {
  const limit = Math.min(Math.max(parseInt(process.env.NEWS_LIMIT, 10) || 40, 1), 100);
  const data = await postToN8n("N8N_NEWS_WEBHOOK_URL", { limit }, { timeoutMs: 30_000 });
  const articles = normalizeArticles(data?.articles);
  if (data?.total !== undefined) console.log(`n8n news: ${articles.length} articles sent, ${data.total} saved in total`);
  return articles;
}

/** @param opts.fresh true for the Refresh button: don't reuse a cached answer older than ~10 seconds */
export async function getNews({ fresh = false } = {}) {
  const source = process.env.NEWS_SOURCE || "mock";
  if (source === "mock") return fromMock();
  if (source !== "n8n") throw new Error(`Unknown NEWS_SOURCE "${source}"`);

  const ttl = Number(process.env.NEWS_CACHE_SECONDS ?? 300) * 1000;
  const maxAge = fresh ? Math.min(ttl, FRESH_MAX_AGE_MS) : ttl;
  if (maxAge > 0 && cache && Date.now() - cache.at < maxAge) return cache.articles;

  if (inflight) return inflight;
  inflight = fromN8n()
    .then((articles) => {
      cache = { at: Date.now(), articles }; // only successful answers are cached
      return articles;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Test helper: forget the cached answer. */
export const clearNewsCache = () => {
  cache = null;
};