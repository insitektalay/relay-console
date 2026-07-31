"use client"
import {
  Archive,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  RefreshCcw,
  SquarePen,
  X,
} from "lucide-react"
import {
  APPLICATION_CATEGORY_LABELS,
  APPLICATION_FILTER_OPTIONS,
} from "@/lib/application-categories"
import { AppLogo } from "@/components/marketplace/app-logo"
import {
  initials,
  relativeTime,
  selectClassName,
} from "@/lib/relay-presentation-utils"
import { ArtifactsScreen } from "@/components/artifacts/artifacts-screen"
import { ThreadListPane } from "@/components/threads/thread-list-pane"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type {
  RelayConsoleController,
  ThreadFilterGroup,
} from "@/components/clawchat-web-app"
import { RelayConsoleAgentsListPane } from "@/components/app-shell/views/agents-list-pane"
import { RelayConsoleApprovalsListPane } from "@/components/app-shell/views/approvals-list-pane"
import { RelayConsoleTasksListPane } from "@/components/app-shell/views/tasks-list-pane"
import { RelayConsoleNewChatPane } from "@/components/app-shell/views/new-chat-pane"
import { RelayConsoleSettingsNavigationPane } from "@/components/app-shell/views/settings-navigation-pane"
import { RelayConsoleOperationsListPane } from "@/components/app-shell/views/operations-list-pane"

function ListAgentOpsSection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  return (
    <controller.PanelCard
      title="AgentOps HQ"
      description="A living estate map for your AI-operated business: buildings, floors, departments, apps, websites, outputs, workflows, and agents."
      showKicker={false}
    >
      <div className="space-y-4 text-sm leading-6 text-zinc-400">
        <p>
          The map controls, event feed, search, mock/live toggle, and debug
          tools are embedded in the AgentOps HQ map surface.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Agents", controller.agents.length],
            ["Departments", controller.departments.length],
            ["Tasks", controller.tasks.length],
            ["Approvals", controller.approvals.length],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_30%,transparent)] bg-[var(--claw-bg-surface)] p-3"
            >
              <div className="claw-kicker text-zinc-500 uppercase">{label}</div>
              <div className="mt-1 text-lg font-semibold text-zinc-100">
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </controller.PanelCard>
  )
}

function ListMissionControlSection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-[4px] border border-[var(--claw-border)] bg-[var(--claw-bg-surface)] text-zinc-400">
            <LayoutGrid className="size-4" />
          </div>
          <div className="claw-title-pane font-semibold tracking-[-0.02em]">
            Applications
          </div>
        </div>
        <Button
          size="icon-sm"
          variant="secondary"
          title="Refresh applications"
          disabled={
            controller.marketplaceCatalogQuery.isFetching ||
            controller.marketplaceInstallsQuery.isFetching ||
            controller.marketplaceConnectionsQuery.isFetching
          }
          onClick={() => {
            void controller.marketplaceCatalogQuery.refetch()
            void controller.marketplaceInstallsQuery.refetch()
            void controller.marketplaceConnectionsQuery.refetch()
          }}
        >
          <RefreshCcw
            className={`size-4 ${
              controller.marketplaceCatalogQuery.isFetching ||
              controller.marketplaceInstallsQuery.isFetching ||
              controller.marketplaceConnectionsQuery.isFetching
                ? "animate-spin"
                : ""
            }`}
          />
        </Button>
      </div>
      {controller.missionControlView === "marketplace" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-3">
            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-[6px] border px-3 py-3 text-left transition ${
                controller.marketplaceReturnAppSlug
                  ? "border-transparent hover:bg-[var(--claw-bg-surface)]"
                  : "border-[color-mix(in_srgb,var(--claw-accent-blue)_45%,var(--claw-border))] bg-[color-mix(in_srgb,var(--claw-accent-blue)_13%,var(--claw-bg-surface))]"
              }`}
              onClick={() => controller.setMarketplaceReturnAppSlug(null)}
            >
              <span className="flex size-9 items-center justify-center rounded-[6px] bg-blue-500/15 text-[#87bfff]">
                <LayoutGrid className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-100">
                  Browse apps
                </span>
                <span className="block text-xs text-zinc-500">
                  Open the marketplace
                </span>
              </span>
              <ChevronRight className="size-4 text-zinc-500" />
            </button>
          </div>
          <ScrollArea className="mission-scrollbar min-h-0 flex-1">
            <div className="p-3">
              <div className="flex items-center justify-between gap-3 px-2 py-2">
                <div className="claw-kicker font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                  Connected apps
                </div>
                <div
                  className="claw-meta text-zinc-500"
                  data-testid="marketplace-sidebar-count"
                >
                  {controller.marketplaceSidebarApps.length}
                </div>
              </div>
              {controller.marketplaceCatalogQuery.isLoading ? (
                <div className="px-3 py-8 text-center text-sm text-zinc-500">
                  Loading applications…
                </div>
              ) : controller.marketplaceCatalogQuery.isError ? (
                <div className="rounded-[4px] border border-red-500/20 bg-red-500/[0.05] px-3 py-5 text-center text-sm text-red-200">
                  <div>Could not load applications</div>
                  <button
                    type="button"
                    className="mt-2 text-xs underline"
                    onClick={() =>
                      void controller.marketplaceCatalogQuery.refetch()
                    }
                  >
                    Retry
                  </button>
                </div>
              ) : controller.marketplaceSidebarApps.length ? (
                <div className="space-y-1">
                  {controller.marketplaceSidebarApps.map((app) => {
                    const isSelected =
                      controller.marketplaceReturnAppSlug === app.slug
                    return (
                      <button
                        key={app.slug}
                        type="button"
                        className={`flex h-[58px] w-full items-center gap-3 rounded-[4px] border px-3 text-left transition ${
                          isSelected
                            ? "border-transparent bg-[color-mix(in_srgb,var(--claw-accent-blue)_17%,var(--claw-bg-surface))]"
                            : "border-transparent hover:bg-[var(--claw-bg-surface)]"
                        }`}
                        onClick={() =>
                          controller.setMarketplaceReturnAppSlug(app.slug)
                        }
                      >
                        <AppLogo app={app} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-200">
                          {app.name}
                        </span>
                        <span className="claw-kicker shrink-0 rounded-[4px] border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-300">
                          Connected
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="px-3 py-8 text-center text-sm text-zinc-500">
                  No connected applications yet. Browse the marketplace to
                  connect one.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ) : controller.missionControlView === "dashboard" ? (
        <ScrollArea className="mission-scrollbar min-h-0 flex-1 border-t border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)]">
          <div className="p-2.5">
            <div className="claw-kicker mb-2 px-1 font-medium tracking-[0.18em] text-zinc-500 uppercase">
              Filter
            </div>
            <div className="space-y-1.5">
              {APPLICATION_FILTER_OPTIONS.map((filter) => (
                <div key={filter} className="space-y-1">
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 rounded-[4px] border px-3 py-2 text-left transition ${
                      controller.applicationFilter.category === filter &&
                      !controller.applicationFilter.subgroup
                        ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_10%,var(--claw-bg-surface))] text-[var(--claw-text-primary)]"
                        : "border-transparent text-[var(--claw-text-muted)] hover:bg-[var(--claw-bg-surface)] hover:text-[var(--claw-text-primary)]"
                    }`}
                    onClick={() =>
                      controller.setApplicationFilter({ category: filter })
                    }
                  >
                    <span className="claw-caption font-semibold tracking-[-0.01em]">
                      {APPLICATION_CATEGORY_LABELS[filter]}
                    </span>
                    <span className="claw-kicker rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-medium text-zinc-300">
                      {controller.applicationCategoryCounts[filter]}
                    </span>
                  </button>
                  {filter !== "all"
                    ? controller.applicationSubgroups[filter].map(
                        (subgroup) => (
                          <button
                            key={`${filter}:${subgroup}`}
                            type="button"
                            className={`ml-4 flex w-[calc(100%-1rem)] items-center justify-between gap-3 rounded-[4px] border px-3 py-1.5 text-left transition ${
                              controller.applicationFilter.category ===
                                filter &&
                              controller.applicationFilter.subgroup === subgroup
                                ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_10%,var(--claw-bg-surface))] text-[var(--claw-text-primary)]"
                                : "border-transparent text-[var(--claw-text-muted)] hover:bg-[var(--claw-bg-surface)] hover:text-[var(--claw-text-primary)]"
                            }`}
                            onClick={() =>
                              controller.setApplicationFilter({
                                category: filter,
                                subgroup,
                              })
                            }
                          >
                            <span className="claw-meta truncate font-medium">
                              {subgroup}
                            </span>
                          </button>
                        )
                      )
                    : null}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      ) : null}
    </div>
  )
}

function ListThreadsSection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  return (
    <ThreadListPane
      search={controller.threadSearch}
      onSearchChange={controller.setThreadSearch}
      filters={
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All"],
                ["business", "Business"],
                ["family", "Family"],
                ["personal", "Personal"],
              ] as Array<[ThreadFilterGroup, string]>
            ).map(([value, label]) => (
              <Button
                key={value}
                size="xs"
                type="button"
                variant={
                  controller.threadFilterGroup === value ? "secondary" : "ghost"
                }
                onClick={() => {
                  controller.setThreadFilterGroup(value)
                  if (value !== "business") {
                    controller.setThreadFilterDepartmentId(null)
                  }
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          {controller.threadFilterGroup === "business" ? (
            <div className="flex items-center gap-2">
              <div className="claw-kicker tracking-[0.16em] text-zinc-500 uppercase">
                Department
              </div>
              <select
                className={`${selectClassName} claw-caption h-7 max-w-[12rem]`}
                value={controller.threadFilterDepartmentId ?? ""}
                onChange={(event) =>
                  controller.setThreadFilterDepartmentId(
                    event.target.value ? event.target.value : null
                  )
                }
              >
                <option value="">All departments</option>
                {controller.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      }
      isLoading={controller.threadsQuery.isLoading}
      hasMoreThreads={controller.threadsQuery.hasNextPage}
      isLoadingMoreThreads={controller.threadsQuery.isFetchingNextPage}
      onLoadMoreThreads={() => {
        void controller.threadsQuery.fetchNextPage()
      }}
      errorMessage={controller.threadListErrorMessage}
      threads={controller.filteredThreads}
      agents={controller.agents}
      departments={controller.departments}
      displayNamesByAgentId={controller.displayNameByAgentId}
      agentAppBadgesByAgentId={controller.agentAppBadgesByAgentId}
      selectedThreadId={controller.effectiveThreadId}
      onSelectThread={(threadId) => {
        controller.setOpenedThreadOverride(null)
        controller.setSelectedThreadId(threadId)
        controller.setSelectedApprovalId(null)
      }}
      onArchiveThread={(threadId) =>
        controller.threadArchiveMutation.mutate(threadId)
      }
      archivingThreadId={
        controller.threadArchiveMutation.isPending
          ? controller.threadArchiveMutation.variables
          : null
      }
      relativeTime={relativeTime}
      actions={null}
    />
  )
}

function ListReportsSection({
  controller,
}: {
  controller: RelayConsoleController
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-3 py-2.5">
        <div className="claw-title-pane font-semibold tracking-[-0.02em]">
          Insights
        </div>
        <Input
          placeholder="Search reports..."
          value={controller.reportSearchDraft}
          onChange={(event) =>
            controller.setReportSearchDraft(event.target.value)
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            className={`${selectClassName} claw-caption h-8`}
            value={controller.reportSourceFilter}
            onChange={(event) =>
              controller.setReportSourceFilter(
                event.target.value as "all" | "snapshot" | "wrap_up"
              )
            }
            aria-label="Filter reports by source"
          >
            <option value="all">All reports</option>
            <option value="snapshot">Snapshots</option>
            <option value="wrap_up">Chat reports</option>
          </select>
          <select
            className={`${selectClassName} claw-caption h-8`}
            value={controller.reportSortDraft}
            onChange={(event) =>
              controller.setReportSortDraft(
                event.target.value as "newest" | "oldest" | "title"
              )
            }
            aria-label="Sort reports"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title</option>
          </select>
        </div>
      </div>
      <ScrollArea className="mission-scrollbar min-h-0 flex-1">
        <div className="space-y-3 p-2.5">
          {controller.reportsQuery.isLoading ||
          controller.wrapUpReportsQuery.isLoading ? (
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-10 text-center text-sm text-[var(--claw-text-muted)]">
              Loading…
            </div>
          ) : controller.reportGroups.length ? (
            <div className="space-y-1.5">
              {controller.reportGroups.map((group) => {
                const isGrouped = group.isCollapsible
                const isExpanded =
                  !isGrouped ||
                  controller.expandedReportGroupIds[group.id] === true
                const isSelectedGroup = group.reports.some(
                  (report) => report.id === controller.selectedReport?.id
                )

                return (
                  <div
                    key={group.id}
                    className={`rounded-[4px] border ${
                      isSelectedGroup
                        ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_10%,var(--claw-bg-surface))]"
                        : "border-transparent"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition hover:bg-[var(--claw-bg-surface)]"
                      onClick={() => {
                        if (isGrouped) {
                          controller.setExpandedReportGroupIds((current) => ({
                            ...current,
                            [group.id]: !current[group.id],
                          }))
                          return
                        }

                        const report = group.reports[0]
                        if (!report) return
                        controller.selectReportFromList(report)
                      }}
                    >
                      <Avatar
                        size="sm"
                        className="!size-9 shrink-0 border border-white/8"
                      >
                        <AvatarImage src={group.avatarUrl ?? undefined} />
                        <AvatarFallback className="claw-meta font-semibold">
                          {initials(group.avatarLabel)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="claw-caption truncate font-semibold tracking-[-0.01em]">
                          {group.title}
                        </div>
                        <div className="claw-meta truncate leading-4 text-zinc-500">
                          {group.subtitle}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className={`claw-badge-text h-5 px-1.5 ${group.badgeTone}`}
                        >
                          {group.badgeLabel}
                        </Badge>
                        {isGrouped ? (
                          isExpanded ? (
                            <ChevronDown className="size-3.5 text-zinc-500" />
                          ) : (
                            <ChevronRight className="size-3.5 text-zinc-500" />
                          )
                        ) : (
                          <>
                            <span className="claw-badge-text hidden tracking-[0.12em] text-zinc-500 uppercase min-[380px]:inline">
                              {relativeTime(group.latestCreatedAt)}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              className="inline-flex size-6 items-center justify-center rounded-[4px] text-zinc-500 transition hover:text-zinc-100 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                              onClick={(event) => {
                                const report = group.reports[0]
                                if (!report) return
                                event.stopPropagation()
                                controller.archiveReportFromList(report.id)
                              }}
                              onKeyDown={(event) => {
                                const report = group.reports[0]
                                if (!report) return
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  controller.archiveReportFromList(report.id)
                                }
                              }}
                              aria-label={`Archive ${group.title}`}
                            >
                              <Archive className="size-3.5" />
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                    {isExpanded ? (
                      <div
                        className={
                          isGrouped ? "border-t border-white/7 py-1" : "hidden"
                        }
                      >
                        {group.reports.map((report) => (
                          <button
                            key={report.id}
                            type="button"
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-white/[0.03] ${
                              report.id === controller.selectedReport?.id
                                ? "text-[var(--claw-text-primary)]"
                                : "text-zinc-400"
                            }`}
                            onClick={() =>
                              controller.selectReportFromList(report)
                            }
                          >
                            <div className="min-w-0 flex-1">
                              <div className="claw-meta truncate font-medium">
                                {report.kind === "wrap_up"
                                  ? `Cycle ${report.threadSessionSequenceNumber}`
                                  : report.title}
                              </div>
                              <div className="claw-kicker truncate leading-4 text-zinc-500">
                                {report.kind === "wrap_up"
                                  ? report.status === "generating"
                                    ? "Generating report..."
                                    : report.status === "failed"
                                      ? "Report failed"
                                      : report.fileName
                                  : `${controller.titleCase(report.type)} · ${report.period}`}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="claw-badge-text tracking-[0.12em] text-zinc-500 uppercase">
                                {relativeTime(report.createdAt)}
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                className="inline-flex size-6 items-center justify-center rounded-[4px] text-zinc-500 transition hover:text-zinc-100 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  controller.archiveReportFromList(report.id)
                                }}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    controller.archiveReportFromList(report.id)
                                  }
                                }}
                                aria-label={`Archive ${report.title}`}
                              >
                                <Archive className="size-3.5" />
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title="No reports yet"
              description="Wrap up a chat to populate the reports centre."
            />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function RelayConsoleListPane({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    PanelCard,
    SetupForms,
    agentAppBadgesByAgentId,
    agents,
    departments,
    displayNameByAgentId,
    effectiveSection,
    effectiveThreadId,
    effectiveWorkspaceId,
    filteredThreads,
    isStartingChat,
    isWorkspaceAdmin,
    queryClient,
    renderEmptyProductRecoveryActions,
    selectedArtifactId,
    setInsightsTab,
    setIsStartingChat,
    setNewChatSearch,
    setOpenedThreadOverride,
    setSection,
    setSelectedApprovalId,
    setSelectedArtifactId,
    setSelectedThreadId,
    setThreadFilterDepartmentId,
    setThreadFilterGroup,
    setThreadSearch,
    setWorkspaceNameDraft,
    setWorkspaceTypeDraft,
    shouldShowEmptyProductRecoveryActions,
    taskPanelMode,
    threadArchiveMutation,
    threadFilterDepartmentId,
    threadFilterGroup,
    threadListErrorMessage,
    threadSearch,
    threadsQuery,
    workspaceCreateMutation,
    workspaceLoadErrorMessage,
    workspaceNameDraft,
    workspaceTypeDraft,
    workspacesQuery,
  } = controller

  if (
    typeof window !== "undefined" &&
    ["threads", "agents"].includes(effectiveSection)
  ) {
    if (!effectiveWorkspaceId) {
      if (workspacesQuery.isPending) {
        return (
          <div className="flex h-full items-center justify-center px-6">
            <EmptyState
              title="Loading workspaces"
              description="Checking the Relay service for your workspaces."
            />
          </div>
        )
      }

      if (workspaceLoadErrorMessage) {
        return (
          <PanelCard
            title="Workspace load failed"
            description="The app could not load your Relay workspaces."
            showKicker={false}
          >
            <div className="space-y-3">
              <EmptyState
                title="Could not load workspaces"
                description={workspaceLoadErrorMessage}
              />
              <Button
                className="w-full"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["workspaces"] })
                }
                type="button"
                variant="secondary"
              >
                <RefreshCcw className="size-4" />
                Retry
              </Button>
            </div>
          </PanelCard>
        )
      }

      return (
        <div className="flex h-full items-center justify-center px-6">
          <EmptyState
            title="No chats yet"
            description="Create or connect a workspace to populate conversations."
          />
        </div>
      )
    }

    if (effectiveSection === "agents") {
      return <RelayConsoleAgentsListPane controller={controller} />
    }
    if (effectiveSection === "threads" && isStartingChat) {
      return <RelayConsoleNewChatPane controller={controller} />
    }

    return (
      <ThreadListPane
        search={threadSearch}
        onSearchChange={setThreadSearch}
        isLoading={threadsQuery.isLoading}
        hasMoreThreads={threadsQuery.hasNextPage}
        isLoadingMoreThreads={threadsQuery.isFetchingNextPage}
        onLoadMoreThreads={() => {
          void threadsQuery.fetchNextPage()
        }}
        errorMessage={threadListErrorMessage}
        threads={filteredThreads}
        agents={agents}
        departments={departments}
        displayNamesByAgentId={displayNameByAgentId}
        agentAppBadgesByAgentId={agentAppBadgesByAgentId}
        emptyTitle={
          shouldShowEmptyProductRecoveryActions
            ? "No agents or conversations yet"
            : undefined
        }
        emptyDescription={
          shouldShowEmptyProductRecoveryActions
            ? "Start with an agent, runtime connection, or Marketplace app."
            : undefined
        }
        emptyActions={renderEmptyProductRecoveryActions()}
        selectedThreadId={effectiveThreadId}
        onSelectThread={(threadId) => {
          setOpenedThreadOverride(null)
          setSelectedThreadId(threadId)
          setSelectedApprovalId(null)
          setSection("threads")
        }}
        onArchiveThread={(threadId) => threadArchiveMutation.mutate(threadId)}
        archivingThreadId={
          threadArchiveMutation.isPending
            ? threadArchiveMutation.variables
            : null
        }
        relativeTime={relativeTime}
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            title={isStartingChat ? "Cancel new chat" : "New chat"}
            onClick={() => {
              setIsStartingChat((current) => !current)
              setNewChatSearch("")
            }}
          >
            {isStartingChat ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <SquarePen className="h-3.5 w-3.5" />
            )}
          </Button>
        }
      />
    )
  }

  if (effectiveSection === "agentOpsHq") {
    return <ListAgentOpsSection controller={controller} />
  }

  if (effectiveSection === "missionControl") {
    return <ListMissionControlSection controller={controller} />
  }

  if (!effectiveWorkspaceId && effectiveSection !== "setup") {
    if (workspacesQuery.isPending) {
      return (
        <PanelCard
          title="Loading workspaces"
          description="Checking the Relay service for your workspaces."
          showKicker={false}
        >
          <EmptyState
            title="Loading workspaces"
            description="Your existing workspace should appear once the Relay service responds."
          />
        </PanelCard>
      )
    }

    if (workspaceLoadErrorMessage) {
      return (
        <PanelCard
          title="Workspace load failed"
          description="The app could not load your Relay workspaces."
          showKicker={false}
        >
          <div className="space-y-3">
            <EmptyState
              title="Could not load workspaces"
              description={workspaceLoadErrorMessage}
            />
            <Button
              className="w-full"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["workspaces"] })
              }
              type="button"
              variant="secondary"
            >
              <RefreshCcw className="size-4" />
              Retry
            </Button>
          </div>
        </PanelCard>
      )
    }

    return (
      <PanelCard
        title="No workspace selected"
        description="Create a workspace first to unlock the rest of the desktop app."
        showKicker={false}
      >
        <EmptyState
          title="No workspace yet"
          description="Start by creating a workspace. The rest of the app stays hidden until that foundation exists."
        />
      </PanelCard>
    )
  }

  switch (effectiveSection) {
    case "setup":
      return (
        <PanelCard
          title="Workspace setup"
          description="Create your first workspace. More advanced structure and onboarding should happen in guided product flows, not raw setup forms."
          showKicker={false}
        >
          <SetupForms
            canCreateWorkspace={
              !workspaceNameDraft.trim()
                ? false
                : !workspaceCreateMutation.isPending
            }
            createWorkspaceError={
              workspaceCreateMutation.error instanceof Error
                ? workspaceCreateMutation.error.message
                : null
            }
            workspaceNameDraft={workspaceNameDraft}
            onWorkspaceNameChange={setWorkspaceNameDraft}
            workspaceTypeDraft={workspaceTypeDraft}
            onWorkspaceTypeChange={setWorkspaceTypeDraft}
            onCreateWorkspace={() => workspaceCreateMutation.mutate()}
          />
        </PanelCard>
      )
    case "threads":
      return <ListThreadsSection controller={controller} />
    case "analytics":
      return (
        <ThreadListPane
          search={threadSearch}
          onSearchChange={setThreadSearch}
          filters={
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "All"],
                    ["business", "Business"],
                    ["family", "Family"],
                    ["personal", "Personal"],
                  ] as Array<[ThreadFilterGroup, string]>
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    size="xs"
                    type="button"
                    variant={
                      threadFilterGroup === value ? "secondary" : "ghost"
                    }
                    onClick={() => {
                      setThreadFilterGroup(value)
                      if (value !== "business") {
                        setThreadFilterDepartmentId(null)
                      }
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {threadFilterGroup === "business" ? (
                <div className="flex items-center gap-2">
                  <div className="claw-kicker tracking-[0.16em] text-zinc-500 uppercase">
                    Department
                  </div>
                  <select
                    className={`${selectClassName} claw-caption h-7 max-w-[12rem]`}
                    value={threadFilterDepartmentId ?? ""}
                    onChange={(event) =>
                      setThreadFilterDepartmentId(
                        event.target.value ? event.target.value : null
                      )
                    }
                  >
                    <option value="">All departments</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          }
          isLoading={threadsQuery.isLoading}
          hasMoreThreads={threadsQuery.hasNextPage}
          isLoadingMoreThreads={threadsQuery.isFetchingNextPage}
          onLoadMoreThreads={() => {
            void threadsQuery.fetchNextPage()
          }}
          errorMessage={threadListErrorMessage}
          threads={filteredThreads}
          agents={agents}
          departments={departments}
          displayNamesByAgentId={displayNameByAgentId}
          agentAppBadgesByAgentId={agentAppBadgesByAgentId}
          selectedThreadId={effectiveThreadId}
          onSelectThread={(threadId) => {
            setOpenedThreadOverride(null)
            setSelectedThreadId(threadId)
            setSelectedApprovalId(null)
            setInsightsTab("analytics")
            setSection("reports")
          }}
          relativeTime={relativeTime}
          actions={null}
        />
      )
    case "agents":
      return <RelayConsoleAgentsListPane controller={controller} />
    case "artifacts":
      return (
        <ArtifactsScreen
          workspaceId={effectiveWorkspaceId}
          agents={agents}
          canManage={Boolean(isWorkspaceAdmin)}
          mode="sidebar"
          selectedId={selectedArtifactId}
          onSelectedIdChange={setSelectedArtifactId}
        />
      )
    case "reports":
      return <ListReportsSection controller={controller} />
    case "tasks":
      return taskPanelMode === "approvals" ? (
        <RelayConsoleApprovalsListPane controller={controller} />
      ) : (
        <RelayConsoleTasksListPane controller={controller} />
      )
    case "settings":
      return <RelayConsoleSettingsNavigationPane controller={controller} />
    case "operations":
      return <RelayConsoleOperationsListPane controller={controller} />
  }
}
