export type Field = "sender_email" | "sender_name" | "sender_domain" | "subject" | "keyword" | "received_date";
export type Op = "equals" | "contains" | "on_or_after" | "on_or_before";

export interface Condition { field: Field; op: Op; value: string }
export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  /** How the conditions inside this rule combine. Separate rules always combine with OR. */
  operator: "AND" | "OR";
  conditions: Condition[];
}
export type RuleInput = Omit<Rule, "id">;

export interface MatchedEmail {
  email_id: string;
  sender: { name: string; email: string };
  subject: string;
  received_at: string;
  preview: string;
  matched_rule: string[];
}
export interface MatchesResponse {
  status: "ok" | "no_rules" | "no_match";
  message: string;
  /** When the backend last checked (ISO time). */
  updated_at: string;
  emails: MatchedEmail[];
}

/** One email opened in full (only emails that match your rules can be opened). */
export interface FullEmail {
  email_id: string;
  sender: { name: string; email: string };
  to: string;
  subject: string;
  received_at: string;
  body: string;
}

export const OP_LABELS: Record<Op, string> = {
  equals: "is",
  contains: "contains",
  on_or_after: "is on or after",
  on_or_before: "is on or before",
};

// Keep in sync with FIELDS in server/rules/validate.js (the server is the authority).
export const FIELDS: Record<Field, { label: string; ops: Op[]; type: "text" | "date"; placeholder: string }> = {
  sender_email: { label: "Sender email", ops: ["equals"], type: "text", placeholder: "name@example.com" },
  sender_name: { label: "Sender name", ops: ["contains", "equals"], type: "text", placeholder: "e.g. Placement Cell" },
  sender_domain: { label: "Sender organization (domain)", ops: ["equals"], type: "text", placeholder: "college.edu" },
  subject: { label: "Subject", ops: ["contains", "equals"], type: "text", placeholder: "e.g. Project Alpha" },
  keyword: { label: "Keyword (subject or body)", ops: ["contains"], type: "text", placeholder: "e.g. interview" },
  received_date: { label: "Received date", ops: ["on_or_after", "on_or_before"], type: "date", placeholder: "" },
};