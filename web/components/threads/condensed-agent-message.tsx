"use client"

import { memo } from "react"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DepartmentAvatarBadge } from "@/components/shared/department-avatar-badge"
import type { AgentCardTone } from "@/components/threads/message-bubble"

export const CondensedAgentMessage = memo(function CondensedAgentMessage({
  senderName,
  createdAt,
  text,
  initials,
  resolvedAvatarUrl,
  departmentColor,
  runtimeLabel,
  agentTone,
  summaryState = "runtime",
}: {
  senderName: string
  createdAt: string
  text: string
  initials: (value: string) => string
  resolvedAvatarUrl?: string
  departmentColor?: string | null
  runtimeLabel?: string | null
  agentTone?: AgentCardTone
  summaryState?: "summary" | "unavailable" | "runtime"
}) {
  const showUnavailable = summaryState === "unavailable"
  const showSummary = summaryState === "summary"

  return (
    <div className="flex w-full">
      <div
        className="w-full rounded-[4px] border px-4 py-3 shadow-none"
        style={{
          borderColor: showUnavailable
            ? "rgba(248, 113, 113, 0.24)"
            : (agentTone?.border ??
              "var(--agent-card-border-2, rgba(52, 211, 153, 0.22))"),
          backgroundColor: showUnavailable
            ? "rgba(127, 29, 29, 0.18)"
            : (agentTone?.background ??
              "var(--agent-card-background-2, rgba(16, 185, 129, 0.08))"),
        }}
      >
        <div
          className="claw-kicker mb-1.5 flex flex-wrap items-center gap-2 tracking-[0.14em] uppercase"
          style={{
            color:
              agentTone?.label ??
              "var(--agent-card-label-2, rgba(209, 250, 229, 0.85))",
          }}
        >
          <Avatar
            className="size-8 border"
            style={{
              borderColor:
                agentTone?.border ??
                "var(--agent-card-border-2, rgba(52, 211, 153, 0.22))",
            }}
          >
            <AvatarImage src={resolvedAvatarUrl} />
            <AvatarFallback
              className="claw-meta font-semibold"
              style={{
                backgroundColor:
                  agentTone?.avatar ??
                  "var(--agent-card-avatar-2, rgba(52, 211, 153, 0.16))",
                color:
                  agentTone?.label ??
                  "var(--agent-card-label-2, rgb(209, 250, 229))",
              }}
            >
              {initials(senderName)}
            </AvatarFallback>
            <DepartmentAvatarBadge color={departmentColor} />
          </Avatar>
          <span className="text-sm font-semibold tracking-normal text-[var(--claw-text-primary)] normal-case">
            {senderName}
          </span>
          {runtimeLabel ? (
            <span className="claw-badge-text rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 tracking-[0.1em] text-zinc-300">
              {runtimeLabel}
            </span>
          ) : null}
          {showSummary ? (
            <span className="claw-badge-text rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 tracking-[0.1em] text-zinc-300">
              Summary
            </span>
          ) : null}
          {showUnavailable ? (
            <span className="claw-badge-text rounded-full border border-red-400/20 bg-red-500/10 px-1.5 py-0.5 tracking-[0.1em] text-red-100">
              Unavailable
            </span>
          ) : null}
          <span>{format(new Date(createdAt), "HH:mm")}</span>
        </div>
        <p
          className={`line-clamp-2 pl-10 text-sm leading-5 ${
            showUnavailable
              ? "text-red-50/90"
              : "text-[var(--claw-text-primary)]"
          }`}
        >
          {text}
        </p>
      </div>
    </div>
  )
})
