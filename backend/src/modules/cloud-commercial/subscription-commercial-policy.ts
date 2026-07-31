export const RELAY_FAILED_PAYMENT_GRACE_DAYS = 3;
export const RELAY_ACCOUNT_DATA_RETENTION_DAYS = 30;
export const RELAY_DAY_MS = 86_400_000;

export function relayFailedPaymentGraceEndsAt(now = new Date()) {
  return new Date(
    now.getTime() + RELAY_FAILED_PAYMENT_GRACE_DAYS * RELAY_DAY_MS,
  );
}

export function relayDeletionEligibleAt(now = new Date()) {
  return new Date(
    now.getTime() + RELAY_ACCOUNT_DATA_RETENTION_DAYS * RELAY_DAY_MS,
  );
}

export function capRelayFailedPaymentGrace(
  providerDeadline: Date | null | undefined,
  now = new Date(),
) {
  const policyDeadline = relayFailedPaymentGraceEndsAt(now);
  if (!providerDeadline || providerDeadline <= now) return policyDeadline;
  return providerDeadline < policyDeadline ? providerDeadline : policyDeadline;
}
