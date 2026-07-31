export const RELAY_CLOUD_WRITABLE_STATUSES = Object.freeze([
  "active",
  "grace",
] as const);

export type RelayCloudEntitlementWindow = {
  status: string;
  trialEndsAt?: Date | string | null;
  graceEndsAt?: Date | string | null;
  readOnlyAt?: Date | string | null;
  currentPeriodEndsAt?: Date | string | null;
};

// Both scheduled-message queries use workspace/batch as $1 and the status
// array as $2. Keep the timestamp checks in one fixed SQL fragment so queued
// work cannot outlive the same entitlement window enforced by HTTP and WSS.
export const RELAY_CLOUD_WRITABLE_SQL_PREDICATE = `
  subscription.status = ANY($2::text[])
  AND (
    subscription.status <> 'grace'
    OR (
      subscription."graceEndsAt" > NOW()
      AND subscription."readOnlyAt" > NOW()
    )
  )
  AND (
    subscription."readOnlyAt" IS NULL
    OR subscription."readOnlyAt" > NOW()
  )
  AND (
    subscription.status <> 'active'
    OR subscription."currentPeriodEndsAt" IS NULL
    OR subscription."currentPeriodEndsAt" > NOW()
  )
`;

export function isRelayCloudWritableStatus(status: string) {
  return (RELAY_CLOUD_WRITABLE_STATUSES as readonly string[]).includes(status);
}

export function isRelayCloudWritableEntitlement(
  entitlement: RelayCloudEntitlementWindow,
  now = new Date(),
) {
  if (!isRelayCloudWritableStatus(entitlement.status)) return false;
  const nowMs = now.getTime();
  const afterNow = (value: Date | string | null | undefined) => {
    if (!value) return false;
    const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(timestamp) && timestamp > nowMs;
  };
  const reached = (value: Date | string | null | undefined) => {
    if (!value) return false;
    const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(timestamp) && timestamp <= nowMs;
  };

  if (reached(entitlement.readOnlyAt)) return false;
  if (entitlement.status === "grace") {
    return (
      afterNow(entitlement.graceEndsAt) && afterNow(entitlement.readOnlyAt)
    );
  }
  if (
    entitlement.status === "active" &&
    entitlement.currentPeriodEndsAt &&
    !afterNow(entitlement.currentPeriodEndsAt)
  ) {
    return false;
  }
  return true;
}
