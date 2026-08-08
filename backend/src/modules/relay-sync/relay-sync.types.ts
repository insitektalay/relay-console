export const RELAY_SYNC_CONTRACT_VERSION = "2026-07-21.agent-parity.v2";

export const RELAY_SYNC_OBJECT_TYPES = [
  "profile",
  "workspace",
  "agent",
  "agent_preference",
  "agent_document",
  "thread",
  "thread_session",
  "thread_participant",
  "message",
  "read_state",
  "thread_archive",
  "thread_wrap_up",
  "task",
  "run",
  "runtime_event",
  "artifact",
  "approval",
  "application_connection",
  "application_install",
  "application_assignment",
  "application_policy",
  "attachment",
  "dispatch_status",
] as const;

export type RelaySyncObjectType = (typeof RELAY_SYNC_OBJECT_TYPES)[number];

export const MARKETPLACE_EXECUTION_AUTHORITY_VERSION =
  "marketplace-execution-authority.v1";
export const MARKETPLACE_EXECUTION_AUTHORITIES = ["railway"] as const;
export type MarketplaceExecutionAuthority =
  (typeof MARKETPLACE_EXECUTION_AUTHORITIES)[number];

export interface RelaySyncRecordInput {
  objectType: RelaySyncObjectType;
  objectId: string;
  operation?: "upsert" | "delete";
  baseServerVersion?: string | number | null;
  payload: Record<string, unknown>;
  dependencies?: string[];
  historical?: boolean;
}

export interface RelayMutationInput extends RelaySyncRecordInput {
  clientMutationId: string;
}

export const FORBIDDEN_SYNC_KEY_PATTERN =
  /(^|_)((secret|token|password|credential)s?|keychain|runtime_home|hermes_home|openclaw_home|workspace_root|absolute_path|database_path|path|log_content)($|_)/i;

export function assertSafeSyncPayload(value: unknown, path = "payload"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSafeSyncPayload(item, `${path}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[.-]/g, "_");
    // Marketplace sync records must explicitly prove that they contain no
    // secret material. This boolean is contract metadata, not a secret value;
    // every truthy or malformed form remains forbidden by the authority check.
    if (
      normalizedKey.toLowerCase() === "secret_material_synchronized" &&
      child === false
    ) {
      continue;
    }
    if (FORBIDDEN_SYNC_KEY_PATTERN.test(normalizedKey)) {
      throw new Error(`SYNC_PAYLOAD_FORBIDDEN_FIELD:${path}.${key}`);
    }
    assertSafeSyncPayload(child, `${path}.${key}`);
  }
}

export function assertMarketplaceExecutionAuthorityPayload(
  objectType: RelaySyncObjectType,
  operation: "upsert" | "delete",
  payload: Record<string, unknown>,
): void {
  if (
    operation === "delete" ||
    ![
      "application_connection",
      "application_install",
      "application_assignment",
      "application_policy",
    ].includes(objectType)
  )
    return;
  if (typeof payload.appSlug !== "string" || !payload.appSlug.trim()) {
    throw new Error("MARKETPLACE_EXECUTION_AUTHORITY_APP_SLUG_INVALID");
  }
  if (
    !MARKETPLACE_EXECUTION_AUTHORITIES.includes(
      payload.executionAuthority as MarketplaceExecutionAuthority,
    )
  ) {
    throw new Error("MARKETPLACE_EXECUTION_AUTHORITY_INVALID");
  }
  if (payload.executionAuthority !== "railway") {
    throw new Error("MARKETPLACE_EXECUTION_AUTHORITY_RAILWAY_REQUIRED");
  }
  if (
    payload.executionAuthorityVersion !==
    MARKETPLACE_EXECUTION_AUTHORITY_VERSION
  ) {
    throw new Error("MARKETPLACE_EXECUTION_AUTHORITY_VERSION_INVALID");
  }
  if (payload.secretMaterialSynchronized !== false) {
    throw new Error("MARKETPLACE_SYNC_SECRET_BOUNDARY_INVALID");
  }
  if (
    payload.executionAuthority === "railway" &&
    payload.executionAvailability !== "railway_broker_required"
  ) {
    throw new Error("MARKETPLACE_RAILWAY_AUTHORITY_AVAILABILITY_INVALID");
  }
}
