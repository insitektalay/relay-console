"use client"

import type { Paginated, Thread, ThreadWrapUpReport } from "@clawchat/contracts"
import type { Dispatch, SetStateAction } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import type { AppSection } from "@/components/app-shell/app-sidebar"
import type { ThreadPages } from "@/features/threads/thread-pages"
import { mapThreadPages } from "@/features/threads/thread-pages"
import { buildMessagesQueryKey } from "@/lib/message-cache"
import { sdk } from "@/lib/sdk"

const WRAP_UP_RECONCILE_INTERVAL_MS = 3_000
const WRAP_UP_RECONCILE_TIMEOUT_MS = 90_000

const isWrapUpReportPending = (report?: ThreadWrapUpReport | null) =>
  report?.status === "generating"

export function useRelayThreadWrapUpActions({
  effectiveWorkspaceId,
  queryClient,
  setMessageDraft,
  setSection,
  setSelectedReportId,
  setSelectedReportKind,
  setSelectedThreadId,
  setSelectedWrappedTranscript,
  threads,
}: {
  effectiveWorkspaceId: string | null
  queryClient: QueryClient
  setMessageDraft: (value: string) => void
  setSection: (value: AppSection) => void
  setSelectedReportId: (value: string | null) => void
  setSelectedReportKind: (value: "snapshot" | "wrap_up") => void
  setSelectedThreadId: (value: string | null) => void
  setSelectedWrappedTranscript: Dispatch<
    SetStateAction<ThreadWrapUpReport | null>
  >
  threads: Thread[]
}) {
  const applyWrapUpSuccessState = async (
    thread: Thread,
    wrappedReportItem: ThreadWrapUpReport,
    activeSessionId: string | null
  ) => {
    setMessageDraft("")
    setSelectedWrappedTranscript(null)

    queryClient.setQueryData<Paginated<import("@clawchat/contracts").Message>>(
      buildMessagesQueryKey(thread.id),
      {
        data: [],
        total: 0,
        page: 1,
        pageSize: 50,
        hasMore: false,
      }
    )
    queryClient.setQueriesData<ThreadPages>(
      { queryKey: ["threads", effectiveWorkspaceId] },
      (current) =>
        mapThreadPages(current, (entry) =>
          entry.id === thread.id
            ? {
                ...entry,
                lastMessage: null,
                activeSessionId,
                updatedAt: new Date().toISOString(),
              }
            : entry
        )
    )
    queryClient.setQueryData<Paginated<ThreadWrapUpReport> | undefined>(
      ["thread-wrap-up-reports", thread.id],
      (current) => {
        const existing = current?.data ?? []
        if (existing.some((entry) => entry.id === wrappedReportItem.id)) {
          return current
        }
        return {
          data: [wrappedReportItem, ...existing],
          total: (current?.total ?? existing.length) + 1,
          page: current?.page ?? 1,
          pageSize: current?.pageSize ?? 20,
          hasMore: current?.hasMore ?? false,
        }
      }
    )
    queryClient.setQueryData<Paginated<ThreadWrapUpReport> | undefined>(
      ["wrap-up-reports", effectiveWorkspaceId],
      (current) => {
        const existing = current?.data ?? []
        if (existing.some((entry) => entry.id === wrappedReportItem.id)) {
          return current
        }
        return {
          data: [wrappedReportItem, ...existing],
          total: (current?.total ?? existing.length) + 1,
          page: current?.page ?? 1,
          pageSize: current?.pageSize ?? 100,
          hasMore: current?.hasMore ?? false,
        }
      }
    )
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["threads", effectiveWorkspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["wrap-up-reports", effectiveWorkspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["thread-wrap-up-reports", thread.id],
      }),
    ])
    setSelectedReportId(`wrap_up:${wrappedReportItem.id}`)
    setSelectedReportKind("wrap_up")
    setSelectedThreadId(thread.id)
    setSection("threads")
  }

  const reconcileWrapUpAfterError = async (
    thread: Thread,
    context:
      | {
          attemptStartedAt: string
          previousActiveSessionId: string | null
          previousReportCount: number
        }
      | undefined
  ) => {
    if (!effectiveWorkspaceId || !context) {
      return false
    }

    const startedAt = Date.parse(context.attemptStartedAt)
    const deadline = Date.now() + WRAP_UP_RECONCILE_TIMEOUT_MS

    while (Date.now() < deadline) {
      try {
        const [threadDetail, wrapUpReportsPage] = await Promise.all([
          sdk.threads.detail(thread.id),
          sdk.reports.wrapUps(
            effectiveWorkspaceId,
            undefined,
            1,
            20,
            thread.id
          ),
        ])

        const reports = wrapUpReportsPage.data ?? []
        const latestReport = reports[0] ?? null
        const latestReportCreatedAt = latestReport
          ? Date.parse(latestReport.createdAt)
          : NaN
        const activeSessionChanged =
          Boolean(threadDetail.activeSessionId) &&
          threadDetail.activeSessionId !== context.previousActiveSessionId
        const reportAdvanced =
          reports.length > context.previousReportCount ||
          (latestReport &&
            Number.isFinite(latestReportCreatedAt) &&
            latestReportCreatedAt >= startedAt - 1000)

        if (
          latestReport &&
          activeSessionChanged &&
          threadDetail.lastMessage === null &&
          reportAdvanced
        ) {
          await applyWrapUpSuccessState(
            thread,
            latestReport,
            threadDetail.activeSessionId ?? null
          )
          toast.success(
            `Wrap-up complete. ${thread.title} is ready for a new blank conversation.`
          )
          return true
        }
      } catch {
        // Keep polling Railway-backed state until the timeout window closes.
      }

      await new Promise((resolve) =>
        setTimeout(resolve, WRAP_UP_RECONCILE_INTERVAL_MS)
      )
    }

    return false
  }

  const formatWrapUpErrorMessage = (error: Error) => {
    const message = error.message || "Wrap-up failed"

    if (
      message.includes(
        "No bridge control client with structured-prompt support is connected"
      ) ||
      message.includes("No local bridge control client is connected") ||
      message.includes("Runtime structured job failed") ||
      message.includes("No connected OpenClaw or Hermes runtime agent")
    ) {
      return "Wrap-up requires a connected OpenClaw or Hermes runtime agent with structured-job support."
    }

    return message
  }

  const updateWrapUpReportInCaches = (updatedReport: ThreadWrapUpReport) => {
    const updatePage = (
      current: Paginated<ThreadWrapUpReport> | undefined
    ): Paginated<ThreadWrapUpReport> | undefined => {
      if (!current) return current
      return {
        ...current,
        data: current.data.map((entry) =>
          entry.id === updatedReport.id ? updatedReport : entry
        ),
      }
    }

    queryClient.setQueryData<ThreadWrapUpReport>(
      ["report", "wrap_up", updatedReport.id],
      updatedReport
    )
    queryClient.setQueryData<Paginated<ThreadWrapUpReport> | undefined>(
      ["wrap-up-reports", effectiveWorkspaceId],
      updatePage
    )
    queryClient.setQueryData<Paginated<ThreadWrapUpReport> | undefined>(
      ["thread-wrap-up-reports", updatedReport.threadId],
      updatePage
    )
  }

  const threadWrapUpMutation = useMutation({
    mutationFn: async (thread: Thread) => sdk.threads.wrapUp(thread.id),
    onMutate: async (thread) => {
      const existingReports =
        queryClient.getQueryData<Paginated<ThreadWrapUpReport>>([
          "thread-wrap-up-reports",
          thread.id,
        ])?.data ?? []
      const existingThread =
        threads.find((entry) => entry.id === thread.id) ?? null

      return {
        attemptStartedAt: new Date().toISOString(),
        previousActiveSessionId: existingThread?.activeSessionId ?? null,
        previousReportCount: existingReports.length,
      }
    },
    onSuccess: async (result, thread) => {
      await applyWrapUpSuccessState(
        thread,
        result.report,
        result.activeSessionId ?? null
      )
      toast.success(
        isWrapUpReportPending(result.report)
          ? `${thread.title} is reset. The wrap-up report is generating in the background.`
          : `Wrap-up complete. ${thread.title} is ready for a new blank conversation.`
      )
    },
    onError: async (
      error: Error,
      thread,
      context:
        | {
            attemptStartedAt: string
            previousActiveSessionId: string | null
            previousReportCount: number
          }
        | undefined
    ) => {
      const reconciled = await reconcileWrapUpAfterError(thread, context)
      if (!reconciled) {
        toast.error(formatWrapUpErrorMessage(error))
      }
    },
  })

  const wrapUpReportRetryMutation = useMutation({
    mutationFn: async (report: ThreadWrapUpReport & { reportId?: string }) =>
      sdk.reports.retryWrapUp(report.reportId ?? report.id),
    onSuccess: async (updatedReport) => {
      updateWrapUpReportInCaches(updatedReport)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["report", "wrap_up", updatedReport.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["wrap-up-reports", effectiveWorkspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["thread-wrap-up-reports", updatedReport.threadId],
        }),
      ])
      toast.success("Report retry started")
    },
    onError: (error: Error) => toast.error(formatWrapUpErrorMessage(error)),
  })

  return { threadWrapUpMutation, wrapUpReportRetryMutation }
}
