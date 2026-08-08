import assert from "node:assert/strict"
import test from "node:test"
import type { BridgeDevice } from "@clawchat/contracts"
import { groupRelayHosts } from "@/features/runtime/group-relay-hosts"

function device(
  id: string,
  runtimeType: "hermes" | "openclaw",
  adapterRole: "host" | "runtime",
): BridgeDevice {
  return {
    id,
    workspaceId: "workspace-1",
    label:
      adapterRole === "host"
        ? "Office Mac"
        : `Office Mac · ${runtimeType === "hermes" ? "Hermes Agent" : "OpenClaw"} bridge`,
    devicePublicId: `bdev_${id}`,
    status: "active",
    capabilities: [],
    runtimeType,
    hostType: "macos-launchd",
    hostInstallationId:
      "relayhost_11111111-1111-4111-8111-111111111111",
    hostDisplayName: "Office Mac",
    adapterRole,
    health: "online",
    createdAt: "2026-08-08T08:00:00.000Z",
    updatedAt: "2026-08-08T08:00:00.000Z",
  }
}

test("one Relay Host contains the Hermes and OpenClaw adapters", () => {
  const groups = groupRelayHosts([
    device("controller", "hermes", "host"),
    device("hermes", "hermes", "runtime"),
    device("openclaw", "openclaw", "runtime"),
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.displayName, "Office Mac")
  assert.deepEqual(
    groups[0]?.adapters.map((adapter) => adapter.runtimeType).sort(),
    ["hermes", "openclaw"],
  )
})
