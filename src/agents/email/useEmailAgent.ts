import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { MatchesResponse, Rule } from "./types";

/** Loads the rules and the emails they match. Call refresh() after any change to a rule. */
export function useEmailAgent() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [matches, setMatches] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([api.listRules(), api.getMatches()]);
      setRules(r.rules);
      setMatches(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { rules, matches, loading, error, refresh };
}