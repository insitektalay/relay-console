import type { MarketplaceApprovalProfile } from "./catalog/marketplace-catalog.types";

export const DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID =
  "dangerously_skip_permissions";

export const DANGEROUS_POLICY_ACKNOWLEDGEMENT_VERSION =
  "relay-marketplace-dangerous-policy-v1";

export const DANGEROUS_POLICY_PRESERVED_INVARIANTS = [
  "workspace_and_connection_ownership",
  "provider_authentication_and_granted_authority",
  "selected_capabilities_and_blocked_actions",
  "fixed_provider_origins_and_request_bounds",
  "provider_and_relay_rate_limits",
  "audit_evidence_and_truthful_results",
  "secret_non_exposure",
] as const;

export const DANGEROUSLY_SKIP_PERMISSIONS_PROFILE: MarketplaceApprovalProfile =
  {
    id: DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
    label: "Dangerously skip permissions",
    description:
      "Allow this agent to run every selected provider-supported connector action without per-action Relay Console approval. Authentication, connection ownership, provider-granted authority, selected capabilities, provider limits, evidence, and secret non-exposure still apply.",
    defaultSelected: false,
    allowedActions: [],
    approvalRequiredActions: [],
    blockedActions: [],
  };

export function isDangerouslySkipPermissionsPolicy(value: unknown): boolean {
  return value === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID;
}

export function withUniversalMarketplaceApprovalProfiles<
  T extends MarketplaceApprovalProfile,
>(profiles: T[]): Array<T | MarketplaceApprovalProfile> {
  if (
    profiles.some((profile) => isDangerouslySkipPermissionsPolicy(profile.id))
  ) {
    return profiles;
  }
  return [...profiles, DANGEROUSLY_SKIP_PERMISSIONS_PROFILE];
}
