import { useMemo, useState } from "react";
import { ExternalLink, FileText, Play, RefreshCw, Upload, Briefcase } from "lucide-react";
import { useJobsAgent } from "./useJobsAgent";
import type { Job } from "./types";
import "./jobs.css";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "date not given");

const STATUS_LABEL: Record<string, string> = {
  emailed: "Resume emailed",
  awaiting_verification: "Check eligibility",
  deferred: "Queued for next run",
  rejected: "Rejected",
  failed: "Failed",
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? (s.startsWith("error") ? "Error - will retry" : s);
const VERIFY_LABEL: Record<string, string> = {
  employer_ats: "Employer career page",
  board_link_live: "Job board - employer not verified",
  unverified: "Not verified",
  expired: "Looks expired",
};
const REASON_LABEL: Record<string, string> = {
  senior_role: "Senior role",
  experience_required: "Needs more experience",
  unpaid: "Unpaid",
  location_mismatch: "Location",
  location_not_open_to_india: "Not open to India",
  eligibility_mismatch: "Eligibility mismatch",
  not_open_to_india: "Not open to India",
  low_score: "Low match score",
  expired: "Expired",
  repeated_repost: "Repeated repost",
  job_type_excluded: "Job type excluded",
};
const reason = (r: string) => REASON_LABEL[r] ?? (r.startsWith("suspicious_url") ? "Suspicious link" : r.replace(/_/g, " "));

const DATE_RANGES: Record<string, number> = { any: 0, "1": 1, "7": 7, "30": 30 };

export default function JobsAgentPage() {
  const { data, loading, refreshing, error, refreshError, refresh, run, running, runMessage } = useJobsAgent();
  const [minScore, setMinScore] = useState(0);
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState("all");
  const [source, setSource] = useState("all");
  const [range, setRange] = useState("any");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const jobs = data?.jobs ?? [];
  const sources = useMemo(() => [...new Set(jobs.map((j) => j.source).filter(Boolean))].sort(), [jobs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = DATE_RANGES[range] ? Date.now() - DATE_RANGES[range] * 86400_000 : 0;
    return jobs.filter((j) => {
      if (minScore > 0 && (j.score ?? -1) < minScore) return false;
      if (status !== "all" && !(status === "error" ? /^(error|failed)/.test(j.status) : j.status === status)) return false;
      if (mode !== "all" && j.work_mode !== mode) return false;
      if (source !== "all" && j.source !== source) return false;
      if (cutoff && Date.parse(j.first_seen ?? "") < cutoff) return false;
      if (q && !`${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, minScore, status, mode, source, range, query]);

  if (loading) return <div className="panel empty">Loading…</div>;
  if (error || !data) {
    return (
      <div className="panel empty">
        <p>{error}</p>
        <button className="btn btn-light" onClick={refresh}>Try again</button>
      </div>
    );
  }

  const { stats, last_run: lr, profile } = data;
  const maxBucket = Math.max(1, ...stats.score_buckets);
  const tiles: [string, number][] = [
    ["Jobs saved", stats.stored_jobs], ["Excellent", stats.excellent], ["Good", stats.good], ["Emailed", stats.emailed],
    ["Check eligibility", stats.awaiting_verification], ["Rejected", stats.rejected], ["Failed / retrying", stats.failed],
  ];

  return (
    <div className="jobs-agent">
      {data.mode === "sample" && <p className="panel jobs-sample" role="note">Showing SAMPLE data. Set <code>JOBS_SOURCE=n8n</code> in <code>.env</code> to see your real jobs.</p>}

      <div className="section-head">
        <h2>Job Hunter {shown.length !== jobs.length ? `(${shown.length} of ${jobs.length})` : `(${jobs.length})`}</h2>
        <div className="jobs-actions">
          {data.upload_url && <a className="btn btn-dark btn-sm" href={data.upload_url} target="_blank" rel="noopener noreferrer"><Upload size={16} aria-hidden /> {profile ? "Update resume" : "Upload resume"}</a>}
          <button className="btn btn-dark btn-sm" onClick={run} disabled={running} title="Starts the n8n workflow now"><Play size={16} aria-hidden /> {running ? "Starting…" : "Run now"}</button>
          <button className="btn btn-light btn-sm" onClick={refresh} disabled={refreshing}><RefreshCw size={16} aria-hidden className={refreshing ? "spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
      </div>
      <p className={`sync-status ${refreshError ? "warn" : ""}`} role="status" aria-live="polite">
        <span className="dot" aria-hidden />
        {refreshError ? `Couldn't refresh: ${refreshError} Showing the last results.` : `Updated ${new Date(data.updated_at).toLocaleTimeString()} · the agent runs once a day and never applies for you`}
      </p>
      {runMessage && <p className="panel jobs-note" role="status">{runMessage}</p>}

      <div className="jobs-info">
        <span>{profile ? <>Resume profile: <b>{profile.name || "saved"}</b> · {profile.skills} skills · {profile.projects} projects · updated {day(profile.updated_at)}</> : <b>No resume profile yet. Upload your resume first.</b>}</span>
        {lr && <span>Last run {when(lr.finished_at)}: {lr.fetched} listings, {lr.unique} unique, {lr.emailed} emailed, {lr.errors} errors</span>}
      </div>
      {lr && lr.source_errors.length > 0 && <p className="panel jobs-note warn">Source problems: {lr.source_errors.map((s) => `${s.source} (${s.message})`).join("; ")}</p>}

      <div className="jobs-tiles">
        {tiles.map(([label, n]) => <div key={label} className="panel jobs-tile"><b>{n}</b><span>{label}</span></div>)}
      </div>

      <div className="jobs-grid2">
        <div className="panel">
          <h3>Match score distribution</h3>
          <div className="jobs-bars" role="img" aria-label="Number of jobs per score band">
            {stats.score_buckets.map((n, i) => (
              <div key={i} className="jobs-bar"><i style={{ height: `${(n / maxBucket) * 100}%` }} title={`${n} jobs`} /><span>{i * 10}</span></div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3>Why jobs were rejected</h3>
          {Object.keys(stats.reject_reasons).length === 0 ? <p className="muted">Nothing rejected yet.</p> : (
            <ul className="jobs-reasons">
              {Object.entries(stats.reject_reasons).sort((a, b) => b[1] - a[1]).map(([r, n]) => <li key={r}><span>{reason(r)}</span><b>{n}</b></li>)}
            </ul>
          )}
        </div>
      </div>

      <div className="panel jobs-filters">
        <label>Min score <b>{minScore}</b><input type="range" min={0} max={100} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} /></label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option><option value="emailed">Emailed</option><option value="awaiting_verification">Check eligibility</option>
            <option value="deferred">Queued</option><option value="rejected">Rejected</option><option value="error">Failed / retrying</option>
          </select>
        </label>
        <label>Work mode
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">All</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option><option value="unknown">Unknown</option>
          </select>
        </label>
        <label>Source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All</option>{sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Found
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="any">Any time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option>
          </select>
        </label>
        <label className="grow">Role, company or location<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. NLP, Pune" /></label>
      </div>

      {shown.length === 0 ? (
        <div className="panel empty">
          <Briefcase size={28} aria-hidden />
          <p>{jobs.length === 0 ? "No jobs saved yet. Upload your resume, then press Run now." : "No jobs match these filters."}</p>
        </div>
      ) : (
        <ul className="jobs-list">
          {shown.map((j) => <JobCard key={j.id} job={j} expanded={open === j.id} onToggle={() => setOpen(open === j.id ? null : j.id)} />)}
        </ul>
      )}
    </div>
  );
}

function JobCard({ job: j, expanded, onToggle }: { job: Job; expanded: boolean; onToggle: () => void }) {
  return (
    <li className={`panel job-card st-${j.status.startsWith("error") ? "error" : j.status}`}>
      <div className="job-head">
        <div>
          <h3>{j.title}</h3>
          <p className="job-sub">{j.company} · {j.location || "location not stated"} · {j.work_mode === "unknown" ? "mode not stated" : j.work_mode}{j.job_type ? ` · ${j.job_type.replace(/_/g, " ")}` : ""}</p>
        </div>
        <div className={`job-score cat-${(j.match_category ?? "none").toLowerCase()}`} aria-label={j.score === null ? "Not scored" : `Score ${j.score} of 100`}>
          <b>{j.score ?? "—"}</b><span>{j.match_category ?? "not scored"}</span>
        </div>
      </div>
      <div className="tags">
        <span className="tag">{statusLabel(j.status)}</span>
        <span className={`tag tag-v-${j.verification}`}>{VERIFY_LABEL[j.verification]}</span>
        <span className="tag tag-grey">{j.source}</span>
        {j.reject_reasons.map((r) => <span key={r} className="tag tag-grey">{reason(r)}</span>)}
      </div>
      {j.error && <p className="job-error">{j.error}{j.retry_count ? ` (attempt ${j.retry_count})` : ""}</p>}
      <div className="job-bottom">
        <span className="muted">Found {day(j.first_seen)} · posted {day(j.posted_at)}{j.emailed_at ? ` · emailed ${day(j.emailed_at)}` : ""}</span>
        <div className="jobs-actions">
          {(j.why || j.matched.length > 0 || j.missing.length > 0) && <button className="btn btn-dark btn-sm" onClick={onToggle} aria-expanded={expanded}>{expanded ? "Hide details" : "Details"}</button>}
          {j.apply_url && <a className="btn btn-light btn-sm" href={j.apply_url} target="_blank" rel="noopener noreferrer">Original listing <ExternalLink size={14} aria-hidden /></a>}
        </div>
      </div>
      {expanded && (
        <div className="job-details">
          {j.why && <p><b>Why:</b> {j.why}</p>}
          {j.matched.length > 0 && <p><b>Matching:</b> {j.matched.join(", ")}</p>}
          {j.missing.length > 0 && <p><b>Missing:</b> {j.missing.join(", ")}</p>}
          {j.concerns.length > 0 && <p><b>Eligibility concerns:</b> {j.concerns.join(" ")}</p>}
          <p><b>Verification:</b> {j.verification_note || VERIFY_LABEL[j.verification]}{j.confidence ? ` · assessment confidence: ${j.confidence}` : ""}</p>
          {j.resume_filename && <p><FileText size={14} aria-hidden /> Tailored resume sent to your Gmail as <code>{j.resume_filename}</code></p>}
        </div>
      )}
    </li>
  );
}