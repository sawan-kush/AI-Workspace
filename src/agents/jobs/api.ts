import type { JobsResponse } from "./types";

export class JobsApiError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (e) {
    if (init?.signal?.aborted) throw e;
    throw new JobsApiError("Can't reach the backend. Is `npm run server` running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new JobsApiError((data.errors ?? ["Request failed."]).join(" "));
  return data as T;
}

export const getJobs = (refresh: boolean, signal?: AbortSignal) =>
  call<JobsResponse>(`/api/jobs-agent/jobs${refresh ? "?refresh=1" : ""}`, { signal });

export const runNow = () => call<{ started: boolean; message: string }>("/api/jobs-agent/run", { method: "POST" });