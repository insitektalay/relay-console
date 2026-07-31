"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import type {
  CreatePaperclipConnectionInput,
  PaperclipConnection,
  UpdatePaperclipConnectionInput,
} from "@clawchat/contracts"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type PaperclipConnectionDialogProps = {
  open: boolean
  connection?: PaperclipConnection | null
  pending?: boolean
  onClose: () => void
  onSubmit: (
    input: CreatePaperclipConnectionInput | UpdatePaperclipConnectionInput
  ) => Promise<void> | void
}

export function PaperclipConnectionDialog({
  open,
  connection,
  pending = false,
  onClose,
  onSubmit,
}: PaperclipConnectionDialogProps) {
  if (!open) return null

  return (
    <PaperclipConnectionDialogContent
      key={connection?.id ?? "new"}
      connection={connection}
      pending={pending}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

function PaperclipConnectionDialogContent({
  connection,
  pending,
  onClose,
  onSubmit,
}: Omit<PaperclipConnectionDialogProps, "open">) {
  const [displayName, setDisplayName] = useState(connection?.displayName ?? "")
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? "")
  const [companyId, setCompanyId] = useState(connection?.companyId ?? "")
  const [bearerToken, setBearerToken] = useState("")

  const isEdit = Boolean(connection)

  async function handleSubmit() {
    const base = {
      displayName: displayName.trim(),
      baseUrl: baseUrl.trim(),
      companyId: companyId.trim(),
    }

    if (!base.displayName || !base.baseUrl || !base.companyId) {
      return
    }

    if (isEdit) {
      await onSubmit({
        ...base,
        bearerToken: bearerToken.trim() || undefined,
      })
    } else {
      const token = bearerToken.trim()
      if (!token) return
      await onSubmit({
        ...base,
        bearerToken: token,
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg border-white/10 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>
            {isEdit ? "Edit Paperclip connection" : "Add Paperclip connection"}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Save a workspace-level Paperclip connection for thread linking. The
            bearer token is encrypted server-side and never returned to the
            browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LabeledField label="Display name">
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Main Paperclip"
            />
          </LabeledField>
          <LabeledField label="Base URL">
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://paperclip.example.com"
            />
          </LabeledField>
          <LabeledField label="Company id">
            <Input
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              placeholder="Paperclip company id"
            />
          </LabeledField>
          <LabeledField
            label={isEdit ? "Bearer token (optional)" : "Bearer token"}
          >
            <Input
              type="password"
              value={bearerToken}
              onChange={(event) => setBearerToken(event.target.value)}
              placeholder={
                isEdit
                  ? "Leave blank to keep current token"
                  : "Paste Paperclip bearer token"
              }
            />
          </LabeledField>
          {isEdit ? (
            <div className="text-xs leading-5 text-zinc-500">
              Leave the bearer token blank to keep the existing secret.
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between gap-3 border-white/10 bg-white/[0.02]">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => void handleSubmit()}>
            {pending
              ? "Saving..."
              : isEdit
                ? "Save changes"
                : "Save connection"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function LabeledField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <div className="text-xs font-medium tracking-[0.14em] text-zinc-400 uppercase">
        {label}
      </div>
      {children}
    </label>
  )
}
