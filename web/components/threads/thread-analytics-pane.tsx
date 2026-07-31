"use client"

import type { ReactNode } from "react"
import type {
  Thread,
  ThreadAnalytics,
  ThreadAnalyticsSessionStat,
} from "@clawchat/contracts"
import { format } from "date-fns"
import { Download, FileBarChart2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/shared/empty-state"

export function ThreadAnalyticsPane({
  selectedThread,
  analytics,
  isLoading,
  isRefreshing,
  errorMessage,
  activityGapMinutes,
  agentRepeatSessionId,
  onActivityGapMinutesChange,
  onRunAgentRepeatAnalysis,
  onExportJson,
  onExportCsv,
  topSlot,
  embedded = false,
}: {
  selectedThread: Thread | null
  analytics: ThreadAnalytics | null
  isLoading: boolean
  isRefreshing: boolean
  errorMessage?: string | null
  activityGapMinutes: number
  agentRepeatSessionId: string | null
  onActivityGapMinutesChange: (value: number) => void
  onRunAgentRepeatAnalysis: (threadSessionId: string) => void
  onExportJson: () => void
  onExportCsv: () => void
  topSlot?: ReactNode
  embedded?: boolean
}) {
  if (!selectedThread) {
    if (embedded) {
      return (
        <div className="flex h-full min-h-0 flex-col space-y-4">
          {topSlot}
          <div className="flex min-h-[24rem] flex-1 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
            <EmptyState
              title="Choose a chat"
              description="Select a chat report from the left to inspect message counts, active windows, and exportable history stats."
            />
          </div>
        </div>
      )
    }

    return (
      <div className="h-full min-h-0 w-full min-w-0 bg-[var(--claw-bg-page)] pt-4 pr-6 pb-6 pl-4">
        <Card className="h-full w-full min-w-0 border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
          <CardContent className="flex h-full items-center justify-center">
            <EmptyState
              title="Choose a thread"
              description="Pick a chat from the analytics list to inspect message counts, active windows, and exportable history stats."
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col space-y-4">
        {topSlot}
        <div className="min-h-0 flex-1 overflow-hidden rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
          <div className="flex h-full min-w-0 flex-col">
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="claw-title-detail font-semibold tracking-[-0.03em] text-zinc-100">
                      Thread Analytics
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {selectedThread.type.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-sm text-zinc-300">
                    {selectedThread.title}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[8rem]">
                    <div className="claw-kicker mb-1 tracking-[0.16em] text-zinc-500 uppercase">
                      Active gap
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={1440}
                      value={String(activityGapMinutes)}
                      onChange={(event) => {
                        const nextValue = Number.parseInt(
                          event.target.value,
                          10
                        )
                        if (Number.isNaN(nextValue)) return
                        onActivityGapMinutesChange(nextValue)
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onExportCsv}
                    disabled={!analytics}
                  >
                    <Download className="mr-1.5 size-4" />
                    Export CSV
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onExportJson}
                    disabled={!analytics}
                  >
                    <FileBarChart2 className="mr-1.5 size-4" />
                    Export JSON
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
            <ScrollArea className="mission-scrollbar min-w-0 flex-1 px-5 py-4">
              {renderAnalyticsBody({
                selectedThread,
                analytics,
                isLoading,
                isRefreshing,
                errorMessage,
                agentRepeatSessionId,
                onRunAgentRepeatAnalysis,
              })}
            </ScrollArea>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 w-full min-w-0 bg-[var(--claw-bg-page)] pt-4 pr-6 pb-6 pl-4">
      <Card className="h-full w-full min-w-0 border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
        <CardContent className="h-full min-w-0 p-0">
          <div className="flex h-full min-w-0 flex-col">
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="claw-title-detail font-semibold tracking-[-0.03em] text-zinc-100">
                      Thread Analytics
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {selectedThread.type.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-sm text-zinc-300">
                    {selectedThread.title}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[8rem]">
                    <div className="claw-kicker mb-1 tracking-[0.16em] text-zinc-500 uppercase">
                      Active gap
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={1440}
                      value={String(activityGapMinutes)}
                      onChange={(event) => {
                        const nextValue = Number.parseInt(
                          event.target.value,
                          10
                        )
                        if (Number.isNaN(nextValue)) return
                        onActivityGapMinutesChange(nextValue)
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onExportCsv}
                    disabled={!analytics}
                  >
                    <Download className="mr-1.5 size-4" />
                    Export CSV
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onExportJson}
                    disabled={!analytics}
                  >
                    <FileBarChart2 className="mr-1.5 size-4" />
                    Export JSON
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
            <ScrollArea className="mission-scrollbar min-w-0 flex-1 px-5 py-4">
              {isLoading ? (
                <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
                  Loading analytics…
                </div>
              ) : analytics ? (
                <div className="w-full min-w-0 space-y-6">
                  {errorMessage ? (
                    <div className="rounded-[4px] border border-red-500/20 bg-red-500/[0.06] px-4 py-4 text-sm text-red-200">
                      {errorMessage}
                    </div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard
                      label="Messages"
                      value={analytics.totalMessages}
                    />
                    <MetricCard
                      label="Senders"
                      value={analytics.totalSenders}
                    />
                    <MetricCard
                      label="Sessions"
                      value={analytics.totalSessions}
                    />
                    <MetricCard
                      label="Thread length"
                      value={formatDurationMinutes(analytics.elapsedMinutes)}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard
                      label="Your messages"
                      value={analytics.requestingUserMessageCount}
                    />
                    <MetricCard
                      label="Agent messages"
                      value={analytics.agentMessageCount}
                    />
                    <MetricCard
                      label="User messages"
                      value={analytics.userMessageCount}
                    />
                    <MetricCard
                      label="Active windows"
                      value={analytics.activePeriods.length}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoCard
                      label="First message"
                      value={formatDateTime(analytics.firstMessageAt)}
                    />
                    <InfoCard
                      label="Last message"
                      value={formatDateTime(analytics.lastMessageAt)}
                    />
                  </div>

                  <section className="space-y-3">
                    <SectionTitle
                      title="Messages By Sender"
                      subtitle="Sorted by total messages sent in this thread."
                    />
                    <div className="grid gap-3">
                      {analytics.messageCountsBySender.map((entry) => (
                        <div
                          key={entry.senderKey}
                          className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-zinc-100">
                                {entry.senderName}
                              </div>
                              <div className="claw-meta mt-1 flex flex-wrap gap-2 text-zinc-400">
                                <Badge
                                  variant="secondary"
                                  className="capitalize"
                                >
                                  {entry.senderKind}
                                </Badge>
                                <span>{entry.sessionCount} sessions</span>
                                <span>
                                  {Math.round(entry.shareOfMessages * 100)}% of
                                  thread
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-semibold text-zinc-100">
                                {entry.messageCount}
                              </div>
                              <div className="claw-meta text-zinc-500">
                                {formatDateTime(entry.firstMessageAt)} to{" "}
                                {formatDateTime(entry.lastMessageAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <SectionTitle
                      title="Active Periods"
                      subtitle={`A new active window starts when the gap between messages exceeds ${analytics.activityGapMinutes} minutes.`}
                    />
                    <div className="grid gap-3">
                      {analytics.activePeriods.length ? (
                        analytics.activePeriods.map((period, index) => (
                          <div
                            key={`${period.startedAt}-${period.endedAt}-${index}`}
                            className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-zinc-100">
                                  Window {index + 1}
                                </div>
                                <div className="claw-caption mt-1 leading-5 text-zinc-400">
                                  {formatDateTime(period.startedAt)} to{" "}
                                  {formatDateTime(period.endedAt)}
                                </div>
                              </div>
                              <div className="claw-meta flex flex-wrap items-center gap-2 text-zinc-300">
                                <Badge variant="secondary">
                                  {period.messageCount} messages
                                </Badge>
                                <Badge variant="outline">
                                  {period.uniqueSenderCount} senders
                                </Badge>
                                <Badge variant="outline">
                                  {formatDurationMinutes(
                                    period.durationMinutes
                                  )}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-8 text-sm text-zinc-500">
                          No messages yet in this thread.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <SectionTitle
                      title="Session Breakdown"
                      subtitle="Shows wrapped-up team chat cycles alongside the current session. Repeat analysis only runs when you click Run Repeat Analysis for a specific session."
                    />
                    <div className="grid gap-3">
                      {analytics.sessionBreakdown.map((session, index) => (
                        <div
                          key={session.threadSessionId}
                          className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-zinc-100">
                                Session {session.sequenceNumber ?? index + 1}
                              </div>
                              <div className="claw-caption mt-1 leading-5 text-zinc-400">
                                {formatDateTime(session.firstMessageAt)} to{" "}
                                {formatDateTime(session.lastMessageAt)}
                              </div>
                            </div>
                            <div className="claw-meta flex flex-wrap items-center gap-2 text-zinc-300">
                              <Badge variant="secondary">
                                {session.messageCount} messages
                              </Badge>
                              <Badge variant="outline">
                                {session.agentMessageCount} agent
                              </Badge>
                              <Badge variant="outline">
                                {session.requestingUserMessageCount} yours
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {session.status ?? "unknown"}
                              </Badge>
                            </div>
                          </div>
                          <SessionInterventionAnalysis session={session} />
                          <SessionAgentRepeatAnalysis
                            session={session}
                            isRefreshing={isRefreshing}
                            isTargeted={
                              agentRepeatSessionId === session.threadSessionId
                            }
                            onRunAgentRepeatAnalysis={onRunAgentRepeatAnalysis}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : errorMessage ? (
                <div className="rounded-[4px] border border-red-500/20 bg-red-500/[0.06] px-4 py-8 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : (
                <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
                  No analytics available for this thread yet.
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function renderAnalyticsBody({
  analytics,
  isLoading,
  isRefreshing,
  errorMessage,
  agentRepeatSessionId,
  onRunAgentRepeatAnalysis,
}: {
  selectedThread: Thread
  analytics: ThreadAnalytics | null
  isLoading: boolean
  isRefreshing: boolean
  errorMessage?: string | null
  agentRepeatSessionId: string | null
  onRunAgentRepeatAnalysis: (threadSessionId: string) => void
}) {
  if (isLoading) {
    return (
      <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
        Loading analytics…
      </div>
    )
  }

  if (!analytics) {
    return errorMessage ? (
      <div className="rounded-[4px] border border-red-500/20 bg-red-500/[0.06] px-4 py-8 text-sm text-red-200">
        {errorMessage}
      </div>
    ) : (
      <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-zinc-400">
        No analytics available for this thread yet.
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {errorMessage ? (
        <div className="rounded-[4px] border border-red-500/20 bg-red-500/[0.06] px-4 py-4 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Messages" value={analytics.totalMessages} />
        <MetricCard label="Senders" value={analytics.totalSenders} />
        <MetricCard label="Sessions" value={analytics.totalSessions} />
        <MetricCard
          label="Thread length"
          value={formatDurationMinutes(analytics.elapsedMinutes)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Your messages"
          value={analytics.requestingUserMessageCount}
        />
        <MetricCard
          label="Agent messages"
          value={analytics.agentMessageCount}
        />
        <MetricCard label="User messages" value={analytics.userMessageCount} />
        <MetricCard
          label="Active windows"
          value={analytics.activePeriods.length}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard
          label="First message"
          value={formatDateTime(analytics.firstMessageAt)}
        />
        <InfoCard
          label="Last message"
          value={formatDateTime(analytics.lastMessageAt)}
        />
      </div>

      <section className="space-y-3">
        <SectionTitle
          title="Messages By Sender"
          subtitle="Sorted by total messages sent in this thread."
        />
        <div className="grid gap-3">
          {analytics.messageCountsBySender.map((entry) => (
            <div
              key={entry.senderKey}
              className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    {entry.senderName}
                  </div>
                  <div className="claw-meta mt-1 flex flex-wrap gap-2 text-zinc-400">
                    <Badge variant="secondary" className="capitalize">
                      {entry.senderKind}
                    </Badge>
                    <span>{entry.sessionCount} sessions</span>
                    <span>
                      {Math.round(entry.shareOfMessages * 100)}% of thread
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold text-zinc-100">
                    {entry.messageCount}
                  </div>
                  <div className="claw-meta text-zinc-500">
                    {formatDateTime(entry.firstMessageAt)} to{" "}
                    {formatDateTime(entry.lastMessageAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Active Periods"
          subtitle={`A new active window starts when the gap between messages exceeds ${analytics.activityGapMinutes} minutes.`}
        />
        <div className="grid gap-3">
          {analytics.activePeriods.length ? (
            analytics.activePeriods.map((period, index) => (
              <div
                key={`${period.startedAt}-${period.endedAt}-${index}`}
                className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      Window {index + 1}
                    </div>
                    <div className="claw-caption mt-1 leading-5 text-zinc-400">
                      {formatDateTime(period.startedAt)} to{" "}
                      {formatDateTime(period.endedAt)}
                    </div>
                  </div>
                  <div className="claw-meta flex flex-wrap items-center gap-2 text-zinc-300">
                    <Badge variant="secondary">
                      {period.messageCount} messages
                    </Badge>
                    <Badge variant="outline">
                      {period.uniqueSenderCount} senders
                    </Badge>
                    <Badge variant="outline">
                      {formatDurationMinutes(period.durationMinutes)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-8 text-sm text-zinc-500">
              No messages yet in this thread.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Session Breakdown"
          subtitle="Shows wrapped-up team chat cycles alongside the current session. Repeat analysis only runs when you click Run Repeat Analysis for a specific session."
        />
        <div className="grid gap-3">
          {analytics.sessionBreakdown.map((session, index) => (
            <div
              key={session.threadSessionId}
              className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    Session {session.sequenceNumber ?? index + 1}
                  </div>
                  <div className="claw-caption mt-1 leading-5 text-zinc-400">
                    {formatDateTime(session.firstMessageAt)} to{" "}
                    {formatDateTime(session.lastMessageAt)}
                  </div>
                </div>
                <div className="claw-meta flex flex-wrap items-center gap-2 text-zinc-300">
                  <Badge variant="secondary">
                    {session.messageCount} messages
                  </Badge>
                  <Badge variant="outline">
                    {session.agentMessageCount} agent
                  </Badge>
                  <Badge variant="outline">
                    {session.requestingUserMessageCount} yours
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {session.status ?? "unknown"}
                  </Badge>
                </div>
              </div>
              <SessionInterventionAnalysis session={session} />
              <SessionAgentRepeatAnalysis
                session={session}
                isRefreshing={isRefreshing}
                isTargeted={agentRepeatSessionId === session.threadSessionId}
                onRunAgentRepeatAnalysis={onRunAgentRepeatAnalysis}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-4">
      <div className="claw-kicker tracking-[0.16em] text-zinc-500 uppercase">
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-zinc-100">
        {value}
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-4">
      <div className="claw-kicker tracking-[0.16em] text-zinc-500 uppercase">
        {label}
      </div>
      <div className="mt-2 text-sm leading-6 text-zinc-100">{value}</div>
    </div>
  )
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div>
      <div className="text-lg font-semibold tracking-[-0.02em] text-zinc-100">
        {title}
      </div>
      <div className="mt-1 text-sm text-zinc-400">{subtitle}</div>
    </div>
  )
}

function SessionInterventionAnalysis({
  session,
}: {
  session: ThreadAnalyticsSessionStat
}) {
  if (!session.requestingUserMessageCount) {
    return (
      <div className="claw-caption mt-3 rounded-[4px] border border-dashed border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-3 py-3 text-zinc-500">
        No messages from you in this session.
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="claw-meta font-semibold tracking-[0.16em] text-zinc-500 uppercase">
          Your Intervention Analysis
        </div>
        <Badge variant="secondary">
          {session.requestingUserMessageCount} messages
        </Badge>
        {session.messagesAfterLongSilenceCount > 0 ? (
          <Badge variant="outline">
            {session.messagesAfterLongSilenceCount} after silence
          </Badge>
        ) : null}
        {session.messagesAfterAgentSilenceCount > 0 ? (
          <Badge variant="outline">
            {session.messagesAfterAgentSilenceCount} after agent silence
          </Badge>
        ) : null}
        {session.medianMinutesSincePreviousAgentMessage !== null ? (
          <Badge variant="outline">
            Median{" "}
            {formatMinutesValue(session.medianMinutesSincePreviousAgentMessage)}{" "}
            after agent
          </Badge>
        ) : null}
      </div>

      {session.requestingUserAnalysis?.status === "failed" ? (
        <div className="rounded-[4px] border border-amber-500/20 bg-amber-500/[0.06] px-3 py-3 text-sm text-amber-100">
          {session.requestingUserAnalysis.errorMessage ??
            "Message analysis failed for this session."}
        </div>
      ) : session.requestingUserAnalysis ? (
        <div className="space-y-3">
          {session.requestingUserAnalysis.summary ? (
            <div className="text-sm leading-6 text-zinc-200">
              {session.requestingUserAnalysis.summary}
            </div>
          ) : null}

          {session.requestingUserAnalysis.timingInterpretation ? (
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-3 text-sm leading-6 text-zinc-300">
              {session.requestingUserAnalysis.timingInterpretation}
            </div>
          ) : null}

          <div className="claw-meta flex flex-wrap gap-2 text-zinc-300">
            {session.requestingUserAnalysis.repeatedInstructionShare !==
            null ? (
              <Badge variant="outline">
                {formatShare(
                  session.requestingUserAnalysis.repeatedInstructionShare
                )}{" "}
                repeatable
              </Badge>
            ) : null}
            {session.requestingUserAnalysis.oneOffIssueShare !== null ? (
              <Badge variant="outline">
                {formatShare(session.requestingUserAnalysis.oneOffIssueShare)}{" "}
                one-off
              </Badge>
            ) : null}
            {session.requestingUserAnalysis.silencePromptShare !== null ? (
              <Badge variant="outline">
                {formatShare(session.requestingUserAnalysis.silencePromptShare)}{" "}
                silence-driven
              </Badge>
            ) : null}
          </div>

          {session.requestingUserAnalysis.dominantIntentLabels.length ? (
            <div className="flex flex-wrap gap-2">
              {session.requestingUserAnalysis.dominantIntentLabels.map(
                (label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                )
              )}
            </div>
          ) : null}

          {session.requestingUserAnalysis.repeatedPatterns.length ? (
            <CompactList
              title="Recurring patterns"
              items={session.requestingUserAnalysis.repeatedPatterns}
            />
          ) : null}

          {session.requestingUserAnalysis.oneOffIssues.length ? (
            <CompactList
              title="One-off issues"
              items={session.requestingUserAnalysis.oneOffIssues}
            />
          ) : null}

          {session.requestingUserAnalysis.clusters.length ? (
            <div className="space-y-2">
              <div className="claw-meta font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                Emergent categories
              </div>
              <div className="grid gap-2">
                {session.requestingUserAnalysis.clusters.map((cluster) => (
                  <div
                    key={`${cluster.label}-${cluster.description}`}
                    className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-zinc-100">
                        {cluster.label}
                      </div>
                      <Badge variant="outline">
                        {cluster.messageCount} messages
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm leading-6 text-zinc-300">
                      {cluster.description}
                    </div>
                    {cluster.exampleMessages.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {cluster.exampleMessages.map((message, index) => (
                          <div
                            key={`${cluster.label}-${index}`}
                            className="claw-meta rounded-full border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-black/25 px-2.5 py-1 text-zinc-400"
                          >
                            {truncateMessage(message)}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-zinc-500">
          Analysis unavailable for this session.
        </div>
      )}
    </div>
  )
}

function SessionAgentRepeatAnalysis({
  session,
  isRefreshing,
  isTargeted,
  onRunAgentRepeatAnalysis,
}: {
  session: ThreadAnalyticsSessionStat
  isRefreshing: boolean
  isTargeted: boolean
  onRunAgentRepeatAnalysis: (threadSessionId: string) => void
}) {
  if (!session.agentMessageCount) {
    return (
      <div className="claw-caption mt-3 rounded-[4px] border border-dashed border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-3 py-3 text-zinc-500">
        No agent messages in this session.
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="claw-meta font-semibold tracking-[0.16em] text-zinc-500 uppercase">
          Agent Repeat Analysis
        </div>
        <Badge variant="secondary">
          {session.agentMessageCount} agent messages
        </Badge>
        <Badge variant="outline">
          {session.repeatedAgentMessageCount} repeated
        </Badge>
        {session.agentRepeatAnalysisStatus === "failed" ? (
          <Badge variant="outline">analysis failed</Badge>
        ) : null}
        {session.agentRepeatAnalysisStatus === "not_run" ? (
          <Badge variant="outline">not run</Badge>
        ) : null}
        {session.repeatedCrossAgentMessageCount > 0 ? (
          <Badge variant="outline">
            {session.repeatedCrossAgentMessageCount} cross-agent
          </Badge>
        ) : null}
        {session.agentRepeatGroupCount > 0 ? (
          <Badge variant="outline">
            {session.agentRepeatGroupCount} repeat groups
          </Badge>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7"
          disabled={isRefreshing && isTargeted}
          onClick={() => onRunAgentRepeatAnalysis(session.threadSessionId)}
        >
          {isRefreshing && isTargeted ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : null}
          {session.agentRepeatAnalysisStatus === "not_run"
            ? "Run Repeat Analysis"
            : "Re-run Repeat Analysis"}
        </Button>
      </div>

      {session.agentRepeatAnalysisStatus === "failed" ? (
        <div className="rounded-[4px] border border-amber-500/20 bg-amber-500/[0.06] px-3 py-3 text-sm text-amber-100">
          {session.agentRepeatAnalysisErrorMessage ??
            "Agent repeat analysis failed for this session."}
        </div>
      ) : session.agentRepeatAnalysisStatus === "not_run" ? (
        <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-3 text-sm text-zinc-400">
          Repeat analysis has not been run for this session yet.
        </div>
      ) : session.agentRepeatGroupCount ? (
        <div className="space-y-3">
          <div className="text-sm leading-6 text-zinc-300">
            {formatShare(
              session.repeatedAgentMessageCount / session.agentMessageCount
            )}{" "}
            of agent messages in this session looked repeated.
          </div>

          <div className="grid gap-2">
            {session.repeatedAgentMessageGroups.map((group) => (
              <div
                key={`${group.representativeMessage}-${group.firstMessageAt}`}
                className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-zinc-100">
                    {truncateMessage(group.representativeMessage)}
                  </div>
                  <div className="claw-meta flex flex-wrap gap-2 text-zinc-300">
                    <Badge variant="secondary">
                      {group.occurrenceCount} times
                    </Badge>
                    <Badge variant="outline">
                      {group.repeatedCount} repeats
                    </Badge>
                    <Badge variant="outline">{group.senderCount} agents</Badge>
                  </div>
                </div>
                <div className="claw-caption mt-2 leading-5 text-zinc-400">
                  {group.senderNames.join(" · ")} ·{" "}
                  {formatDateTime(group.firstMessageAt)} to{" "}
                  {formatDateTime(group.lastMessageAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-zinc-500">
          No repeated agent messages detected in this session.
        </div>
      )}
    </div>
  )
}

function CompactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-2">
      <div className="claw-meta font-semibold tracking-[0.16em] text-zinc-500 uppercase">
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="claw-meta rounded-full border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-2.5 py-1 text-zinc-300"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDateTime(value?: string | null) {
  if (!value) return "n/a"
  return format(new Date(value), "MMM d, yyyy HH:mm")
}

function formatDurationMinutes(value: number) {
  if (value < 60) return `${value}m`
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

function formatMinutesValue(value: number) {
  return value < 60 ? `${value}m` : formatDurationMinutes(Math.round(value))
}

function formatShare(value: number) {
  return `${Math.round(value * 100)}%`
}

function truncateMessage(value: string) {
  if (value.length <= 80) return value
  return `${value.slice(0, 77).trim()}...`
}
