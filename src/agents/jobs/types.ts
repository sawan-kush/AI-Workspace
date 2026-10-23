export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";
export type Verification = "employer_ats" | "board_link_live" | "unverified" | "expired";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  work_mode: WorkMode;
  job_type: string;
  source: string;
  posted_at: string | null;
  first_seen: string | null;
  /** emailed | awaiting_verification | deferred | rejected | error_* | failed */
  status: string;
  /** 0-100, or null when the job was rejected by rules before scoring. */
  score: number | null;
  match_category: "Excellent" | "Good" | "Moderate" | "Poor" | null;
  matched: string[];
  missing: string[];
  concerns: string[];
  reject_reasons: string[];
  why: string;
  verification: Verification;
  verification_note: string;
  confidence: "high" | "medium" | "low" | null;
  /** Original application link (employer page when verification is employer_ats). */
  apply_url: string;
  resume_filename: string | null;
  emailed_at: string | null;
  error: string | null;
  retry_count: number;
}

export interface JobStats {
  stored_jobs: number;
  excellent: number;
  good: number;
  awaiting_verification: number;
  emailed: number;
  rejected: number;
  failed: number;
  deferred: number;
  score_buckets: number[];
  reject_reasons: Record<string, number>;
}

export interface JobsResponse {
  mode: "sample" | "live";
  updated_at: string;
  upload_url: string;
  profile: { name: string; updated_at: string | null; skills: number; projects: number } | null;
  last_run: { finished_at: string | null; fetched: number; unique: number; skipped_seen: number; emailed: number; errors: number; source_errors: { source: string; message: string }[] } | null;
  stats: JobStats;
  jobs: Job[];
}