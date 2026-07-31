"use client"
import { useRelayConsoleShellState } from "./relay-console-controller/phase-01-shell-state"
import { useRelayConsoleFeatureStateAndAccess } from "./relay-console-controller/phase-02-feature-state-and-access"
import { useRelayConsoleWorkspaceQueries } from "./relay-console-controller/phase-03-workspace-queries"
import { useRelayConsoleWorkspaceModels } from "./relay-console-controller/phase-04-workspace-models"
import { useRelayConsoleReportsAndThreads } from "./relay-console-controller/phase-05-reports-and-threads"
import { useRelayConsoleListModels } from "./relay-console-controller/phase-06-list-models"
import { useRelayConsoleSelection } from "./relay-console-controller/phase-07-selection"
import { useRelayConsoleDetailQueries } from "./relay-console-controller/phase-08-detail-queries"
import { useRelayConsoleDataActions } from "./relay-console-controller/phase-09-data-actions"
import { useRelayConsoleThreadActions } from "./relay-console-controller/phase-10-thread-actions"
import { useRelayConsoleRuntimeActions } from "./relay-console-controller/phase-11-runtime-actions"
import { useRelayConsoleSynchronization } from "./relay-console-controller/phase-12-synchronization"
import { useRelayConsoleNavigation } from "./relay-console-controller/phase-13-navigation"
import { buildRelayConsoleController } from "./relay-console-controller/build-controller"
import { type RelayConsoleWebAppProps } from "./relay-console-controller/shared"

export { backendUnavailableMessage } from "./relay-console-controller/shared"
export type {
  AgentGroupType,
  AgentStructureCreateTarget,
  ThreadFilterGroup,
  AgentManagementTab,
  InsightsTab,
  NewChatMode,
  PublicSettingsView,
  RelayConsoleWebAppProps,
} from "./relay-console-controller/shared"

export function useRelayConsoleController(props: RelayConsoleWebAppProps) {
  const phase01 = useRelayConsoleShellState(props)
  const phase02 = useRelayConsoleFeatureStateAndAccess(phase01)
  const phase03 = useRelayConsoleWorkspaceQueries(phase02)
  const phase04 = useRelayConsoleWorkspaceModels(phase03)
  const phase05 = useRelayConsoleReportsAndThreads(phase04)
  const phase06 = useRelayConsoleListModels(phase05)
  const phase07 = useRelayConsoleSelection(phase06)
  const phase08 = useRelayConsoleDetailQueries(phase07)
  const phase09 = useRelayConsoleDataActions(phase08)
  const phase10 = useRelayConsoleThreadActions(phase09)
  const phase11 = useRelayConsoleRuntimeActions(phase10)
  const phase12 = useRelayConsoleSynchronization(phase11)
  const phase13 = useRelayConsoleNavigation(phase12)
  return buildRelayConsoleController(phase13)
}

export type RelayConsoleController = ReturnType<
  typeof useRelayConsoleController
>
