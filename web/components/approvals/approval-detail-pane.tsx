import type { Approval } from "@clawchat/contracts"
import { Check, X } from "lucide-react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { EmptyPanel } from "@/components/shared/empty-state"
import { MetaRow } from "@/components/shared/meta-row"
import { RiskBadge } from "@/components/shared/risk-badge"
import { ApprovalDetailSkeleton } from "@/components/app-shell/skeletons"

export function ApprovalDetailPane({
  approval,
  approvals,
  isLoading,
  approvalNote,
  onApprovalNoteChange,
  onApprove,
  onReject,
  isSubmitting,
  relativeTime,
}: {
  approval: Approval | null
  approvals: Approval[]
  isLoading: boolean
  approvalNote: string
  onApprovalNoteChange: (value: string) => void
  onApprove: () => void
  onReject: () => void
  isSubmitting: boolean
  relativeTime: (value: string) => string
}) {
  const statusStrip = <ApprovalStatusStrip approvals={approvals} />
  if (isLoading) {
    return <>{statusStrip}<ApprovalDetailSkeleton /></>
  }

  if (!approval) {
    return (
      <>{statusStrip}<EmptyPanel
        title="No approval selected"
        description="Provider-action approval records will appear here after a broker request creates them."
      /></>
    )
  }

  return (
    <>
      {statusStrip}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mission-kicker">Review surface</div>
            <div className="claw-title-detail font-semibold tracking-[-0.03em]">
              {approval.title}
            </div>
            <div className="claw-caption mt-2 flex items-center gap-3 text-zinc-400">
              <RiskBadge risk={approval.risk} />
              <span>Requested {relativeTime(approval.createdAt)}</span>
            </div>
          </div>
          <Badge variant="secondary" className="capitalize">
            {approval.status}
          </Badge>
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          {approval.description}
        </p>
      </div>
      <Separator />
      <div className="flex-1 px-5 py-4">
        <div className="grid w-full min-w-0 gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
            <CardHeader>
              <CardTitle className="text-base">Decision note</CardTitle>
              <CardDescription>
                Recorded with the backend approval resolution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={8}
                placeholder="Add context for the team or agents involved."
                value={approvalNote}
                onChange={(event) => onApprovalNoteChange(event.target.value)}
              />
            </CardContent>
          </Card>
          <Card className="border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
            <CardHeader>
              <CardTitle className="text-base">Approval facts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-zinc-400">
              <MetaRow
                label="Requested by"
                value={approval.requestedByAgentId}
              />
              <MetaRow label="Workspace" value={approval.workspaceId} />
              <MetaRow
                label="Expires"
                value={
                  approval.expiresAt
                    ? format(new Date(approval.expiresAt), "PPp")
                    : "No expiry"
                }
              />
              <MetaRow
                label="Current notes"
                value={approval.notes || "None recorded yet"}
              />
            </CardContent>
          </Card>
        </div>
        {approval.steps.length ? (
          <Card className="mt-6 border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
            <CardHeader>
              <CardTitle className="text-base">Review checklist</CardTitle>
              <CardDescription>
                Confirm these details before approving the action.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {approval.steps.map((step, index) => {
                const item = approvalStepToRecord(step)
                return (
                  <div
                    key={`${item.label}-${index}`}
                    className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_30%,transparent)] bg-[var(--claw-bg-page)] px-3 py-2"
                  >
                    <div className="claw-kicker tracking-[0.14em] text-zinc-500 uppercase">
                      {item.label}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words leading-6 text-zinc-200">
                      {item.value || "Not provided"}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>
      <Separator />
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <p className="max-w-xl text-xs leading-5 text-zinc-500">
            Approval authorizes this exact payload. Return to the conversation
            afterward and ask the requesting agent to continue.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="destructive"
              className="gap-2"
              disabled={isSubmitting}
              onClick={onReject}
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
            <Button
              className="gap-2"
              disabled={isSubmitting}
              onClick={onApprove}
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

function ApprovalStatusStrip({ approvals }: { approvals: Approval[] }) {
  const counts = {
    pending: approvals.filter((item) => item.status === "pending").length,
    approved: approvals.filter((item) => item.status === "approved").length,
    executed: approvals.filter((item) => item.status === "executed").length,
    failed: approvals.filter((item) => item.status === "failed").length,
  }
  return (
    <div className="grid grid-cols-5 gap-3 px-5 pt-4">
      {[
        ["Pending", counts.pending, "text-amber-300"],
        ["Approved", counts.approved, "text-emerald-300"],
        ["Executed", counts.executed, "text-blue-300"],
        ["Failed", counts.failed, "text-red-300"],
        ["Total", approvals.length, "text-zinc-300"],
      ].map(([label, value, color]) => (
        <div key={String(label)} className="rounded-[4px] bg-[var(--claw-bg-surface)] px-3 py-2 text-center text-sm font-semibold">
          <span className="text-zinc-400">{label}</span>{" "}
          <span className={String(color)}>{value}</span>
        </div>
      ))}
    </div>
  )
}

function approvalStepToRecord(step: object) {
  const record = step as Record<string, unknown>
  return {
    label: typeof record.label === "string" ? record.label : "Review item",
    value:
      typeof record.value === "string"
        ? record.value
        : record.value === null || record.value === undefined
          ? ""
          : JSON.stringify(record.value),
  }
}
