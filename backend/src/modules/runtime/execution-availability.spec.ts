import { canonicalExecutionAvailability } from "./execution-availability";

const now = new Date("2026-07-24T12:00:00.000Z");
const valid = {
  lifecycleStatus: "active",
  suppressed: false,
  binding: {
    isEnabled: true,
    ownershipState: "active",
    assignmentEpoch: "7",
  },
  host: {
    status: "online",
    lastSeenAt: new Date("2026-07-24T11:59:30.000Z"),
  },
  now,
};

describe("canonical execution availability", () => {
  it("allows only a fresh online owner with an active agent, binding, and epoch", () => {
    expect(canonicalExecutionAvailability(valid)).toEqual({
      available: true,
      reason: null,
    });
  });

  it.each([
    ["retired agent", { lifecycleStatus: "retired" }, "agent_inactive"],
    ["quarantined agent", { lifecycleStatus: "quarantined" }, "agent_inactive"],
    ["identity suppression", { suppressed: true }, "identity_suppressed"],
    ["missing binding", { binding: null }, "binding_missing"],
    ["disabled binding", { binding: { ...valid.binding, isEnabled: false } }, "binding_disabled"],
    ["unassigned owner", { binding: { ...valid.binding, ownershipState: "unassigned" } }, "ownership_inactive"],
    ["quarantined owner", { binding: { ...valid.binding, ownershipState: "quarantined" } }, "ownership_inactive"],
    ["zero epoch", { binding: { ...valid.binding, assignmentEpoch: "0" } }, "assignment_epoch_invalid"],
    ["malformed epoch", { binding: { ...valid.binding, assignmentEpoch: "stale" } }, "assignment_epoch_invalid"],
    ["missing host", { host: null }, "host_missing"],
    ["offline host", { host: { ...valid.host, status: "offline" } }, "host_inactive"],
    ["revoked host", { host: { ...valid.host, status: "retired" } }, "host_inactive"],
    [
      "stale heartbeat",
      { host: { ...valid.host, lastSeenAt: new Date("2026-07-24T11:57:59.000Z") } },
      "host_stale",
    ],
  ])("rejects %s", (_label, override, reason) => {
    expect(canonicalExecutionAvailability({ ...valid, ...override })).toEqual({
      available: false,
      reason,
    });
  });

  it("does not treat a future heartbeat as fresh", () => {
    expect(canonicalExecutionAvailability({
      ...valid,
      host: { ...valid.host, lastSeenAt: new Date("2026-07-24T12:00:01.000Z") },
    })).toEqual({ available: false, reason: "host_stale" });
  });
});
