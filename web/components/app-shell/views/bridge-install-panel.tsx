"use client"
import { Copy, Download } from "lucide-react"
import { toast } from "sonner"
import { appConfig } from "@/lib/config"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RelayConsoleController } from "@/components/clawchat-web-app"

const BRIDGE_INSTALLER_REVISION =
  "ff2c52e3858c71bebde400c008dd2a441e0b861b"

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

function bridgeInstallCommand(
  repositoryUrl: string,
  runtime: "hermes" | "openclaw",
  backendOrigin: string,
  externalAgentIds: string[] = []
) {
  const agentArguments =
    runtime === "hermes"
      ? externalAgentIds.map((id) => ` --agent ${shellQuote(id)}`).join("")
      : ""
  return [
    'RELAY_BRIDGE_INSTALL="$(mktemp -d)"',
    'git init "$RELAY_BRIDGE_INSTALL"',
    `git -C "$RELAY_BRIDGE_INSTALL" remote add origin '${repositoryUrl}.git'`,
    `git -C "$RELAY_BRIDGE_INSTALL" fetch --depth 1 origin ${BRIDGE_INSTALLER_REVISION}`,
    'git -C "$RELAY_BRIDGE_INSTALL" checkout --detach FETCH_HEAD',
    `"$RELAY_BRIDGE_INSTALL/install.sh" --runtime ${runtime} --api-url ${shellQuote(backendOrigin)}${agentArguments}`,
  ].join(" && ")
}

export function RelayConsoleBridgeInstallPanel({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    BRIDGE_PLUGIN_INSTALL_URL,
    BRIDGE_PLUGIN_REPO_URL,
    agents,
    getAgentRuntimeType,
    railwayHttpOriginFromWsBaseUrl,
  } = controller

  const hermesAgentIds = Array.from(
    new Set(
      agents
        .filter(
          (agent) =>
            getAgentRuntimeType(agent) === "hermes" &&
            (!agent.lifecycleStatus || agent.lifecycleStatus === "active")
        )
        .map(
          (agent) =>
            agent.runtimeBinding?.runtimeExternalAgentId ?? agent.externalId
        )
        .filter((id): id is string => Boolean(id?.trim()))
    )
  )

  const railwayBackendOrigin = railwayHttpOriginFromWsBaseUrl(
    appConfig.wsBaseUrl
  )
  const hermesInstallCommand = bridgeInstallCommand(
    BRIDGE_PLUGIN_REPO_URL,
    "hermes",
    railwayBackendOrigin,
    hermesAgentIds
  )
  const openClawInstallCommand = bridgeInstallCommand(
    BRIDGE_PLUGIN_REPO_URL,
    "openclaw",
    railwayBackendOrigin
  )
  const copyInstallText = (label: string, text: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error(`Could not copy ${label.toLowerCase()}`))
  }

  return (
    <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-sm font-medium text-zinc-100">
            Runtime bridge installer
          </div>
          <div className="mt-2 text-sm leading-6 text-zinc-400">
            Copy the command for the runtime computer. It downloads a pinned
            preview installer, detects the installed runtime version and
            preflights compatibility before asking for a one-time pairing code.
            Verified versions get full functionality; other compatible versions
            connect in Safe mode with advanced capabilities disabled.
            Hermes commands also register this workspace&apos;s current agent
            identities so Marketplace assignment works as soon as the bridge is
            online.
          </div>
        </div>
        <Badge variant="secondary">Pinned preview</Badge>
      </div>

      <div className="mt-4 grid gap-3 text-xs leading-5 text-zinc-400 md:grid-cols-3">
        <div className="rounded-[4px] border border-white/10 p-3">
          <div className="font-medium text-zinc-200">Verified</div>
          Tested runtime version with full reported capabilities.
        </div>
        <div className="rounded-[4px] border border-white/10 p-3">
          <div className="font-medium text-zinc-200">Compatible</div>
          Unverified version admitted in Safe mode with core messaging only.
        </div>
        <div className="rounded-[4px] border border-white/10 p-3">
          <div className="font-medium text-zinc-200">Unsupported</div>
          Blocked only for incompatible protocols, hosts, plugins, or runtime families.
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-zinc-400 md:grid-cols-3">
        <div>
          <div className="text-zinc-500">Backend origin</div>
          <div className="mt-1 font-mono break-all text-zinc-200">
            {railwayBackendOrigin}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">API prefix</div>
          <div className="mt-1 font-mono text-zinc-200">/api/v1</div>
        </div>
        <div>
          <div className="text-zinc-500">Websocket</div>
          <div className="mt-1 font-mono break-all text-zinc-200">
            {appConfig.wsBaseUrl}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-100">
                Hermes Agent
              </div>
              <div className="mt-1 text-xs leading-5 text-zinc-500">
                Paste into Terminal on the Mac, Mac mini or Linux VPS running
                Hermes Agent.
              </div>
            </div>
            <Button
              onClick={() =>
                copyInstallText("Hermes setup command", hermesInstallCommand)
              }
              size="sm"
              type="button"
              variant="secondary"
            >
              <Copy className="size-4" />
              Copy
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-[4px] bg-black/20 p-3 text-xs leading-6 text-zinc-200">
            <code>{hermesInstallCommand}</code>
          </pre>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium text-zinc-100">
                  OpenClaw
                </div>
                <Badge variant="secondary">Preview</Badge>
              </div>
              <div className="mt-1 text-xs leading-5 text-zinc-500">
                Paste into Terminal on the Mac, Mac mini or Linux VPS running
                OpenClaw.
              </div>
            </div>
            <Button
              onClick={() =>
                copyInstallText(
                  "OpenClaw setup command",
                  openClawInstallCommand
                )
              }
              size="sm"
              type="button"
              variant="secondary"
            >
              <Copy className="size-4" />
              Copy
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-[4px] bg-black/20 p-3 text-xs leading-6 text-zinc-200">
            <code>{openClawInstallCommand}</code>
          </pre>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] px-3 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.06]"
          href={BRIDGE_PLUGIN_REPO_URL}
          rel="noreferrer"
          target="_blank"
        >
          <Download className="size-4" />
          Bridge repo
        </a>
        <a
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] px-3 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.06]"
          href={BRIDGE_PLUGIN_INSTALL_URL}
          rel="noreferrer"
          target="_blank"
        >
          <Download className="size-4" />
          Preview install guide
        </a>
        <div className="text-xs leading-5 text-zinc-500">
          Generate a pairing code in Relay when the command asks for it. The
          code is not included in the command or saved in shell history, and
          the installer never prints the resulting device credential.
        </div>
      </div>
    </div>
  )
}
