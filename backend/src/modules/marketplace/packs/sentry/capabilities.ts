import { capability } from "../../catalog/marketplace-catalog.types";

export const SENTRY_CAPABILITIES = [
  capability("read", "Read Sentry", "Read Sentry organizations, projects, issues, events, releases, deploys, teams, alert rules, and webhooks with bounded queries.", true),
  capability("draft", "Draft Sentry", "Prepare Sentry issue-state, release/deploy, alert-rule, team/project, integration, or webhook change plans without side effects.", true),
  capability("write", "Write Sentry", "Update selected Sentry issues, releases, alerts, teams, projects, or webhooks after scope and approval-policy checks.", false),
  capability("admin", "Admin Sentry", "Operate Sentry project/team settings, alert rules, webhooks, integrations, member permissions, privacy-sensitive exports, or destructive workflows under explicit approval.", false),
];
