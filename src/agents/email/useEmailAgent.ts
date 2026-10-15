import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { MatchesResponse, Rule } from "./types";

// How often to check for new mail while the page is open. Every check is one n8n execution,
// so it never goes below 10 seconds. Override with VITE_EMAIL_POLL_SECONDS in .env if you like.
const clamp = (n: number) => (Number.isFinite(n) ? Math.max(10, n) : 30);
export const POLL_SECONDS = clamp(Number(import.meta.env.VITE_EMAIL_POLL_SECONDS ?? 30));
const POLL_MS = POLL_SECONDS * 1000;
const MAX_BACKOFF_MS = 5 * 60_000; // after repeated failures, wait longer between tries (up to 5 min)
const NEW_BADGE_MS = 12_000; // how long the "New" badge stays on a freshly arrived email

type Mode = "initial" | "manual" | "poll";

/**
 * Loads the rules and the emails they match, and keeps the emails up to date while the page is open.
 *  - Checks every POLL_SECONDS; pauses while the browser tab is hidden and checks right away when you return.
 *  - Never runs two requests at once. A rule change made during a check is refreshed right after it.
 *  - Stops completely (and cancels any request in flight) when the page closes.
 *  - If a refresh fails it keeps showing the last results and retries with a growing delay.
 * Call refresh() after any change to a rule.
 */
export function useEmailAgent() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [matches, setMatches] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // nothing to show yet
  const [refreshError, setRefreshError] = useState<string | null>(null); // a refresh failed, old results still shown
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const active = useRef<AbortController | null>(null); // the request in flight, if any
  const rerun = useRef(false);
  const loaded = useRef(false);
  const failures = useRef(0);
  const seen = useRef<Set<string> | null>(null);
  const flashTimer = useRef<number>();

  const flash = useCallback((ids: string[]) => {
    setNewIds((prev) => new Set([...prev, ...ids]));
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setNewIds(new Set()), NEW_BADGE_MS);
  }, []);

  const run = useCallback(
    async (mode: Mode) => {
      // No overlapping requests. A rule change (not a background poll) asks for one more refresh afterwards.
      if (active.current && !active.current.signal.aborted) {
        if (mode !== "poll") rerun.current = true;
        return;
      }
      const ctrl = new AbortController();
      active.current = ctrl;
      try {
        const needRules = mode !== "poll" || !loaded.current;
        const [r, m] = await Promise.all([needRules ? api.listRules(ctrl.signal) : null, api.getMatches(ctrl.signal)]);
        if (ctrl.signal.aborted) return;

        // Only emails that newly appear during background checks get the "New" badge.
        const ids = new Set(m.emails.map((e) => e.email_id));
        if (mode === "poll" && seen.current) {
          const added = m.emails.filter((e) => !seen.current!.has(e.email_id)).map((e) => e.email_id);
          if (added.length) flash(added);
        } else {
          setNewIds(new Set());
        }
        seen.current = ids;

        if (r) setRules(r.rules);
        setMatches(m);
        setUpdatedAt(new Date(m.updated_at));
        setError(null);
        setRefreshError(null);
        loaded.current = true;
        failures.current = 0;
      } catch (e) {
        if (ctrl.signal.aborted) return;
        failures.current += 1;
        const message = e instanceof Error ? e.message : "Something went wrong.";
        if (loaded.current) setRefreshError(message);
        else setError(message);
      } finally {
        if (active.current === ctrl) active.current = null;
        if (!ctrl.signal.aborted) {
          setLoading(false);
          if (rerun.current) {
            rerun.current = false;
            void run("manual");
          }
        }
      }
    },
    [flash]
  );

  // First load
  useEffect(() => {
    void run("initial");
  }, [run]);

  // Live refresh
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    const schedule = () => {
      window.clearTimeout(timer); // always exactly one timer, even if two checks finish together
      if (stopped) return;
      const delay = Math.min(POLL_MS * 2 ** failures.current, MAX_BACKOFF_MS);
      timer = window.setTimeout(tick, delay);
    };
    const tick = async () => {
      if (!document.hidden) await run("poll");
      schedule();
    };
    const onVisibility = () => {
      if (!document.hidden && !stopped) void tick(); // back on the tab: catch up now
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      active.current?.abort(); // cancel anything still in flight
      rerun.current = false;
      window.clearTimeout(flashTimer.current);
    };
  }, [run]);

  const refresh = useCallback(() => run("manual"), [run]);

  return { rules, matches, loading, error, refreshError, updatedAt, newIds, refresh };
}