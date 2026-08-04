"use client"
import type { BridgeDevice } from "@clawchat/contracts"
import { formatDistanceToNowStrict } from "date-fns"
import { Copy, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  CompactNotice,
  LabeledField,
} from "@/components/shared/relay-compact-fields"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { RelayConsoleController } from "@/components/clawchat-web-app"

export function RelayConsoleBridgePairingPanel({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    SectionListHeader,
    activeBridgeEnrollment,
    bridgeDeviceLabelDraft,
    bridgeDeviceRuntimeLabel,
    bridgeDevices,
    bridgeDevicesQuery,
    bridgeEnrollmentCreateMutation,
    effectiveWorkspaceId,
    isWorkspaceAdmin,
    revokeBridgeDeviceMutation,
    setBridgeDeviceLabelDraft,
    titleCase,
    workspaceName,
  } = controller

  const canManageBridgeDevices =
    Boolean(effectiveWorkspaceId) && isWorkspaceAdmin
  const activeEnrollmentExpiresAt = activeBridgeEnrollment
    ? new Date(activeBridgeEnrollment.expiresAt)
    : null
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(
      () => setCurrentTime(Date.now()),
      30_000
    )
    return () => window.clearInterval(interval)
  }, [])
  const activeEnrollmentExpired = activeEnrollmentExpiresAt
    ? activeEnrollmentExpiresAt.getTime() <= currentTime
    : false
  const pairedDevices = bridgeDevices.filter(
    (device) => device.status !== "revoked"
  )
  const onlineDevices = pairedDevices.filter(
    (device) => device.health === "online"
  )

  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-sm font-medium text-zinc-100">
            Runtime pairing
          </div>
          <div className="mt-2 text-sm leading-6 text-zinc-400">
            Pair a local Hermes or OpenClaw bridge with this Railway workspace.
            Codes expire quickly and become device credentials only on the local
            runtime.
          </div>
        </div>
        <Badge variant="secondary">
          {onlineDevices.length
            ? `${onlineDevices.length} online`
            : pairedDevices.length
              ? `${pairedDevices.length} paired · offline`
              : "No paired devices"}
        </Badge>
      </div>

      {canManageBridgeDevices ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            {activeBridgeEnrollment ? (
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_8%,transparent)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs tracking-[0.22em] text-muted-foreground uppercase">
                      Pairing code
                    </div>
                    <div className="mt-2 font-mono text-3xl tracking-[0.18em] text-foreground">
                      {activeBridgeEnrollment.code}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(activeBridgeEnrollment.code)
                        .then(() => toast.success("Pairing code copied"))
                        .catch(() => toast.error("Could not copy code"))
                    }}
                    type="button"
                    variant="secondary"
                  >
                    <Copy className="size-4" />
                    Copy
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span>
                    {activeEnrollmentExpired ? "Expired" : "Expires"}{" "}
                    {activeEnrollmentExpiresAt
                      ? formatDistanceToNowStrict(activeEnrollmentExpiresAt, {
                          addSuffix: true,
                        })
                      : "soon"}
                  </span>
                  <span>Workspace: {workspaceName ?? "current"}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-black/10 p-4 text-sm leading-6 text-zinc-400">
                Generate a pairing code, paste it into the local bridge
                installer or runtime enrollment command, then return here to
                confirm the device appears as online.
              </div>
            )}

            <div className="space-y-3">
              <SectionListHeader title="Paired runtime devices" />
              {bridgeDevicesQuery.isLoading ? (
                <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-black/10 p-4 text-sm text-zinc-400">
                  Loading paired devices...
                </div>
              ) : bridgeDevices.length ? (
                bridgeDevices.map((device: BridgeDevice) => {
                  const isRevoked = device.status === "revoked"
                  const runtimeType = bridgeDeviceRuntimeLabel(device)
                  const compatibility = device.compatibility
                  const versionDetails = [
                    device.pluginVersion
                      ? `plugin ${device.pluginVersion}`
                      : null,
                    device.openCoreVersion
                      ? `Open Core ${device.openCoreVersion}`
                      : null,
                  ].filter(Boolean)
                  return (
                    <div
                      key={device.id}
                      className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-page)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-zinc-100">
                              {device.label}
                            </div>
                            <Badge variant="secondary">{runtimeType}</Badge>
                            {compatibility ? (
                              <Badge variant="secondary">
                                {compatibility.level === "verified"
                                  ? "Verified · Full"
                                  : compatibility.level === "compatible"
                                    ? "Compatible · Safe mode"
                                    : "Unsupported"}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-zinc-500">
                            {titleCase(device.health ?? "offline")} · {titleCase(device.status)} ·{" "}
                            {device.lastSeenAt
                              ? `last seen ${formatDistanceToNowStrict(
                                  new Date(device.lastSeenAt),
                                  {
                                    addSuffix: true,
                                  }
                                )}`
                              : "never connected"}
                          </div>
                          {versionDetails.length ? (
                            <div className="mt-1 text-xs leading-5 text-zinc-500">
                              {versionDetails.join(" · ")}
                            </div>
                          ) : null}
                          <div className="mt-2 text-xs leading-5 text-zinc-500">
                            {device.capabilities?.length
                              ? device.capabilities.join(", ")
                              : "No capabilities reported"}
                          </div>
                          {compatibility?.operatingMode === "safe" ? (
                            <div className="mt-2 text-xs leading-5 text-amber-300/80">
                              Core messaging remains enabled. Disabled until
                              this runtime is verified: {" "}
                              {compatibility.disabledCapabilities.length
                                ? compatibility.disabledCapabilities.join(", ")
                                : "advanced runtime features"}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          disabled={
                            isRevoked || revokeBridgeDeviceMutation.isPending
                          }
                          onClick={() =>
                            revokeBridgeDeviceMutation.mutate(device.id)
                          }
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <Trash2 className="size-4" />
                          {isRevoked ? "Revoked" : "Revoke this"}
                        </Button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <EmptyState
                  title="No paired devices"
                  description="Generate a code and enroll a local runtime bridge."
                />
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-black/10 p-4">
            <LabeledField label="Device label">
              <Input
                value={bridgeDeviceLabelDraft}
                onChange={(event) =>
                  setBridgeDeviceLabelDraft(event.target.value)
                }
              />
            </LabeledField>
            <Button
              disabled={
                !effectiveWorkspaceId ||
                bridgeEnrollmentCreateMutation.isPending
              }
              onClick={() => bridgeEnrollmentCreateMutation.mutate()}
              type="button"
              className="w-full"
            >
              <Plus className="size-4" />
              {bridgeEnrollmentCreateMutation.isPending
                ? "Generating..."
                : activeBridgeEnrollment
                  ? "Generate new code"
                  : "Generate pairing code"}
            </Button>
            <div className="text-xs leading-5 text-zinc-500">
              Pairing codes last 10 minutes. Revoke a device before pairing a
              replacement when a laptop changes hands or a runtime config is
              lost.
            </div>
          </div>
        </div>
      ) : (
        <CompactNotice>
          Workspace owners and admins can generate runtime pairing codes.
        </CompactNotice>
      )}
    </div>
  )
}
