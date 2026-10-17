import type { NewsResponse } from "./types";

export class NewsApiError extends Error {}

/** refresh=1 tells the backend not to reuse an old cached answer (see server/news/source.js). */
export async function getNews(refresh: boolean, signal?: AbortSignal): Promise<NewsResponse> {
  let res: Response;
  try {
    res = await fetch(`/api/news-agent/articles${refresh ? "?refresh=1" : ""}`, { signal });
  } catch (e) {
    if (signal?.aborted) throw e; // the page closed or a newer request replaced this one
    throw new NewsApiError("Can't reach the backend. Is `npm run server` running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new NewsApiError((data.errors ?? ["Request failed."]).join(" "));
  return data as NewsResponse;
}