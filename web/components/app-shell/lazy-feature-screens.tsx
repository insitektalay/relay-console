"use client"

import dynamic from "next/dynamic"

import { ShellLoading } from "@/components/app-shell/skeletons"

export const MissionControlSection = dynamic(
  () =>
    import("@/components/mission-control/mission-control-section").then(
      (module) => module.MissionControlSection
    ),
  {
    ssr: false,
    loading: () => <ShellLoading />,
  }
)

export const AgentOpsHqScreen = dynamic(
  () =>
    import("@/components/agent-ops-hq/agent-ops-hq-screen").then(
      (module) => module.AgentOpsHqScreen
    ),
  {
    ssr: false,
    loading: () => <ShellLoading />,
  }
)
