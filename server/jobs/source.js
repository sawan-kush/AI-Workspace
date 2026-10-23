// Where Job Hunter data comes from.
//   JOBS_SOURCE=mock  -> built-in SAMPLE jobs (not real listings) so the page works without n8n
//   JOBS_SOURCE=n8n   -> the "AI Job Hunter Agent" workflow in n8n (reads its saved job table)
// Opening the page only READS saved results; it never triggers an AI call. "Run now" starts the workflow on purpose.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postToN8n } from "../email/n8nClient.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const STATUSES = ["emailed", "qualified", "awaiting_verification", "deferred", "rejected", "error_llm", "error_pdf", "error_email", "error_link", "failed"];
const WORK_MODES = ["remote", "hybrid", "onsite", "unknown"];
const VERIFICATIONS = ["employer_ats", "board_link_live", "unverified", "expired"];
const FRESH_MAX_AGE_MS = 10_000;

let cache = null;
let inflight = null;

const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const strList = (v, n = 12, len = 120) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, len)).slice(0, n) : []);
const isoOrNull = (v) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const httpUrl = (v) => (typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim() : "");

/** Keeps only well-formed jobs; only real web links reach the browser. */
export function normalizeJobs(list) {
  const seen = new Set();
  const out = [];
  for (const j of Array.isArray(list) ? list : []) {
    if (!j || typeof j !== "object") continue;
    const id = str(j.id, 80);
    const title = str(j.title, 200);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const score = typeof j.score === "number" && j.score >= 0 && j.score <= 100 ? Math.round(j.score) : null;
    out.push({
      id,
      title,
      company: str(j.company, 100) || "Unknown",
      location: str(j.location, 120),
      work_mode: WORK_MODES.includes(j.work_mode) ? j.work_mode : "unknown",
      job_type: str(j.job_type, 40),
      source: str(j.source, 40),
      posted_at: isoOrNull(j.posted_at),
      first_seen: isoOrNull(j.first_seen),
      status: STATUSES.includes(j.status) ? j.status : str(j.status, 30) || "rejected",
      score,
      match_category: ["Excellent", "Good", "Moderate", "Poor"].includes(j.match_category) ? j.match_category : null,
      matched: strList(j.matched),
      missing: strList(j.missing),
      concerns: strList(j.concerns, 5, 200),
      reject_reasons: strList(j.reject_reasons, 6, 60),
      why: str(j.why, 600),
      verification: VERIFICATIONS.includes(j.verification) ? j.verification : "unverified",
      verification_note: str(j.verification_note, 300),
      confidence: ["high", "medium", "low"].includes(j.confidence) ? j.confidence : null,
      apply_url: httpUrl(j.apply_url),
      resume_filename: str(j.resume_filename, 160) || null,
      emailed_at: isoOrNull(j.emailed_at),
      error: str(j.error, 300) || null,
      retry_count: Number.isInteger(j.retry_count) ? j.retry_count : 0,
    });
  }
  return out.sort((a, b) => Date.parse(b.first_seen || 0) - Date.parse(a.first_seen || 0));
}

const num = (v) => (Number.isFinite(v) ? v : 0);
function buildStats(jobs, remote) {
  const s = remote && typeof remote === "object" ? remote : {};
  const buckets = Array.isArray(s.score_buckets) && s.score_buckets.length === 10 ? s.score_buckets.map(num) : Array(10).fill(0);
  if (!Array.isArray(s.score_buckets)) for (const j of jobs) if (j.score !== null) buckets[Math.min(9, Math.floor(j.score / 10))] += 1;
  const reasons = {};
  for (const j of jobs) if (j.status === "rejected") for (const r of j.reject_reasons) reasons[r] = (reasons[r] || 0) + 1;
  return {
    stored_jobs: jobs.length,
    excellent: jobs.filter((j) => j.match_category === "Excellent").length,
    good: jobs.filter((j) => j.match_category === "Good").length,
    awaiting_verification: jobs.filter((j) => j.status === "awaiting_verification").length,
    emailed: jobs.filter((j) => j.status === "emailed").length,
    rejected: jobs.filter((j) => j.status === "rejected").length,
    failed: jobs.filter((j) => /^(error|failed)/.test(j.status)).length,
    deferred: jobs.filter((j) => j.status === "deferred").length,
    score_buckets: buckets,
    reject_reasons: reasons,
  };
}

function normalizePayload(data) {
  const jobs = normalizeJobs(data?.jobs);
  const lr = data?.last_run && typeof data.last_run === "object" ? data.last_run : null;
  return {
    profile: data?.profile && typeof data.profile === "object" ? { name: str(data.profile.name, 80), updated_at: isoOrNull(data.profile.updated_at), skills: num(data.profile.skills), projects: num(data.profile.projects) } : null,
    last_run: lr
      ? {
          finished_at: isoOrNull(lr.finished_at),
          fetched: num(lr.stats?.fetched),
          unique: num(lr.stats?.unique),
          skipped_seen: num(lr.stats?.skipped_seen),
          emailed: num(lr.results?.emailed),
          errors: num(lr.results?.errors),
          source_errors: Array.isArray(lr.source_errors) ? lr.source_errors.slice(0, 8).map((e) => ({ source: str(e?.source, 60), message: str(e?.message, 200) })) : [],
        }
      : null,
    stats: buildStats(jobs, data?.stats),
    jobs,
  };
}

async function fromMock() {
  const raw = JSON.parse(await readFile(path.join(here, "sample-jobs.json"), "utf8"));
  const ago = (d) => new Date(Date.now() - d * 86400_000).toISOString();
  const jobs = raw.map(({ days_ago, ...j }) => ({ ...j, first_seen: ago(days_ago), posted_at: ago(days_ago + 1), emailed_at: j.status === "emailed" ? ago(days_ago) : null }));
  return normalizePayload({ profile: { name: "Sample Profile", updated_at: ago(3), skills: 18, projects: 4 }, last_run: { finished_at: ago(0.1), stats: { fetched: 84, unique: 61, skipped_seen: 40 }, results: { emailed: 1, errors: 1 }, source_errors: [] }, jobs });
}

async function fromN8n() {
  const data = await postToN8n("N8N_JOBS_WEBHOOK_URL", { action: "list" }, { timeoutMs: 30_000 });
  if (!data || data.ok !== true) throw Object.assign(new Error("n8n answered, but not with Job Hunter data. Check that N8N_JOBS_WEBHOOK_URL is the Dashboard API webhook of the AI Job Hunter workflow."), { status: 502, expose: true });
  return normalizePayload(data);
}

export const isMock = () => (process.env.JOBS_SOURCE || "mock") === "mock";

/** @param opts.fresh true for the Refresh button */
export async function getJobs({ fresh = false } = {}) {
  const source = process.env.JOBS_SOURCE || "mock";
  if (source === "mock") return fromMock();
  if (source !== "n8n") throw new Error(`Unknown JOBS_SOURCE "${source}"`);
  const ttl = Number(process.env.JOBS_CACHE_SECONDS ?? 60) * 1000;
  const maxAge = fresh ? Math.min(ttl, FRESH_MAX_AGE_MS) : ttl;
  if (maxAge > 0 && cache && Date.now() - cache.at < maxAge) return cache.data;
  if (inflight) return inflight;
  inflight = fromN8n()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

let lastRunAt = 0;
const RUN_COOLDOWN_MS = 60_000;

/** Starts the n8n pipeline. Refuses a second start within one minute so a double click cannot burn the Groq quota. */
export async function startRun() {
  if (isMock()) return { started: false, message: "Sample mode: set JOBS_SOURCE=n8n to run the real agent." };
  if (Date.now() - lastRunAt < RUN_COOLDOWN_MS) {
    throw Object.assign(new Error("A run was just started. Give it a minute."), { status: 429, expose: true });
  }
  lastRunAt = Date.now();
  try {
    await postToN8n("N8N_JOBS_WEBHOOK_URL", { action: "run" }, { timeoutMs: 20_000 });
  } catch (e) {
    lastRunAt = 0;
    throw e;
  }
  cache = null;
  return { started: true, message: "Run started. New results appear here in a few minutes; matching resumes arrive in your Gmail." };
}

export const clearJobsCache = () => {
  cache = null;
  lastRunAt = 0;
};