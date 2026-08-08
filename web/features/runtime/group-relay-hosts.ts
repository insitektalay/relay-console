import type { BridgeDevice } from "@clawchat/contracts"

export interface RelayHostGroup {
  id: string
  displayName: string
  health: "online" | "offline"
  devices: BridgeDevice[]
  adapters: BridgeDevice[]
  controller: BridgeDevice | null
}

export function groupRelayHosts(devices: BridgeDevice[]): RelayHostGroup[] {
  const grouped = new Map<string, BridgeDevice[]>()
  for (const device of devices.filter((item) => item.status !== "revoked")) {
    const id = device.hostInstallationId?.trim() || device.id
    grouped.set(id, [...(grouped.get(id) ?? []), device])
  }
  return [...grouped.entries()]
    .map(([id, hostDevices]) => {
      const controller =
        hostDevices.find((device) => device.adapterRole === "host") ?? null
      const explicitAdapters = hostDevices.filter(
        (device) => device.adapterRole !== "host",
      )
      return {
        id,
        displayName:
          hostDevices[0]?.hostDisplayName?.trim() ||
          hostDevices[0]?.label ||
          "Runtime host",
        health: hostDevices.some((device) => device.health === "online")
          ? "online"
          : "offline",
        devices: hostDevices,
        adapters: explicitAdapters.length ? explicitAdapters : hostDevices,
        controller,
      } satisfies RelayHostGroup
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
}
