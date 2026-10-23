import { useCallback, useEffect, useRef, useState } from "react";
import { getJobs, runNow } from "./api";
import type { JobsResponse } from "./types";

// The workflow runs once a day (or when you press Run now), so there is no fast polling: the page loads once, has a
// Refresh button, and refreshes itself when you come back to the tab after this many minutes.
const STALE_AFTER_MS = 10 * 60_000;

export function useJobsAgent() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const active = useRef<AbortController | null>(null);
  const lastOk = useRef(0);
  const loaded = useRef(false);

  const load = useCallback(async (manual: boolean) => {
    if (active.current && !active.current.signal.aborted) return;
    const ctrl = new AbortController();
    active.current = ctrl;
    if (loaded.current) setRefreshing(true);
    try {
      const res = await getJobs(manual, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setData(res);
      setError(null);
      setRefreshError(null);
      loaded.current = true;
      lastOk.current = Date.now();
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const message = e instanceof Error ? e.message : "Something went wrong.";
      if (loaded.current) setRefreshError(message);
      else setError(message);
    } finally {
      if (active.current === ctrl) active.current = null;
      if (!ctrl.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
    const onVisible = () => {
      if (!document.hidden && loaded.current && Date.now() - lastOk.current > STALE_AFTER_MS) void load(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      active.current?.abort();
    };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const run = useCallback(async () => {
    setRunning(true);
    setRunMessage(null);
    try {
      const r = await runNow();
      setRunMessage(r.message);
    } catch (e) {
      setRunMessage(e instanceof Error ? e.message : "Could not start the run.");
    } finally {
      setRunning(false);
    }
  }, []);

  return { data, loading, refreshing, error, refreshError, refresh, run, running, runMessage };
}