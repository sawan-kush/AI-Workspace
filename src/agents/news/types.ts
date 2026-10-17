export const CATEGORIES = ["Model Releases", "Tools & Libraries", "Company News", "Research", "Industry"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface NewsArticle {
  id: string;
  title: string;
  /** One-sentence summary written by the LLM in n8n. */
  summary: string;
  source: string;
  category: Category;
  /** Link to the original article. */
  url: string;
  /** When the source published it (ISO time). */
  published_at: string;
  /** When the workflow saved it (ISO time). */
  added_at: string;
}

export interface NewsResponse {
  status: "ok" | "empty";
  message: string;
  /** When the backend last read the news (ISO time). */
  updated_at: string;
  articles: NewsArticle[];
}