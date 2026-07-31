"use client"
import { formatDistanceToNowStrict } from "date-fns"
import { LabeledField } from "@/components/shared/relay-compact-fields"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { RelayConsoleController } from "@/components/clawchat-web-app"

export function RelayConsoleOperationsListPane({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    PanelCard,
    QuickCreateCard,
    SectionListHeader,
    activeBridgeEnrollment,
    bridgeConnectionCreateMutation,
    bridgeDevices,
    bridgeEnrollmentCreateMutation,
    connectionApiKeyDraft,
    connectionUrlDraft,
    effectiveWorkspaceId,
    revokeBridgeDeviceMutation,
    setConnectionApiKeyDraft,
    setConnectionUrlDraft,
  } = controller

  return (
    <PanelCard
      title="Operations"
      description="Internal-only connection and bridge controls. This page is shown only when the operations feature flag is enabled and the current user is a workspace owner or admin."
      showKicker={false}
    >
      <div className="space-y-4">
        <QuickCreateCard
          title="Pair local OpenClaw"
          description="Generate a short-lived pairing code for a local OpenClaw bridge device."
          onSubmit={() => bridgeEnrollmentCreateMutation.mutate()}
          disabled={
            !effectiveWorkspaceId || bridgeEnrollmentCreateMutation.isPending
          }
          submitLabel={
            bridgeEnrollmentCreateMutation.isPending
              ? "Generating..."
              : "Generate pairing code"
          }
        >
          {activeBridgeEnrollment ? (
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] p-4">
              <div className="text-xs tracking-[0.22em] text-muted-foreground uppercase">
                Pairing code
              </div>
              <div className="mt-2 font-mono text-2xl tracking-[0.18em] text-foreground">
                {activeBridgeEnrollment.code}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Expires{" "}
                {formatDistanceToNowStrict(
                  new Date(activeBridgeEnrollment.expiresAt),
                  {
                    addSuffix: true,
                  }
                )}
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            <SectionListHeader title="Paired devices" />
            {bridgeDevices.length ? (
              bridgeDevices.map((device) => (
                <div
                  key={device.id}
                  className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{device.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {device.status} ·{" "}
                        {device.lastSeenAt
                          ? `last seen ${formatDistanceToNowStrict(
                              new Date(device.lastSeenAt),
                              {
                                addSuffix: true,
                              }
                            )}`
                          : "never connected"}
                      </div>
                    </div>
                    <Button
                      disabled={revokeBridgeDeviceMutation.isPending}
                      onClick={() =>
                        revokeBridgeDeviceMutation.mutate(device.id)
                      }
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No paired devices"
                description="Generate a code and paste it into the local bridge plugin to pair a machine."
              />
            )}
          </div>
        </QuickCreateCard>
        <QuickCreateCard
          title="Save OpenClaw connection"
          description="Store the workspace connection details used by internal bridge tooling."
          onSubmit={() => bridgeConnectionCreateMutation.mutate()}
          disabled={
            !effectiveWorkspaceId ||
            !connectionUrlDraft.trim() ||
            bridgeConnectionCreateMutation.isPending
          }
          submitLabel={
            bridgeConnectionCreateMutation.isPending
              ? "Saving..."
              : "Save connection"
          }
        >
          <LabeledField label="Workspace URL">
            <Input
              value={connectionUrlDraft}
              onChange={(event) => setConnectionUrlDraft(event.target.value)}
            />
          </LabeledField>
          <LabeledField label="Access key">
            <Input
              value={connectionApiKeyDraft}
              onChange={(event) => setConnectionApiKeyDraft(event.target.value)}
            />
          </LabeledField>
        </QuickCreateCard>
      </div>
    </PanelCard>
  )
}
