import { useCallback, useEffect, useRef, useState } from "react";
import { getNews } from "./api";
import type { NewsResponse } from "./types";

// The n8n workflow only adds articles every few hours, so there is no fast polling here
// (every check is one n8n execution). The page loads once, has a Refresh button, and also
// refreshes by itself when you come back to the tab after this many minutes.
const STALE_AFTER_MS = 10 * 60_000;

export function useNewsAgent() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null); // nothing to show yet
  const [refreshError, setRefreshError] = useState<string | null>(null); // refresh failed, old results still shown

  const active = useRef<AbortController | null>(null);
  const lastOk = useRef(0);
  const loaded = useRef(false);

  const load = useCallback(async (manual: boolean) => {
    if (active.current && !active.current.signal.aborted) return; // never two requests at once
    const ctrl = new AbortController();
    active.current = ctrl;
    if (loaded.current) setRefreshing(true);
    try {
      const res = await getNews(manual, ctrl.signal);
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
      active.current?.abort(); // cancel anything still in flight
    };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  return { data, loading, refreshing, error, refreshError, refresh };
}