import type { ComponentType, LazyExoticComponent } from "react";
import type { LucideIcon } from "lucide-react";

export type AgentStatus = "live" | "coming-soon";

export interface AgentDefinition {
  id: string; // used in the URL: /agent/<id>
  title: string;
  description: string;
  status: AgentStatus;
  icon: LucideIcon;
  /** Two colours for the card gradient. */
  accent: [string, string];
  /** Only live agents provide a page. */
  page?: LazyExoticComponent<ComponentType>;
}
