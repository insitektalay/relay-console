import { readFileSync, readdirSync } from "node:fs"

const viewDirectory = new URL("../components/app-shell/views/", import.meta.url)
const viewSources = readdirSync(viewDirectory)
  .filter((filename) => filename.endsWith(".tsx"))
  .sort()
  .map((filename) => new URL(filename, viewDirectory))

const controllerDirectory = new URL(
  "../components/app-shell/relay-console-controller/",
  import.meta.url
)
const controllerSources = readdirSync(controllerDirectory)
  .filter((filename) => /\.(?:ts|tsx)$/.test(filename))
  .sort((left, right) => {
    const rank = (filename: string) =>
      filename.startsWith("phase-") ? 0 : filename === "shared.tsx" ? 1 : 2
    return rank(left) - rank(right) || left.localeCompare(right)
  })
  .map((filename) => new URL(filename, controllerDirectory))

const relayAppFiles = [
  new URL("../components/clawchat-web-app.tsx", import.meta.url),
  new URL(
    "../components/app-shell/use-relay-console-controller.tsx",
    import.meta.url
  ),
  ...controllerSources,
  new URL(
    "../components/app-shell/relay-console-authenticated-shell.tsx",
    import.meta.url
  ),
  new URL("../components/app-shell/relay-console-domain.ts", import.meta.url),
  new URL(
    "../components/app-shell/relay-controller-agent-controls.tsx",
    import.meta.url
  ),
  new URL("../components/app-shell/relay-controller-data.ts", import.meta.url),
  new URL(
    "../components/app-shell/relay-controller-formatters.ts",
    import.meta.url
  ),
  new URL(
    "../components/app-shell/relay-controller-ui-primitives.tsx",
    import.meta.url
  ),
  new URL("../features/account/use-relay-account-actions.ts", import.meta.url),
  new URL(
    "../features/approvals/use-relay-approval-actions.ts",
    import.meta.url
  ),
  new URL("../features/agents/agent-creation.ts", import.meta.url),
  new URL("../features/agents/use-relay-agent-actions.ts", import.meta.url),
  new URL(
    "../features/integrations/use-relay-integration-actions.ts",
    import.meta.url
  ),
  new URL(
    "../features/organizations/use-relay-organization-actions.ts",
    import.meta.url
  ),
  new URL(
    "../features/runtime/use-relay-native-runtime-actions.tsx",
    import.meta.url
  ),
  new URL(
    "../features/runtime/use-relay-runtime-dispatch-actions.ts",
    import.meta.url
  ),
  new URL("../features/tasks/task-schedule.ts", import.meta.url),
  new URL("../features/tasks/use-relay-task-actions.ts", import.meta.url),
  new URL("../features/tasks/use-relay-task-create-action.ts", import.meta.url),
  new URL("../features/threads/thread-pages.ts", import.meta.url),
  new URL(
    "../features/threads/use-relay-send-message-action.ts",
    import.meta.url
  ),
  new URL(
    "../features/threads/use-relay-thread-wrap-up-actions.ts",
    import.meta.url
  ),
  ...viewSources,
  new URL("../components/agents/openclaw-library-card.tsx", import.meta.url),
  new URL("../components/agents/openclaw-library-paths.ts", import.meta.url),
  new URL(
    "../components/agents/use-openclaw-linked-local-sync.ts",
    import.meta.url
  ),
  new URL(
    "../components/agents/use-openclaw-library-finalize.ts",
    import.meta.url
  ),
  new URL(
    "../components/agents/openclaw-library-knowledge-view.tsx",
    import.meta.url
  ),
  new URL(
    "../components/agents/openclaw-library-workspace-view.tsx",
    import.meta.url
  ),
  new URL("../components/agents/linked-local-link-dialog.tsx", import.meta.url),
  new URL(
    "../components/agent-ops-hq/agent-ops-compact-nav.tsx",
    import.meta.url
  ),
  new URL("../components/shared/relay-compact-fields.tsx", import.meta.url),
  new URL("../components/shared/relay-markdown-content.tsx", import.meta.url),
  new URL("../lib/relay-presentation-utils.ts", import.meta.url),
]

export const relayAppSource = relayAppFiles
  .map((file) => readFileSync(file, "utf8"))
  .join("\n")
