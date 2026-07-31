import { capability } from "../../catalog/marketplace-catalog.types";

export const RAILWAY_CAPABILITIES = [
  capability("read", "Read Railway", "Read Railway workspaces, projects, environments, services, deployments, variables metadata, domains, and webhooks with bounded GraphQL queries.", true),
  capability("draft", "Draft Railway", "Prepare Railway GraphQL mutation plans for deployments, variables, service configuration, domains, or webhooks without side effects.", true),
  capability("write", "Write Railway", "Create or update selected Railway services, deployments, variables, domains, or webhooks after token/project scope and approval-policy checks.", false),
  capability("admin", "Admin Railway", "Operate Railway production deployments, variables/secrets, project/service settings, webhooks, domains, billing-sensitive resources, or destructive workflows under explicit approval.", false),
];
