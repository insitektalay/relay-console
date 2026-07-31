"use client"
import { RefreshCcw, Search } from "lucide-react"
import { relativeTime } from "@/lib/relay-presentation-utils"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { RelayConsoleController } from "@/components/clawchat-web-app"

export function RelayConsoleApprovalsListPane({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    approvalsQuery,
    effectiveApprovalId,
    filteredApprovals,
    setSelectedApprovalId,
    setTaskSearch,
    taskSearch,
  } = controller

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="claw-title-pane font-semibold tracking-[-0.02em]">
              Approvals
            </div>
            <div className="claw-caption mt-1 text-zinc-500">Action queue</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{filteredApprovals.length}</Badge>
            <Button
              size="icon-sm"
              variant="secondary"
              title="Refresh approvals"
              disabled={approvalsQuery.isFetching}
              onClick={() => void approvalsQuery.refetch()}
            >
              <RefreshCcw
                className={`size-4 ${approvalsQuery.isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-3.5 left-4 size-5 text-zinc-500" />
          <Input
            className="h-12 pl-12"
            placeholder="Search approvals"
            value={taskSearch}
            onChange={(event) => setTaskSearch(event.target.value)}
          />
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-[4px] bg-[var(--claw-bg-surface)] px-3 py-2">
          <span className="text-sm font-semibold text-zinc-200">
            Approval status
          </span>
          <select
            aria-label="Approval status"
            className="h-9 rounded-[4px] border border-[var(--claw-border)] bg-[var(--claw-bg-page)] px-3 text-sm"
            value="pending"
            disabled
          >
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>
      <ScrollArea className="mission-scrollbar min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {approvalsQuery.isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-zinc-500">
              Loading approvals…
            </div>
          ) : approvalsQuery.isError ? (
            <div className="rounded-[4px] border border-red-500/20 bg-red-500/[0.05] px-4 py-8 text-center text-sm text-red-200">
              <div>Could not load approvals</div>
              <button
                className="mt-2 text-xs underline"
                type="button"
                onClick={() => void approvalsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          ) : filteredApprovals.length ? (
            filteredApprovals.map((approval) => (
              <button
                key={approval.id}
                type="button"
                className={`w-full rounded-[4px] border p-3 text-left ${
                  approval.id === effectiveApprovalId
                    ? "border-transparent bg-[color-mix(in_srgb,var(--claw-accent-blue)_17%,var(--claw-bg-surface))]"
                    : "border-transparent hover:bg-[var(--claw-bg-surface)]"
                }`}
                onClick={() => setSelectedApprovalId(approval.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {approval.title}
                    </div>
                    <div className="claw-caption mt-1 text-zinc-500">
                      {approval.description}
                    </div>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
                <div className="claw-caption mt-2 text-zinc-500">
                  {relativeTime(approval.createdAt)}
                </div>
              </button>
            ))
          ) : (
            <EmptyState
              title="No approvals"
              description="No retained provider-action approvals match this view."
            />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
