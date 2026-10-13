import { lazy } from "react";
import { Mail, Briefcase, Newspaper, Share2 } from "lucide-react";
import type { AgentDefinition } from "./types";

/**
 * THE ONLY FILE YOU EDIT TO ADD A NEW AGENT.
 * 1. Build its page under src/agents/<name>/
 * 2. Add one entry below with status "live" and a lazy `page`.
 * The dashboard, routing and cards pick it up automatically.
 */
export const agents: AgentDefinition[] = [
  {
    id: "email",
    title: "Specific Email Agent",
    description: "Shows only the emails that match the rules you set. Nothing else from your inbox.",
    status: "live",
    icon: Mail,
    accent: ["#8f1d2c", "#3b1a4a"],
    page: lazy(() => import("./email/EmailAgentPage")),
  },
  {
    id: "jobs",
    title: "Job Hunter",
    description: "Finds jobs and internships that fit your profile.",
    status: "coming-soon",
    icon: Briefcase,
    accent: ["#4a2a8f", "#1d2f6b"],
  },
  {
    id: "news",
    title: "News Analyzer",
    description: "Finds and summarizes the news you care about.",
    status: "coming-soon",
    icon: Newspaper,
    accent: ["#1d4a6b", "#14283d"],
  },
  {
    id: "social",
    title: "Social Media Agent",
    description: "Keeps your social media tasks organized in one list.",
    status: "coming-soon",
    icon: Share2,
    accent: ["#9a3a1c", "#4a1a1a"],
  },
];

export const getAgent = (id: string) => agents.find((a) => a.id === id);
