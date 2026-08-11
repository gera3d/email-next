export type Goal = {
  id: string;
  name: string;
  description: string | null;
  cadence_limit_days: number | null;
  status: "active" | "paused" | "archived";
};

export type Contact = {
  id: string;
  canonical_email: string;
  display_name: string | null;
  company_domain: string | null;
  cooldown_until: string | null;
  last_contacted_at: string | null;
};

export type QueueItem = {
  id: string;
  goal_id: string;
  contact_id: string;
  reasoning_text: string | null;
  source_snippet: string | null;
  priority_score: number | null;
  draft_subject: string | null;
  draft_body: string | null;
  status: "pending" | "approved" | "sent" | "skipped" | "snoozed" | "resolved_elsewhere";
  contacts: Contact;
};
