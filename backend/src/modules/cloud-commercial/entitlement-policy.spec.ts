import {
  RELAY_CLOUD_WRITABLE_SQL_PREDICATE,
  isRelayCloudWritableEntitlement,
} from "./entitlement-policy";

describe("Relay entitlement windows", () => {
  const now = new Date("2026-07-14T20:00:00.000Z");
  const future = new Date("2026-07-21T20:00:00.000Z");
  const past = new Date("2026-07-13T20:00:00.000Z");

  it("keeps only a current active billing period writable", () => {
    expect(
      isRelayCloudWritableEntitlement(
        { status: "active", currentPeriodEndsAt: future },
        now,
      ),
    ).toBe(true);
    expect(
      isRelayCloudWritableEntitlement(
        { status: "active", currentPeriodEndsAt: past },
        now,
      ),
    ).toBe(false);
    expect(
      isRelayCloudWritableEntitlement({ status: "active" }, now),
    ).toBe(true);
  });

  it("never grants writable access to trial statuses", () => {
    expect(
      isRelayCloudWritableEntitlement(
        { status: "trial", trialEndsAt: future },
        now,
      ),
    ).toBe(false);
    expect(
      isRelayCloudWritableEntitlement(
        { status: "trial", trialEndsAt: past },
        now,
      ),
    ).toBe(false);
    expect(
      isRelayCloudWritableEntitlement({ status: "trial" }, now),
    ).toBe(false);
    expect(
      isRelayCloudWritableEntitlement(
        { status: "trialing", trialEndsAt: future },
        now,
      ),
    ).toBe(false);
  });

  it("requires both migration or billing grace deadlines to remain future", () => {
    expect(
      isRelayCloudWritableEntitlement(
        { status: "grace", graceEndsAt: future, readOnlyAt: future },
        now,
      ),
    ).toBe(true);
    expect(
      isRelayCloudWritableEntitlement(
        { status: "grace", graceEndsAt: past, readOnlyAt: past },
        now,
      ),
    ).toBe(false);
    expect(
      isRelayCloudWritableEntitlement(
        { status: "grace", graceEndsAt: future, readOnlyAt: null },
        now,
      ),
    ).toBe(false);
  });

  it("keeps every non-writable lifecycle state read-only", () => {
    for (const status of [
      "subscription_required",
      "past_due",
      "read_only",
      "cancelled",
      "deletion_scheduled",
    ]) {
      expect(isRelayCloudWritableEntitlement({ status }, now)).toBe(false);
    }
  });

  it("applies the same bounded windows to scheduled-message SQL", () => {
    expect(RELAY_CLOUD_WRITABLE_SQL_PREDICATE).not.toContain("trial");
    expect(RELAY_CLOUD_WRITABLE_SQL_PREDICATE).toContain(
      'subscription."graceEndsAt" > NOW()',
    );
    expect(RELAY_CLOUD_WRITABLE_SQL_PREDICATE).toContain(
      'subscription."readOnlyAt" > NOW()',
    );
    expect(RELAY_CLOUD_WRITABLE_SQL_PREDICATE).toContain(
      'subscription."currentPeriodEndsAt" > NOW()',
    );
  });
});
