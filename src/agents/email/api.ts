import type { MatchesResponse, Rule, RuleInput } from "./types";

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
  } catch {
    throw new ApiError(["Can't reach the backend. Is `npm run server` running?"]);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.errors ?? ["Request failed."]);
  return data as T;
}

const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  listRules: () => request<{ rules: Rule[] }>("/rules"),
  createRule: (r: RuleInput) => request<{ rule: Rule }>("/rules", send("POST", r)),
  updateRule: (id: string, r: RuleInput) => request<{ rule: Rule }>(`/rules/${id}`, send("PUT", r)),
  setEnabled: (id: string, enabled: boolean) => request<{ rule: Rule }>(`/rules/${id}`, send("PATCH", { enabled })),
  deleteRule: (id: string) => request<void>(`/rules/${id}`, send("DELETE")),
  getMatches: () => request<MatchesResponse>("/matches"),
};