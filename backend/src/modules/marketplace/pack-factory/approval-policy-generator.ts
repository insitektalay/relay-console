import {
  action,
  blocked,
  type MarketplaceApprovalProfile,
} from "../catalog/marketplace-catalog.types";
import { classifyGeneratedPackRisk } from "./risk-classifier";
import { type MarketplacePackFactoryConfig } from "./types";

export function generateApprovalPolicy(config: MarketplacePackFactoryConfig) {
  const risk = classifyGeneratedPackRisk(config);
  const allowedActions = [
    action(
      "read_only_operations",
      "Read-only operations",
      `Read ${config.name} records, metadata, status, and operational state when credentials allow it.`,
    ),
    action(
      "draft_preparation",
      "Draft and preparation",
      `Draft ${config.name} actions, summaries, reports, and change plans without external side effects.`,
    ),
    action(
      "internal_summaries",
      "Internal summaries",
      `Create internal summaries from ${config.name} data without publishing or sending externally.`,
    ),
  ];
  const approvalRequiredActions = [
    action(
      "external_sending",
      "External sending",
      "Sending emails, messages, notifications, invites, or customer-facing communications requires approval.",
    ),
    action(
      "money_movement",
      "Money movement",
      "Charges, refunds, invoices, payouts, subscriptions, and billing state changes require approval.",
    ),
    action(
      "publishing_or_production_change",
      "Publishing or production change",
      "Publishing, deployment, production configuration, public content, or customer-facing changes require approval.",
    ),
    action(
      "deletion_or_destructive_change",
      "Deletion or destructive change",
      "Deleting records, files, projects, accounts, workspaces, or irreversible data requires approval unless blocked.",
    ),
    action(
      "permission_or_admin_change",
      "Permission or admin change",
      "Permission, role, admin, security, webhook, environment, or integration configuration changes require approval.",
    ),
    action(
      "bulk_operation",
      "Bulk operation",
      "Bulk updates, exports, sends, imports, or migrations require approval.",
    ),
    ...(config.highRiskActions ?? []).map((id) =>
      action(
        `provider_${id}`,
        titleFromId(id),
        `${config.name} action detected as high risk by provider metadata and requires approval.`,
      ),
    ),
  ];
  const blockedActions = [
    blocked(
      "expose_secrets",
      "Expose secrets",
      "API keys, tokens, webhook secrets, private keys, OAuth secrets, and encrypted secret payloads must never be exposed.",
    ),
    blocked(
      "disable_security",
      "Disable security controls",
      "Disabling security, fraud, compliance, audit, access, or safety controls is blocked by default.",
    ),
    blocked(
      "delete_account_workspace",
      "Delete accounts or workspaces",
      "Deleting provider accounts, workspaces, organizations, stores, repositories, or tenants is blocked by default.",
    ),
    blocked(
      "export_sensitive_data",
      "Export sensitive data",
      "Bulk export of customer, user, financial, health, legal, credential, or sensitive operational data is blocked by default.",
    ),
    blocked(
      "grant_broader_permissions",
      "Grant broader permissions",
      "Granting broader permissions, creating broader credentials, or expanding scopes is blocked by default.",
    ),
    blocked(
      "irreversible_destructive_action",
      "Irreversible destructive action",
      "Irreversible destructive actions are blocked unless a curated pack explicitly supports them.",
    ),
  ];
  const profiles: MarketplaceApprovalProfile[] = [
    {
      id: `${config.appSlug}_generated_read_only`,
      label: "Generated Read Only",
      description: "Generated draft profile. Reads and internal summaries only.",
      defaultSelected: false,
      allowedActions: allowedActions.filter((item) => item.id !== "draft_preparation"),
      approvalRequiredActions,
      blockedActions,
    },
    {
      id: `${config.appSlug}_generated_safe_operator`,
      label: "Generated Safe Operator",
      description:
        "Generated draft default. Allows reads, drafts, and internal preparation. External side effects require approval.",
      defaultSelected: true,
      allowedActions,
      approvalRequiredActions,
      blockedActions,
    },
    {
      id: `${config.appSlug}_generated_manager_approval`,
      label: "Generated Manager Approval",
      description:
        "Generated draft manager profile. Approval gates remain conservative until reviewed.",
      defaultSelected: false,
      allowedActions,
      approvalRequiredActions,
      blockedActions,
    },
  ];
  return {
    highRisk: risk.highRisk,
    detectedRiskTerms: risk.detectedTerms,
    allowedActions,
    approvalRequiredActions,
    blockedActions,
    approvalProfiles: profiles,
  };
}

function titleFromId(id: string) {
  return id
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
