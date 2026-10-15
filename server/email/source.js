// Where emails come from.
//   EMAIL_SOURCE=mock  -> built-in sample inbox (no n8n needed)
//   EMAIL_SOURCE=n8n   -> your Gmail, through the n8n workflow
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// An error whose message is safe to show on the dashboard.
const fail = (message, status = 502) => Object.assign(new Error(message), { status, expose: true });

// Live refresh asks for "fresh" data every ~30s. A fresh request only accepts a cached
// result younger than this, so new mail shows up quickly but two open tabs (or a quick
// double refresh) can't hammer n8n.
const FRESH_MAX_AGE_MS = 10_000;

let cache = null; // { key, at, emails } the last successful n8n answer
const inflight = new Map(); // key -> Promise: callers asking at the same moment share ONE n8n run

const isValid = (e) =>
  e && typeof e.id === "string" && typeof e.subject === "string" &&
  typeof e.from?.email === "string" && !Number.isNaN(Date.parse(e.receivedAt));

async function callN8n({ url, secret, rules, fetchLimit, key }) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Secret": secret },
      // Your rules travel with the request, so n8n Cloud never needs to reach your computer.
      body: JSON.stringify({ rules, fetchLimit, utcOffsetMinutes: -new Date().getTimezoneOffset() }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    throw fail(
      e?.name === "TimeoutError"
        ? "n8n took too long to answer. Open the workflow's Executions tab in n8n to see what happened."
        : "Can't reach n8n. Check N8N_WEBHOOK_URL and your internet connection."
    );
  }

  if (res.status === 401 || res.status === 403) throw fail("n8n rejected the secret. The Header Auth value in n8n must match N8N_WEBHOOK_SECRET exactly.");
  if (res.status === 404) throw fail("n8n webhook not found. Publish the workflow and use its Production URL (it contains /webhook/, not /webhook-test/).");
  if (!res.ok) throw fail(`n8n returned an error (HTTP ${res.status}). Open the workflow's Executions tab in n8n to see why.`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw fail("n8n sent back something that isn't JSON. Check the Respond to Webhook node.");
  }

  const emails = (Array.isArray(data?.emails) ? data.emails : []).filter(isValid).map((e) => ({ ...e, body: String(e.body ?? "") }));
  const m = data?.meta;
  if (m) console.log(`n8n: fetched ${m.fetched}, matched ${m.matched}${m.skipped ? `, could not read ${m.skipped}` : ""}`);

  cache = { key, at: Date.now(), emails }; // only successful answers are cached
  return emails;
}

async function fromN8n(rules, { fresh }) {
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url || !secret) {
    throw fail("n8n isn't set up yet. Add N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET to .env and restart the server.", 503);
  }

  const ttl = Number(process.env.N8N_CACHE_SECONDS ?? 60) * 1000;
  const fetchLimit = Math.min(Math.max(parseInt(process.env.N8N_FETCH_LIMIT, 10) || 100, 1), 500);
  const key = JSON.stringify({ rules, fetchLimit });

  // N8N_CACHE_SECONDS=0 still means "always ask n8n".
  const maxAge = fresh ? Math.min(ttl, FRESH_MAX_AGE_MS) : ttl;
  if (maxAge > 0 && cache?.key === key && Date.now() - cache.at < maxAge) return cache.emails;

  if (inflight.has(key)) return inflight.get(key);
  const run = callN8n({ url, secret, rules, fetchLimit, key }).finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

/**
 * @param rules  the enabled rules (sent to n8n)
 * @param opts.fresh  true for live refresh: don't reuse a cached answer older than ~10 seconds
 */
export async function getEmails(rules = [], { fresh = false } = {}) {
  const source = process.env.EMAIL_SOURCE || "mock";
  if (source === "mock") return JSON.parse(await readFile(path.join(here, "sample-emails.json"), "utf8"));
  if (source === "n8n") return fromN8n(rules, { fresh });
  throw new Error(`Unknown EMAIL_SOURCE "${source}"`);
}