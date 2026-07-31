import { capability } from "../../catalog/marketplace-catalog.types";

export const VERCEL_CAPABILITIES = [
  capability("read", "Read Vercel", "Read Vercel teams, projects, deployments, domains, aliases, environment-variable metadata, build logs, access roles, integrations, and webhooks with bounded queries.", true),
  capability("draft", "Draft Vercel", "Prepare exact Vercel project, deployment, domain, alias, environment variable, team/member, protection, integration, or webhook payloads without side effects.", true),
  capability("write", "Write Vercel", "Create/update Vercel projects, aliases, domains, deployments, and environment variables after token/team permission and approval checks.", false),
  capability("admin", "Admin Vercel", "Operate Vercel production deployments/promotions, env vars/secrets, domain/alias takeover, project deletion, team/member changes, webhooks, billing/team configuration, and destructive operations under approval.", false),
];
