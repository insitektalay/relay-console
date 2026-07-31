"use client"
import { toast } from "sonner"
import { sdk } from "@/lib/sdk"
import { CompactNotice } from "@/components/shared/relay-compact-fields"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import type { RelayConsoleController } from "@/components/clawchat-web-app"

export function RelayConsoleOperationsDetailPane({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    DetailCard,
    SectionListHeader,
    SimpleRows,
    bridgeConnections,
    bridgeSyncMutation,
    effectiveWorkspaceId,
    queryClient,
    workspaceName,
  } = controller

  return (
    <DetailCard
      title="OpenClaw operations"
      subtitle={workspaceName ?? "Choose a workspace"}
    >
      <div className="space-y-6">
        <CompactNotice>
          This page is intentionally restricted. It contains internal bridge and
          integration controls that are not part of the customer-facing launch
          settings experience.
        </CompactNotice>
        <SectionListHeader title="Saved connections" />
        {bridgeConnections.length ? (
          <SimpleRows
            rows={bridgeConnections}
            render={(connection) => (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{connection.instanceUrl}</div>
                  <div className="text-xs text-muted-foreground">
                    {connection.status} · {connection.agentsSynced} agents
                    synced
                  </div>
                </div>
                <Button
                  onClick={() => {
                    void sdk.bridge
                      .reconnect(connection.id)
                      .then(() =>
                        queryClient.invalidateQueries({
                          queryKey: [
                            "bridge-connections",
                            effectiveWorkspaceId,
                          ],
                        })
                      )
                      .then(() => toast.success("Reconnect requested"))
                      .catch((error: Error) => toast.error(error.message))
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Reconnect
                </Button>
              </div>
            )}
            emptyTitle=""
            emptyDescription=""
          />
        ) : (
          <EmptyState
            title="No saved connections"
            description="Add a connection from the left to prepare internal OpenClaw bridge tooling."
          />
        )}
        <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
          <div className="mb-2 text-sm font-medium text-zinc-100">
            Agent sync requests
          </div>
          <div className="text-sm leading-6 text-zinc-400">
            This does not perform an immediate sync itself. It records a sync
            request for connected bridge clients to pick up.
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              disabled={!effectiveWorkspaceId || bridgeSyncMutation.isPending}
              onClick={() => bridgeSyncMutation.mutate()}
              variant="secondary"
            >
              {bridgeSyncMutation.isPending
                ? "Requesting..."
                : "Request agent sync"}
            </Button>
          </div>
        </div>
      </div>
    </DetailCard>
  )
}
