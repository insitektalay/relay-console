"use client"

import { useState } from "react"
import type {
  CreatePaperclipConnectionInput,
  PaperclipConnection,
  UpdatePaperclipConnectionInput,
} from "@clawchat/contracts"
import { Pencil, PlugZap, RefreshCcw } from "lucide-react"
import { PaperclipConnectionDialog } from "@/components/integrations/paperclip-connection-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PaperclipIntegrationCardProps = {
  isAdmin: boolean
  isLoading?: boolean
  isSaving?: boolean
  testingConnectionId?: string | null
  connections: PaperclipConnection[]
  onCreateConnection: (
    input: CreatePaperclipConnectionInput
  ) => Promise<unknown>
  onUpdateConnection: (
    connectionId: string,
    input: UpdatePaperclipConnectionInput
  ) => Promise<unknown>
  onTestConnection: (connectionId: string) => Promise<unknown>
}

export function PaperclipIntegrationCard({
  isAdmin,
  isLoading = false,
  isSaving = false,
  testingConnectionId = null,
  connections,
  onCreateConnection,
  onUpdateConnection,
  onTestConnection,
}: PaperclipIntegrationCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConnection, setEditingConnection] =
    useState<PaperclipConnection | null>(null)

  function openCreate() {
    setEditingConnection(null)
    setDialogOpen(true)
  }

  function openEdit(connection: PaperclipConnection) {
    setEditingConnection(connection)
    setDialogOpen(true)
  }

  return (
    <>
      <Card className="border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <PlugZap className="size-4 text-emerald-300" />
              Paperclip
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Optional control-plane connection for linking threads to Paperclip
              issues and approvals.
            </CardDescription>
          </div>
          {isAdmin ? (
            <Button onClick={openCreate} variant="secondary">
              Add connection
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-4 text-sm text-zinc-400">
              Loading Paperclip connections...
            </div>
          ) : connections.length ? (
            connections.map((connection) => (
              <div
                key={connection.id}
                className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-zinc-100">
                        {connection.displayName}
                      </div>
                      <Badge variant="secondary">{connection.status}</Badge>
                    </div>
                    <div className="text-xs leading-5 text-zinc-400">
                      {connection.companyName
                        ? `${connection.companyName} · ${connection.companyId}`
                        : connection.companyId}
                    </div>
                    <div className="text-xs leading-5 text-zinc-500">
                      {connection.baseUrl}
                    </div>
                    {connection.lastErrorMessage ? (
                      <div className="text-xs leading-5 text-amber-300">
                        {connection.lastErrorMessage}
                      </div>
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(connection)}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={testingConnectionId === connection.id}
                        onClick={() => void onTestConnection(connection.id)}
                      >
                        <RefreshCcw className="size-3.5" />
                        {testingConnectionId === connection.id
                          ? "Testing..."
                          : "Test"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[4px] border border-dashed border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-5 text-sm text-zinc-400">
              {isAdmin
                ? "No Paperclip connections saved yet. Add one to enable thread linking."
                : "Paperclip is not configured for this workspace."}
            </div>
          )}
          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-3 text-xs leading-5 text-zinc-500">
            Paperclip stays outside the runtime domain. This integration only
            stores connection metadata and thread links in Relay Console, then
            fetches live Paperclip summaries on demand.
          </div>
          {!isAdmin ? (
            <div className="flex justify-end">
              <Badge
                variant="outline"
                className="border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] text-zinc-400"
              >
                Admin setup required
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <PaperclipConnectionDialog
        open={dialogOpen}
        connection={editingConnection}
        pending={isSaving}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (input) => {
          if (editingConnection) {
            await onUpdateConnection(editingConnection.id, input)
          } else {
            await onCreateConnection(input as CreatePaperclipConnectionInput)
          }
          setDialogOpen(false)
        }}
      />
    </>
  )
}
