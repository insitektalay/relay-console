import { createPortal } from "react-dom"

import type { LinkedLocalLinkDialogState } from "@/components/agents/openclaw-library-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LinkedLocalLinkDialog({
  open,
  pending,
  target,
  onClose,
  onConfirm,
}: {
  open: boolean
  pending: boolean
  target: LinkedLocalLinkDialogState
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open || !target || typeof document === "undefined") {
    return null
  }

  const title =
    target.kind === "folder" ? "Link local folder" : "Link local file"
  const locationLabel = target.locationLabel
  const actionLabel = target.kind === "folder" ? "Choose folder" : "Choose file"
  const modeLabel = target.syncAfterPick
    ? target.kind === "folder" && target.syncDirection === "to-local"
      ? "Link and sync to local now"
      : "Link and sync now"
    : "Link only"

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-zinc-950 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="text-zinc-400">
            Relay Console will first open the browser&apos;s secure file access
            prompt. After you approve it, the selected local{" "}
            {target.kind === "folder" ? "folder" : "file"} will be linked to{" "}
            <span className="font-mono text-zinc-200">{locationLabel}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] p-3 text-sm leading-6 text-zinc-300">
            <div className="claw-kicker tracking-[0.16em] text-zinc-500 uppercase">
              What happens next
            </div>
            <div className="mt-2">
              You will see Chrome&apos;s native permission dialog. That browser
              dialog cannot be styled by the app, but this link will only be
              stored locally in this browser profile and will never be sent to
              the server.
            </div>
          </div>
          <div className="grid gap-2 text-xs text-zinc-400 md:grid-cols-2">
            <div>
              Target:{" "}
              <span className="font-medium text-zinc-200">{locationLabel}</span>
            </div>
            <div>
              Mode:{" "}
              <span className="font-medium text-zinc-200">{modeLabel}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-white/[0.02]">
          <Button disabled={pending} onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            {pending ? "Opening..." : actionLabel}
          </Button>
        </CardFooter>
      </Card>
    </div>,
    document.body
  )
}
