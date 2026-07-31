"use client"

import { RelayConsoleListPane } from "@/components/app-shell/views/list-pane"
import { RelayConsoleDetailPane } from "@/components/app-shell/views/detail-pane"

import { Search } from "lucide-react"

import { appConfig } from "@/lib/config"

import { DesktopShell } from "@/components/app-shell/desktop-shell"
import { AppSidebar } from "@/components/app-shell/app-sidebar"
import { RealtimeConnectionStatus } from "@/components/app-shell/realtime-connection-status"

import { AgentOpsCompactNav } from "@/components/agent-ops-hq/agent-ops-compact-nav"

import { Button } from "@/components/ui/button"

import type { RelayConsoleController } from "@/components/clawchat-web-app"
import { AgentOpsHqScreen } from "@/components/app-shell/lazy-feature-screens"

export function RelayConsoleAuthenticatedShell({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    agentOpsLayoutEditMode,
    agents,
    approvals,
    authenticatedUser,
    canAccessAgentOps,
    canAccessApplications,
    canAccessOperations,
    commandPaletteIndex,
    commandPaletteOpen,
    commandPaletteSearch,
    departments,
    effectiveSection,
    effectiveWorkspaceId,
    filteredCommandPaletteCommands,
    isWorkspaceAdmin,
    messages,
    realtime,
    selectedThread,
    serverEntitlements,
    setAgentOpsLayoutEditMode,
    setCommandPaletteIndex,
    setCommandPaletteOpen,
    setCommandPaletteSearch,
    setIsCreatingTask,
    setMissionControlView,
    setMarketplaceReturnAppSlug,
    setSection,
    setSettingsView,
    setSidebarCollapsed,
    setTaskPanelMode,
    sidebarCollapsed,
    tasks,
    threads,
    workspaceIsReadOnly,
  } = controller

  if (effectiveSection === "agentOpsHq") {
    return (
      <div className="mission-shell h-screen w-screen overflow-hidden bg-[var(--claw-bg-page)] text-[var(--claw-text-primary)]">
        <div className="relative h-full">
          <AgentOpsHqScreen
            key={effectiveWorkspaceId ?? "global"}
            workspaceId={effectiveWorkspaceId ?? "global"}
            agents={agents}
            departments={departments}
            tasks={tasks}
            approvals={approvals}
            messages={selectedThread ? messages : []}
            threads={threads}
            runtimeDispatches={Object.values(realtime.runtimeDispatches).flat()}
            runtimeHealth={
              effectiveWorkspaceId
                ? (realtime.runtimeParticipantHealth[effectiveWorkspaceId] ??
                  [])
                : []
            }
            runtimeContextUsage={Object.values(
              realtime.runtimeContextUsage
            ).flat()}
            agentOpsLiveStates={realtime.agentOpsLiveStates}
            onRequestAgentOpsLiveState={realtime.requestAgentOpsLiveState}
            onLayoutEditModeChange={setAgentOpsLayoutEditMode}
            debugControlsEnabled={appConfig.enableAgentOpsDebugControls}
          />
          {!agentOpsLayoutEditMode ? (
            <AgentOpsCompactNav
              section={effectiveSection}
              onSectionChange={setSection}
              showOperations={canAccessOperations}
              showAgentOps={canAccessAgentOps}
              showArtifacts={Boolean(isWorkspaceAdmin)}
              showMissionControl={canAccessApplications}
              showSetup={!effectiveWorkspaceId}
            />
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <>
      {workspaceIsReadOnly ? (
        <div
          className="fixed inset-x-0 top-0 z-[110] flex flex-wrap items-center justify-center gap-2 border-b border-amber-400/40 bg-amber-950 px-4 py-2 text-center text-sm font-semibold text-amber-100"
          role="status"
        >
          <span>
            This Relay workspace is read-only ({serverEntitlements?.status}).
            Export and account recovery remain available.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSection("settings")
              setSettingsView("billing")
            }}
          >
            Manage billing
          </Button>
        </div>
      ) : null}
      <RealtimeConnectionStatus connectionState={realtime.connectionState} />
      <DesktopShell
        header={null}
        sidebarCollapsed={sidebarCollapsed}
        sidebar={
          <AppSidebar
            section={effectiveSection}
            onSectionChange={(nextSection) => {
              if (nextSection === "tasks") {
                setTaskPanelMode("approvals")
                setIsCreatingTask(false)
              }
              if (nextSection === "missionControl") {
                setMissionControlView("marketplace")
                setMarketplaceReturnAppSlug(null)
              }
              setSection(nextSection)
            }}
            showSetup={!effectiveWorkspaceId}
            showOperations={canAccessOperations}
            showAgentOps={canAccessAgentOps}
            showArtifacts={Boolean(isWorkspaceAdmin)}
            showMissionControl={canAccessApplications}
            user={authenticatedUser}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          >
            {<RelayConsoleListPane controller={controller} />}
          </AppSidebar>
        }
        detailPane={<RelayConsoleDetailPane controller={controller} />}
      />
      {commandPaletteOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-6 pt-[12vh] backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target)
              setCommandPaletteOpen(false)
          }}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-[12px] border border-[var(--claw-border)] bg-[#202832] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="flex h-[72px] items-center gap-4 border-b border-[var(--claw-border)] bg-[#10151b] px-6">
              <span className="text-2xl text-[#65a9ff]">⌘</span>
              <Search className="size-5 text-zinc-400" />
              <input
                autoFocus
                className="h-full min-w-0 flex-1 bg-transparent text-xl font-semibold text-zinc-100 outline-none placeholder:text-zinc-300"
                placeholder="Search commands"
                value={commandPaletteSearch}
                onChange={(event) => {
                  setCommandPaletteSearch(event.target.value)
                  setCommandPaletteIndex(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    setCommandPaletteIndex((current) =>
                      Math.min(
                        current + 1,
                        filteredCommandPaletteCommands.length - 1
                      )
                    )
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault()
                    setCommandPaletteIndex((current) =>
                      Math.max(current - 1, 0)
                    )
                  } else if (event.key === "Enter") {
                    event.preventDefault()
                    const command =
                      filteredCommandPaletteCommands[commandPaletteIndex]
                    if (command) {
                      command.run()
                      setCommandPaletteOpen(false)
                      setCommandPaletteSearch("")
                    }
                  }
                }}
              />
            </div>
            <div className="max-h-[560px] overflow-y-auto p-3">
              {(["Start", "Navigate"] as const).map((group) => {
                const commands = filteredCommandPaletteCommands.filter(
                  (command) => command.group === group
                )
                if (!commands.length) return null
                return (
                  <div key={group} className="mb-3">
                    <div className="claw-kicker px-3 py-2 font-semibold text-zinc-400 uppercase">
                      {group}
                    </div>
                    {commands.map((command) => {
                      const index =
                        filteredCommandPaletteCommands.indexOf(command)
                      return (
                        <button
                          key={command.label}
                          type="button"
                          className={`flex w-full items-center gap-4 rounded-[4px] border px-4 py-3 text-left ${index === commandPaletteIndex ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_16%,transparent)]" : "border-transparent hover:bg-white/5"}`}
                          onMouseEnter={() => setCommandPaletteIndex(index)}
                          onClick={() => {
                            command.run()
                            setCommandPaletteOpen(false)
                            setCommandPaletteSearch("")
                          }}
                        >
                          <span className="text-zinc-400 [&_svg]:size-5">
                            {command.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-zinc-100">
                              {command.label}
                            </span>
                            <span className="block text-sm text-zinc-400">
                              {command.description}
                            </span>
                          </span>
                          {command.label === "New Chat" ? (
                            <kbd className="rounded-[4px] bg-[#10151b] px-2 py-1 text-xs text-zinc-300">
                              ⌘N
                            </kbd>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
              {!filteredCommandPaletteCommands.length ? (
                <div className="px-4 py-12 text-center text-sm text-zinc-400">
                  No matching commands
                </div>
              ) : null}
            </div>
            <div className="flex h-11 items-center gap-5 border-t border-[var(--claw-border)] bg-[#10151b] px-5 text-xs text-zinc-400">
              <span>↵ Run</span>
              <span>↑↓ Move</span>
              <span>esc Close</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
