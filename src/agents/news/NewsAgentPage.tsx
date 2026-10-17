import { useMemo, useState } from "react";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { useNewsAgent } from "./useNewsAgent";
import { CATEGORIES } from "./types";
import "./news.css";

const NEW_WITHIN_MS = 6 * 3600_000; // "New" badge for articles saved in the last 6 hours
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function NewsAgentPage() {
  const { data, loading, refreshing, error, refreshError, refresh } = useNewsAgent();
  const [category, setCategory] = useState<string>("All");

  const articles = data?.articles ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of articles) c[a.category] = (c[a.category] ?? 0) + 1;
    return c;
  }, [articles]);
  const shown = category === "All" ? articles : articles.filter((a) => a.category === category);

  if (loading) return <div className="panel empty">Loading…</div>;
  if (error) {
    return (
      <div className="panel empty">
        <p>{error}</p>
        <button className="btn btn-light" onClick={refresh}>Try again</button>
      </div>
    );
  }

  return (
    <div className="news-agent">
      <div className="section-head">
        <h2>Latest AI &amp; ML news{articles.length > 0 ? ` (${shown.length})` : ""}</h2>
        <button className="btn btn-light btn-sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={16} aria-hidden className={refreshing ? "spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className={`sync-status ${refreshError ? "warn" : ""}`} role="status" aria-live="polite">
        <span className="dot" aria-hidden />
        {refreshError
          ? `Couldn't refresh: ${refreshError} Showing the last results.`
          : `Updated ${data ? new Date(data.updated_at).toLocaleTimeString() : "…"} · new articles are collected automatically every few hours`}
      </p>

      {articles.length > 0 && (
        <div className="news-filters" role="group" aria-label="Filter by category">
          {["All", ...CATEGORIES].map((c) => {
            const n = c === "All" ? articles.length : counts[c] ?? 0;
            return (
              <button key={c} className={`news-chip ${category === c ? "on" : ""}`} aria-pressed={category === c}
                onClick={() => setCategory(c)} disabled={n === 0 && c !== "All"}>
                {c} <span>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="panel empty">
          <Newspaper size={28} aria-hidden />
          <p>{articles.length === 0 ? data?.message : "No articles in this category yet."}</p>
        </div>
      ) : (
        <ul className="news-list">
          {shown.map((a) => {
            const isNew = Date.now() - Date.parse(a.added_at) < NEW_WITHIN_MS;
            return (
              <li key={a.id} className={`panel news-card ${isNew ? "is-new" : ""}`}>
                <div className="news-top">
                  <span className="news-source">{a.source}</span>
                  <time dateTime={a.published_at}>{when(a.published_at)}</time>
                </div>
                <h3>
                  <a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
                  {isNew && <span className="tag-new">New</span>}
                </h3>
                {a.summary && <p className="preview">{a.summary}</p>}
                <div className="news-bottom">
                  <span className="tag">{a.category}</span>
                  <a className="btn btn-dark btn-sm" href={a.url} target="_blank" rel="noopener noreferrer">
                    Read original <ExternalLink size={14} aria-hidden />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}