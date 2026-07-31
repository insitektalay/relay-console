"use client"
import { Copy, Download } from "lucide-react"
import { toast } from "sonner"
import { appConfig } from "@/lib/config"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { RelayConsoleController } from "@/components/clawchat-web-app"

export function RelayConsoleBridgeInstallPanel({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const {
    BRIDGE_PLUGIN_INSTALL_URL,
    BRIDGE_PLUGIN_REPO_URL,
    railwayHttpOriginFromWsBaseUrl,
  } = controller

  const railwayBackendOrigin = railwayHttpOriginFromWsBaseUrl(
    appConfig.wsBaseUrl
  )
  const hermesInstallCommand = [
    `git clone ${BRIDGE_PLUGIN_REPO_URL}`,
    "cd relay-console-bridge-plugins",
    "scripts/install-hermes-agent-bridge.sh /path/to/hermes-agent",
  ].join("\n")
  const openClawInstallCommand = [
    `git clone ${BRIDGE_PLUGIN_REPO_URL}`,
    "cd relay-console-bridge-plugins",
    "scripts/manage-openclaw-bridge.sh install",
  ].join("\n")
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
            Install the local bridge on the machine that runs Hermes Agent or
            OpenClaw, then follow the preview guide to enroll it. Relay Console
            API traffic stays on Railway through `/api/v1`.
          </div>
        </div>
        <Badge variant="secondary">Beta</Badge>
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
                Preferred beta runtime.
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
                Manual install path for technical testers.
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
          The installer must never print device tokens. Pairing codes are
          created per workspace and expire quickly.
        </div>
      </div>
    </div>
  )
}
