import { capability } from "../../catalog/marketplace-catalog.types";

export const POSTHOG_CAPABILITIES = [
  capability("read", "Read PostHog", "Read PostHog projects, events, persons, groups, insights, funnels, dashboards, cohorts, feature flags, session replays, and CDP destinations with bounded queries.", true),
  capability("draft", "Draft PostHog", "Prepare PostHog feature-flag, cohort, insight, dashboard, annotation, export, or CDP destination change plans without side effects.", true),
  capability("write", "Write PostHog", "Create or update selected PostHog insights, dashboards, cohorts, feature flags, annotations, destinations, or project settings after scope and approval-policy checks.", false),
  capability("admin", "Admin PostHog", "Operate PostHog feature rollouts, privacy-sensitive exports, CDP destinations, webhooks, project settings, sharing, permissions, billing, or destructive workflows under explicit approval.", false),
];
