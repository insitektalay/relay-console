export const EXECUTION_UNAVAILABLE_REASONS = [
  "agent_inactive",
  "identity_suppressed",
  "binding_missing",
  "binding_disabled",
  "ownership_inactive",
  "assignment_epoch_invalid",
  "host_missing",
  "host_inactive",
  "host_stale",
] as const;

export type ExecutionUnavailableReason =
  (typeof EXECUTION_UNAVAILABLE_REASONS)[number];

export type ExecutionAvailability = {
  available: boolean;
  reason: ExecutionUnavailableReason | null;
};

export function canonicalExecutionAvailability(input: {
  lifecycleStatus?: string | null;
  suppressed?: boolean;
  binding?: {
    isEnabled?: boolean;
    ownershipState?: string | null;
    assignmentEpoch?: string | number | bigint | null;
  } | null;
  host?: {
    status?: string | null;
    lastSeenAt?: Date | string | null;
  } | null;
  now?: Date;
  freshnessMs?: number;
}): ExecutionAvailability {
  if (input.lifecycleStatus !== "active") {
    return { available: false, reason: "agent_inactive" };
  }
  if (input.suppressed) {
    return { available: false, reason: "identity_suppressed" };
  }
  if (!input.binding) {
    return { available: false, reason: "binding_missing" };
  }
  if (input.binding.isEnabled !== true) {
    return { available: false, reason: "binding_disabled" };
  }
  if (input.binding.ownershipState !== "active") {
    return { available: false, reason: "ownership_inactive" };
  }
  const assignmentEpoch = Number(input.binding.assignmentEpoch);
  if (!Number.isSafeInteger(assignmentEpoch) || assignmentEpoch <= 0) {
    return { available: false, reason: "assignment_epoch_invalid" };
  }
  if (!input.host) {
    return { available: false, reason: "host_missing" };
  }
  if (input.host.status !== "online") {
    return { available: false, reason: "host_inactive" };
  }
  const lastSeenAt =
    input.host.lastSeenAt instanceof Date
      ? input.host.lastSeenAt
      : new Date(input.host.lastSeenAt ?? "");
  const age = (input.now ?? new Date()).getTime() - lastSeenAt.getTime();
  if (
    !Number.isFinite(lastSeenAt.getTime()) ||
    age < 0 ||
    age > (input.freshnessMs ?? 120_000)
  ) {
    return { available: false, reason: "host_stale" };
  }
  return { available: true, reason: null };
}
