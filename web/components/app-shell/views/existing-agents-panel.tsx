"use client"
import type {
  RuntimeAuthoritySnapshot,
  RuntimeObservation,
  RuntimeProvisioningTarget,
} from "@clawchat/contracts"
import { Bot, RefreshCcw } from "lucide-react"
import {
  CompactNotice,
  LabeledField,
} from "@/components/shared/relay-compact-fields"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import type { RelayConsoleController } from "@/components/clawchat-web-app"

export function RelayConsoleExistingAgentsPanel({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    DetailCard,
    connectNativeObservationsMutation,
    disconnectNativeObservationMutation,
    dismissNativeObservationMutation,
    isWorkspaceAdmin,
    nativeDocumentConsent,
    nativeObservationsQuery,
    retryNativeObservationMutation,
    runtimeAuthorityQuery,
    runtimeProvisioningTargetsQuery,
    scanRuntimeHostMutation,
    selectRuntimeProvisioningTargetMutation,
    selectedNativeObservationIds,
    setNativeDocumentConsent,
    setSelectedNativeObservationIds,
    titleCase,
  } = controller

  const observations: RuntimeObservation[] = nativeObservationsQuery.data ?? []
  const visibleObservations = observations.filter(
    (observation) =>
      !observation.isDismissed || observation.connectionState === "connected"
  )
  const authority: RuntimeAuthoritySnapshot | null =
    runtimeAuthorityQuery.data ?? null
  const targets: RuntimeProvisioningTarget[] =
    runtimeProvisioningTargetsQuery.data ?? []
  const hosts = authority?.hosts ?? []
  const hostById = new Map(hosts.map((host) => [host.id, host]))
  const grouped = new Map<string, RuntimeObservation[]>()
  for (const observation of visibleObservations) {
    const rows = grouped.get(observation.runtimeHostId) ?? []
    rows.push(observation)
    grouped.set(observation.runtimeHostId, rows)
  }
  const candidates = observations.filter(
    (observation) =>
      observation.origin === "customer_existing" &&
      !observation.isDismissed &&
      ["discovered", "disconnected"].includes(observation.connectionState)
  )
  const connected = observations.filter(
    (observation) => observation.connectionState === "connected"
  )
  const selectedCandidates = candidates.filter((observation) =>
    selectedNativeObservationIds.has(observation.id)
  )
  const nativeName = (observation: RuntimeObservation) => {
    const value = observation.displayMetadata?.name
    return typeof value === "string" && value.trim()
      ? value
      : observation.externalAgentId
  }
  const runtimeLabel = (value: string) =>
    value === "hermes" ? "Hermes" : value === "openclaw" ? "OpenClaw" : value

  return (
    <DetailCard
      title="Existing agents"
      subtitle="Connect agents that are already configured in Hermes or OpenClaw. Relay does not copy or delete the native agent."
    >
      <div className="space-y-5">
        <CompactNotice>
          Discovery reads safe metadata only. Agent instructions, memory, and
          Markdown skills are shared with Relay only after you select an agent
          and give consent below. Conversation history and secrets are never
          imported.
        </CompactNotice>

        {targets.length ? (
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
            <div className="text-sm font-medium text-zinc-100">
              Default hosts for newly created agents
            </div>
            <div className="mt-1 text-xs leading-5 text-zinc-500">
              This changes routing behind the existing Create Agent form; it
              does not add a host field to that form.
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(["hermes", "openclaw"] as const).map((runtimeType) => {
                const target = targets.find(
                  (item) => item.runtimeType === runtimeType
                )
                const eligibleHosts = hosts.filter((host) =>
                  host.supportedRuntimes.includes(runtimeType)
                )
                return (
                  <LabeledField
                    key={runtimeType}
                    label={runtimeLabel(runtimeType)}
                  >
                    <select
                      className="h-9 w-full rounded-[4px] border border-[var(--claw-border)] bg-[var(--claw-bg-page)] px-3 text-sm"
                      value={target?.runtimeHostId ?? ""}
                      disabled={
                        !isWorkspaceAdmin ||
                        selectRuntimeProvisioningTargetMutation.isPending
                      }
                      onChange={(event) => {
                        if (event.target.value) {
                          selectRuntimeProvisioningTargetMutation.mutate({
                            runtimeType,
                            runtimeHostId: event.target.value,
                          })
                        }
                      }}
                    >
                      <option value="">Needs selection</option>
                      {eligibleHosts.map((host) => (
                        <option key={host.id} value={host.id}>
                          {host.displayName} · {titleCase(host.status)}
                        </option>
                      ))}
                    </select>
                  </LabeledField>
                )
              })}
            </div>
          </div>
        ) : null}

        {nativeObservationsQuery.isLoading ||
        runtimeAuthorityQuery.isLoading ? (
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-4 text-sm text-zinc-400">
            Looking for existing agents...
          </div>
        ) : grouped.size ? (
          Array.from(grouped.entries()).map(
            ([runtimeHostId, hostObservations]) => {
              const host = hostById.get(runtimeHostId)
              return (
                <div
                  key={runtimeHostId}
                  className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-100">
                        {host?.displayName ?? "Runtime host"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {host?.platform ?? "Platform not reported"} ·{" "}
                        {host ? titleCase(host.status) : "Unknown status"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      disabled={
                        !isWorkspaceAdmin ||
                        scanRuntimeHostMutation.isPending ||
                        host?.status !== "online"
                      }
                      onClick={() =>
                        scanRuntimeHostMutation.mutate(runtimeHostId)
                      }
                    >
                      <RefreshCcw className="size-4" />
                      Scan again
                    </Button>
                  </div>
                  <div className="mt-3 divide-y divide-[color-mix(in_srgb,var(--claw-border)_34%,transparent)]">
                    {hostObservations.map((observation) => {
                      const isCandidate =
                        observation.origin === "customer_existing" &&
                        !observation.isDismissed &&
                        ["discovered", "disconnected"].includes(
                          observation.connectionState
                        )
                      const isConnected =
                        observation.connectionState === "connected"
                      const selectable =
                        isCandidate &&
                        ["unknown", "supported", "compatible"].includes(
                          observation.compatibilityStatus
                        )
                      const lastConnectionError =
                        typeof observation.observedState
                          ?.lastConnectionError === "string"
                          ? observation.observedState.lastConnectionError
                          : null
                      return (
                        <div
                          key={observation.id}
                          className="flex flex-wrap items-center gap-3 py-3"
                        >
                          {isCandidate ? (
                            <input
                              aria-label={`Select ${nativeName(observation)}`}
                              type="checkbox"
                              checked={selectedNativeObservationIds.has(
                                observation.id
                              )}
                              disabled={!selectable || !isWorkspaceAdmin}
                              onChange={(event) => {
                                setSelectedNativeObservationIds((current) => {
                                  const next = new Set(current)
                                  if (event.target.checked) {
                                    next.add(observation.id)
                                  } else {
                                    next.delete(observation.id)
                                  }
                                  return next
                                })
                              }}
                            />
                          ) : (
                            <Bot className="size-4 text-zinc-500" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-zinc-100">
                              {nativeName(observation)}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {runtimeLabel(observation.runtimeType)} ·{" "}
                              {observation.externalAgentId} ·{" "}
                              {titleCase(observation.connectionState)} ·{" "}
                              {titleCase(observation.status)}
                            </div>
                            {observation.compatibilityReason ? (
                              <div className="mt-1 text-xs text-amber-300">
                                {observation.compatibilityReason}
                              </div>
                            ) : null}
                            {lastConnectionError ? (
                              <div className="mt-1 text-xs text-red-300">
                                Last connection failed:{" "}
                                {titleCase(lastConnectionError)}
                              </div>
                            ) : null}
                          </div>
                          {isCandidate && lastConnectionError ? (
                            <Button
                              size="sm"
                              type="button"
                              variant="secondary"
                              disabled={
                                !isWorkspaceAdmin ||
                                !nativeDocumentConsent ||
                                !selectable ||
                                retryNativeObservationMutation.isPending
                              }
                              onClick={() =>
                                retryNativeObservationMutation.mutate(
                                  observation.id
                                )
                              }
                            >
                              {retryNativeObservationMutation.isPending
                                ? "Retrying..."
                                : "Retry"}
                            </Button>
                          ) : null}
                          {isConnected ? (
                            <Button
                              size="sm"
                              type="button"
                              variant="secondary"
                              disabled={
                                !isWorkspaceAdmin ||
                                disconnectNativeObservationMutation.isPending
                              }
                              onClick={() =>
                                disconnectNativeObservationMutation.mutate(
                                  observation.id
                                )
                              }
                            >
                              Disconnect
                            </Button>
                          ) : null}
                          {isCandidate ? (
                            <Button
                              size="sm"
                              type="button"
                              variant="ghost"
                              disabled={
                                !isWorkspaceAdmin ||
                                dismissNativeObservationMutation.isPending
                              }
                              onClick={() =>
                                dismissNativeObservationMutation.mutate(
                                  observation.id
                                )
                              }
                            >
                              Hide
                            </Button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }
          )
        ) : (
          <EmptyState
            title="No native agents discovered yet"
            description="Pair a bridge beside Hermes or OpenClaw, then scan the online host."
          />
        )}

        {candidates.length ? (
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-black/10 p-4">
            <label className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
              <input
                className="mt-1"
                type="checkbox"
                checked={nativeDocumentConsent}
                disabled={!isWorkspaceAdmin}
                onChange={(event) =>
                  setNativeDocumentConsent(event.target.checked)
                }
              />
              <span>
                Share the selected agents&apos; allowlisted instruction, memory,
                and Markdown skill files with Relay. Secrets, runtime
                credentials, configuration files, and prior conversations stay
                outside Relay.
              </span>
            </label>
            <div className="mt-4 flex justify-end">
              <Button
                className="mr-2"
                type="button"
                variant="secondary"
                disabled={!isWorkspaceAdmin}
                onClick={() =>
                  setSelectedNativeObservationIds(
                    new Set(candidates.map((observation) => observation.id))
                  )
                }
              >
                Select all
              </Button>
              <Button
                disabled={
                  !isWorkspaceAdmin ||
                  !nativeDocumentConsent ||
                  !selectedCandidates.length ||
                  connectNativeObservationsMutation.isPending
                }
                onClick={() =>
                  connectNativeObservationsMutation.mutate(
                    selectedCandidates.map((observation) => observation.id)
                  )
                }
              >
                {connectNativeObservationsMutation.isPending
                  ? "Connecting..."
                  : `Connect ${selectedCandidates.length || ""} selected agent${selectedCandidates.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        ) : connected.length ? (
          <CompactNotice>
            All currently discovered existing agents are connected.
          </CompactNotice>
        ) : null}
      </div>
    </DetailCard>
  )
}
