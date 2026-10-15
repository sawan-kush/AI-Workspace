import type { FullEmail, MatchesResponse, Rule, RuleInput } from "./types";

const BASE = "/api/email-agent";

export class ApiError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(" "));
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, { headers: { "Content-Type": "application/json" }, ...init });
  } catch (e) {
    if (init?.signal?.aborted) throw e; // the page closed or a newer request replaced this one
    throw new ApiError(["Can't reach the backend. Is `npm run server` running?"]);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.errors ?? ["Request failed."]);
  return data as T;
}

const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  listRules: (signal?: AbortSignal) => request<{ rules: Rule[] }>("/rules", { signal }),
  createRule: (r: RuleInput) => request<{ rule: Rule }>("/rules", send("POST", r)),
  updateRule: (id: string, r: RuleInput) => request<{ rule: Rule }>(`/rules/${id}`, send("PUT", r)),
  setEnabled: (id: string, enabled: boolean) => request<{ rule: Rule }>(`/rules/${id}`, send("PATCH", { enabled })),
  deleteRule: (id: string) => request<void>(`/rules/${id}`, send("DELETE")),
  // refresh=1 tells the backend not to reuse an old cached answer (see server/email/source.js)
  getEmail: (id: string, signal?: AbortSignal) => request<{ email: FullEmail }>(`/emails/${encodeURIComponent(id)}`, { signal }),
  // Creates a draft for you to review. Nothing is ever sent.
  suggestReply: (id: string, signal?: AbortSignal) => request<{ draft: string }>(`/emails/${encodeURIComponent(id)}/draft`, { method: "POST", signal }),
  getMatches: (signal?: AbortSignal) => request<MatchesResponse>("/matches?refresh=1", { signal }),
};