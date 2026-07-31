import { capability } from "../../catalog/marketplace-catalog.types";

export const LINEAR_CAPABILITIES = [
  capability("read", "Read Linear", "Read Linear issues, teams, workflow states, projects, cycles, comments, labels, users, and relations with bounded GraphQL queries and explicit organization/team context.", true),
  capability("draft", "Draft Linear", "Prepare exact Linear issueCreate, issueUpdate, commentCreate, project/cycle update, relation, attachment, or webhook payloads without side effects.", true),
  capability("write", "Write Linear", "Create/update Linear issues, comments, project/cycle fields, labels, relations, and assignments after scope and approval-policy checks.", false),
  capability("admin", "Admin Linear", "Operate Linear OAuth scopes, webhooks, team/workflow/label configuration, project milestones, issue archive workflows, or bulk organization operations under explicit approval.", false),
];
