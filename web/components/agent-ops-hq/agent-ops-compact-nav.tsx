import type { ReactNode } from "react"
import {
  Archive,
  Bot,
  ChartColumn,
  LayoutGrid,
  MessageSquare,
  Network,
  Settings2,
  Sparkles,
  Wrench,
} from "lucide-react"

import type { AppSection } from "@/components/app-shell/app-sidebar"

export function AgentOpsCompactNav({
  section,
  onSectionChange,
  showOperations,
  showAgentOps,
  showArtifacts,
  showMissionControl,
  showSetup,
}: {
  section: AppSection
  onSectionChange: (section: AppSection) => void
  showOperations: boolean
  showAgentOps: boolean
  showArtifacts: boolean
  showMissionControl: boolean
  showSetup: boolean
}) {
  const items: Array<{
    id: AppSection
    label: string
    icon: ReactNode
    show?: boolean
  }> = [
    { id: "setup", label: "Setup", icon: <Sparkles />, show: showSetup },
    { id: "threads", label: "Chats", icon: <MessageSquare /> },
    { id: "agents", label: "Agents", icon: <Bot /> },
    {
      id: "artifacts",
      label: "Artifacts",
      icon: <Archive />,
      show: showArtifacts,
    },
    {
      id: "agentOpsHq",
      label: "AgentOps HQ",
      icon: <Network />,
      show: showAgentOps,
    },
    {
      id: "missionControl",
      label: "Applications",
      icon: <LayoutGrid />,
      show: showMissionControl,
    },
    { id: "reports", label: "Insights", icon: <ChartColumn /> },
    { id: "settings", label: "Settings", icon: <Settings2 /> },
    {
      id: "operations",
      label: "Operations",
      icon: <Wrench />,
      show: showOperations,
    },
  ]

  return (
    <div className="absolute bottom-4 left-4 z-30 rounded-[6px] border border-white/10 bg-[#111922]/88 p-2 shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-1.5">
        {items
          .filter((item) => item.show !== false)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.label}
              className={`flex size-9 items-center justify-center rounded-[4px] border transition ${
                section === item.id
                  ? "border-[var(--claw-accent-blue)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_18%,transparent)] text-[var(--claw-accent-blue)]"
                  : "border-transparent text-zinc-400 hover:bg-white/[0.055] hover:text-zinc-100"
              }`}
              onClick={() => onSectionChange(item.id)}
            >
              <span className="[&_svg]:size-5">{item.icon}</span>
            </button>
          ))}
      </div>
    </div>
  )
}
