import { createPortal } from "react-dom"
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderPlus,
  ImageIcon,
  MessageSquare,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
} from "lucide-react"

import type { OpenClawLibraryController } from "@/components/agents/openclaw-library-card"
import { LinkedLocalLinkDialog } from "@/components/agents/linked-local-link-dialog"
import {
  CompactNotice,
  LabeledField,
} from "@/components/shared/relay-compact-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  downloadTextFile,
  formatLinkedLocalSyncTimestamp,
  initials,
  relativeTime,
  selectClassName,
} from "@/lib/relay-presentation-utils"

function OpenClawWorkspaceSection1(
  props: Pick<
    OpenClawLibraryController,
    | "deleteFileMutation"
    | "deleteFolderMutation"
    | "editorContent"
    | "formatFileLocation"
    | "formatLocationLabel"
    | "handlePngUpload"
    | "handleSelectedFileSyncAction"
    | "handleSelectedFileSyncToLocalAction"
    | "handleSelectedFolderSyncAction"
    | "handleSelectedFolderSyncToLocalAction"
    | "handleUpload"
    | "isLinkingSelectedTarget"
    | "isSyncingSelectedTarget"
    | "pngUploadInputRef"
    | "selectedFile"
    | "selectedFileQuery"
    | "selectedFolderContext"
    | "selectedLinkedLocalFile"
    | "selectedLinkedLocalFolder"
    | "selectedLinkedLocalMeta"
    | "selectedLinkedLocalSupport"
    | "selectedNode"
    | "setConfirmDeleteTarget"
    | "setLinkedLocalLinkDialog"
    | "setShowBaselineManager"
    | "showBaselineManager"
    | "startNewMarkdown"
    | "uploadInputRef"
    | "workspaceId"
  >
) {
  const {
    deleteFileMutation,
    deleteFolderMutation,
    editorContent,
    formatFileLocation,
    formatLocationLabel,
    handlePngUpload,
    handleSelectedFileSyncAction,
    handleSelectedFileSyncToLocalAction,
    handleSelectedFolderSyncAction,
    handleSelectedFolderSyncToLocalAction,
    handleUpload,
    isLinkingSelectedTarget,
    isSyncingSelectedTarget,
    pngUploadInputRef,
    selectedFile,
    selectedFileQuery,
    selectedFolderContext,
    selectedLinkedLocalFile,
    selectedLinkedLocalFolder,
    selectedLinkedLocalMeta,
    selectedLinkedLocalSupport,
    selectedNode,
    setConfirmDeleteTarget,
    setLinkedLocalLinkDialog,
    setShowBaselineManager,
    showBaselineManager,
    startNewMarkdown,
    uploadInputRef,
    workspaceId,
  } = props
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-100">
            {selectedFile
              ? `Editing ${selectedFile.filename}`
              : formatLocationLabel(
                  selectedFolderContext.root,
                  selectedFolderContext.folder
                )}
          </div>
          <div className="text-xs text-zinc-500">
            Working in{" "}
            {formatLocationLabel(
              selectedFolderContext.root,
              selectedFolderContext.folder
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => startNewMarkdown()}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Plus className="mr-1.5 size-4" />
            New markdown
          </Button>
          <Button
            onClick={() => uploadInputRef.current?.click()}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Upload className="mr-1.5 size-4" />
            Upload markdown
          </Button>
          <Button
            onClick={() => pngUploadInputRef.current?.click()}
            size="sm"
            type="button"
            variant="secondary"
          >
            <ImageIcon className="mr-1.5 size-4" />
            Upload PNG
          </Button>
          {selectedLinkedLocalFolder ? (
            <>
              <Button
                disabled={
                  !workspaceId ||
                  !selectedLinkedLocalSupport ||
                  isLinkingSelectedTarget ||
                  isSyncingSelectedTarget
                }
                onClick={() => void handleSelectedFolderSyncAction()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <RefreshCcw className="mr-1.5 size-4" />
                {isSyncingSelectedTarget
                  ? "Syncing..."
                  : isLinkingSelectedTarget
                    ? "Linking..."
                    : "Sync from local"}
              </Button>
              <Button
                disabled={
                  !workspaceId ||
                  !selectedLinkedLocalSupport ||
                  isLinkingSelectedTarget ||
                  isSyncingSelectedTarget
                }
                onClick={() => void handleSelectedFolderSyncToLocalAction()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Download className="mr-1.5 size-4" />
                {isSyncingSelectedTarget ? "Syncing..." : "Sync to local"}
              </Button>
              <Button
                disabled={
                  !workspaceId ||
                  !selectedLinkedLocalSupport ||
                  isLinkingSelectedTarget ||
                  isSyncingSelectedTarget
                }
                onClick={() =>
                  setLinkedLocalLinkDialog({
                    kind: "folder",
                    root: selectedLinkedLocalFolder.root,
                    agentId:
                      selectedLinkedLocalFolder.root === "library"
                        ? undefined
                        : selectedLinkedLocalFolder.agentId,
                    folder: selectedLinkedLocalFolder.folder,
                    syncAfterPick: false,
                    locationLabel: formatLocationLabel(
                      selectedLinkedLocalFolder.root,
                      selectedLinkedLocalFolder.folder
                    ),
                  })
                }
                size="sm"
                type="button"
                variant="secondary"
              >
                <ArrowLeftRight className="mr-1.5 size-4" />
                Change linked folder
              </Button>
            </>
          ) : null}
          {selectedLinkedLocalFile ? (
            <>
              <Button
                disabled={
                  !workspaceId ||
                  !selectedLinkedLocalSupport ||
                  isLinkingSelectedTarget ||
                  isSyncingSelectedTarget
                }
                onClick={() => void handleSelectedFileSyncAction()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <RefreshCcw className="mr-1.5 size-4" />
                {isSyncingSelectedTarget
                  ? "Syncing..."
                  : isLinkingSelectedTarget
                    ? "Linking..."
                    : "Sync from local"}
              </Button>
              <Button
                disabled={
                  !workspaceId ||
                  !selectedLinkedLocalSupport ||
                  !selectedLinkedLocalMeta ||
                  isLinkingSelectedTarget ||
                  isSyncingSelectedTarget
                }
                onClick={() => void handleSelectedFileSyncToLocalAction()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Download className="mr-1.5 size-4" />
                {isSyncingSelectedTarget ? "Syncing..." : "Sync to local"}
              </Button>
              <Button
                disabled={
                  !workspaceId ||
                  !selectedLinkedLocalSupport ||
                  isLinkingSelectedTarget ||
                  isSyncingSelectedTarget
                }
                onClick={() =>
                  setLinkedLocalLinkDialog(
                    selectedLinkedLocalFile.root === "library"
                      ? {
                          kind: "file",
                          root: "library",
                          folder: selectedLinkedLocalFile.folder,
                          filename: selectedLinkedLocalFile.filename,
                          syncAfterPick: false,
                          locationLabel: formatFileLocation(
                            "library",
                            selectedLinkedLocalFile.folder,
                            selectedLinkedLocalFile.filename
                          ),
                        }
                      : {
                          kind: "file",
                          root: "workspace",
                          agentId: selectedLinkedLocalFile.agentId,
                          folder: selectedLinkedLocalFile.folder,
                          filename: selectedLinkedLocalFile.filename,
                          syncAfterPick: false,
                          locationLabel: formatFileLocation(
                            "workspace",
                            selectedLinkedLocalFile.folder,
                            selectedLinkedLocalFile.filename
                          ),
                        }
                  )
                }
                size="sm"
                type="button"
                variant="secondary"
              >
                <ArrowLeftRight className="mr-1.5 size-4" />
                Change linked file
              </Button>
            </>
          ) : null}
          <Button
            onClick={() => setShowBaselineManager((v) => !v)}
            size="sm"
            type="button"
            variant="secondary"
          >
            {showBaselineManager ? "Hide baselines" : "Baselines"}
          </Button>
          {selectedFile && !showBaselineManager ? (
            <Button
              disabled={selectedFileQuery.isLoading || !selectedFileQuery.data}
              onClick={() =>
                downloadTextFile(
                  selectedFileQuery.data?.filename ?? selectedFile.filename,
                  selectedFileQuery.data?.content ?? editorContent,
                  "text/markdown;charset=utf-8"
                )
              }
              size="sm"
              type="button"
              variant="secondary"
            >
              <Download className="mr-1.5 size-4" />
              Download
            </Button>
          ) : null}
          {selectedFile && !showBaselineManager ? (
            <Button
              disabled={deleteFileMutation.isPending}
              onClick={() =>
                setConfirmDeleteTarget({
                  kind: "file",
                  label: selectedFile.filename,
                })
              }
              size="sm"
              type="button"
              variant="secondary"
            >
              <Trash2 className="mr-1.5 size-4" />
              {deleteFileMutation.isPending ? "Deleting..." : "Delete file"}
            </Button>
          ) : null}
          {!selectedFile &&
          !showBaselineManager &&
          selectedNode?.kind === "folder" &&
          selectedNode.folder !== "" ? (
            <Button
              disabled={deleteFolderMutation.isPending}
              onClick={() =>
                setConfirmDeleteTarget({
                  kind: "folder",
                  label:
                    selectedNode.folder.split("/").filter(Boolean).pop() ??
                    selectedNode.folder,
                })
              }
              size="sm"
              type="button"
              variant="secondary"
            >
              <Trash2 className="mr-1.5 size-4" />
              {deleteFolderMutation.isPending ? "Deleting..." : "Delete folder"}
            </Button>
          ) : null}
          <input
            ref={uploadInputRef}
            accept=".md,.env,.envrc,text/markdown,text/plain"
            className="hidden"
            multiple
            onChange={handleUpload}
            type="file"
          />
          <input
            ref={pngUploadInputRef}
            accept=".png,image/png"
            className="hidden"
            multiple
            onChange={handlePngUpload}
            type="file"
          />
        </div>
      </div>
    </>
  )
}

function OpenClawWorkspaceSection2(
  props: Pick<
    OpenClawLibraryController,
    | "applyBaseline"
    | "baselineDraftContent"
    | "baselineDraftName"
    | "cancelEditBaseline"
    | "canonicalBaselines"
    | "createFolderMutation"
    | "deleteBaseline"
    | "editingBaselineId"
    | "editorFilename"
    | "folderDraft"
    | "saveBaseline"
    | "selectedBaselineId"
    | "selectedFile"
    | "selectedFileQuery"
    | "selectedLinkedLocalMeta"
    | "selectedLinkedLocalStatus"
    | "selectedLinkedLocalSummary"
    | "setBaselineDraftContent"
    | "setBaselineDraftName"
    | "setEditorDirty"
    | "setEditorFilename"
    | "setFolderDraft"
    | "setSelectedBaselineId"
    | "showBaselineManager"
    | "startEditBaseline"
  >
) {
  const {
    applyBaseline,
    baselineDraftContent,
    baselineDraftName,
    cancelEditBaseline,
    canonicalBaselines,
    createFolderMutation,
    deleteBaseline,
    editingBaselineId,
    editorFilename,
    folderDraft,
    saveBaseline,
    selectedBaselineId,
    selectedFile,
    selectedFileQuery,
    selectedLinkedLocalMeta,
    selectedLinkedLocalStatus,
    selectedLinkedLocalSummary,
    setBaselineDraftContent,
    setBaselineDraftName,
    setEditorDirty,
    setEditorFilename,
    setFolderDraft,
    setSelectedBaselineId,
    showBaselineManager,
    startEditBaseline,
  } = props
  return (
    <>
      {showBaselineManager ? (
        <div className="space-y-3">
          {canonicalBaselines.length > 0 ? (
            <div className="space-y-2">
              {canonicalBaselines.map((baseline) => (
                <div
                  key={baseline.id}
                  className="space-y-1 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-zinc-200">
                      {baseline.name}
                    </span>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        className="text-xs text-zinc-400 transition hover:text-zinc-100"
                        onClick={() => startEditBaseline(baseline)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-rose-400 transition hover:text-rose-300"
                        onClick={() => deleteBaseline(baseline.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="line-clamp-2 font-mono text-xs text-zinc-500">
                    {baseline.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-zinc-500">
              No baselines saved yet. Create one below.
            </div>
          )}
          <div className="space-y-2 border-t border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] pt-1">
            <div className="text-xs font-medium text-zinc-400">
              {editingBaselineId ? "Edit baseline" : "New baseline"}
            </div>
            <Input
              placeholder="Baseline name (e.g. AGENTS.md)"
              value={baselineDraftName}
              onChange={(e) => setBaselineDraftName(e.target.value)}
            />
            <Textarea
              className="min-h-[320px] font-mono text-sm leading-6"
              placeholder="# Paste your canonical markdown content here"
              value={baselineDraftContent}
              onChange={(e) => setBaselineDraftContent(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                disabled={
                  !baselineDraftName.trim() || !baselineDraftContent.trim()
                }
                onClick={saveBaseline}
                size="sm"
                type="button"
              >
                {editingBaselineId ? "Update baseline" : "Save baseline"}
              </Button>
              {editingBaselineId ? (
                <Button
                  onClick={cancelEditBaseline}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <>
          {selectedLinkedLocalStatus ? (
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="claw-kicker tracking-[0.16em] text-zinc-500 uppercase">
                    Linked local sync
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={selectedLinkedLocalStatus.badgeClassName}>
                      {selectedLinkedLocalStatus.label}
                    </Badge>
                  </div>
                </div>
                <div className="max-w-[540px] text-xs leading-5 text-zinc-500">
                  {selectedLinkedLocalStatus.detail}
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-zinc-400 md:grid-cols-2">
                <div>
                  Linked to:{" "}
                  <span className="font-medium text-zinc-200">
                    {selectedLinkedLocalMeta?.label ?? "Not linked"}
                  </span>
                </div>
                <div>
                  Last synced:{" "}
                  <span className="font-medium text-zinc-200">
                    {formatLinkedLocalSyncTimestamp(
                      selectedLinkedLocalMeta?.lastSyncedAt
                    )}
                  </span>
                </div>
              </div>
              {selectedLinkedLocalSummary ? (
                <div className="mt-2 text-xs leading-5 text-zinc-500">
                  Last result: {selectedLinkedLocalSummary}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <LabeledField label="Create subfolder">
                  <Input
                    placeholder="new-subfolder"
                    value={folderDraft}
                    onChange={(event) => setFolderDraft(event.target.value)}
                  />
                </LabeledField>
              </div>
              <Button
                disabled={!folderDraft.trim() || createFolderMutation.isPending}
                onClick={() => createFolderMutation.mutate()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <FolderPlus className="mr-1.5 size-4" />
                {createFolderMutation.isPending
                  ? "Creating..."
                  : "Create folder"}
              </Button>
            </div>
          </div>

          {selectedFile && selectedFileQuery.isLoading ? (
            <CompactNotice>Loading file contents...</CompactNotice>
          ) : null}

          {selectedFile && selectedFileQuery.error ? (
            <CompactNotice>
              {selectedFileQuery.error instanceof Error
                ? selectedFileQuery.error.message
                : "Unable to load file"}
            </CompactNotice>
          ) : null}

          <LabeledField label="Filename">
            <Input
              placeholder="notes.md"
              value={editorFilename}
              onChange={(event) => {
                setEditorFilename(event.target.value)
                setEditorDirty(true)
              }}
            />
          </LabeledField>

          {canonicalBaselines.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <LabeledField label="Apply canonical baseline">
                  <select
                    className={selectClassName}
                    value={selectedBaselineId}
                    onChange={(e) => setSelectedBaselineId(e.target.value)}
                  >
                    <option value="">Select a baseline...</option>
                    {canonicalBaselines.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </LabeledField>
              </div>
              <Button
                disabled={!selectedBaselineId}
                onClick={applyBaseline}
                size="sm"
                type="button"
                variant="secondary"
              >
                Apply
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}

function OpenClawWorkspaceSection3(
  props: Pick<
    OpenClawLibraryController,
    | "deleteFileMutation"
    | "editorContent"
    | "editorDirty"
    | "editorFilename"
    | "formatLocationLabel"
    | "saveFileMutation"
    | "selectedFile"
    | "selectedFileQuery"
    | "selectedFolderContext"
    | "setConfirmDeleteTarget"
    | "setEditorContent"
    | "setEditorDirty"
    | "showBaselineManager"
  >
) {
  const {
    deleteFileMutation,
    editorContent,
    editorDirty,
    editorFilename,
    formatLocationLabel,
    saveFileMutation,
    selectedFile,
    selectedFileQuery,
    selectedFolderContext,
    setConfirmDeleteTarget,
    setEditorContent,
    setEditorDirty,
    showBaselineManager,
  } = props
  return (
    <>
      {!showBaselineManager ? (
        <>
          <LabeledField label="Markdown">
            <Textarea
              className="min-h-[520px] font-mono text-sm leading-6"
              placeholder="# Notes"
              value={editorContent}
              onChange={(event) => {
                setEditorContent(event.target.value)
                setEditorDirty(true)
              }}
            />
          </LabeledField>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-3">
            <div className="text-xs text-zinc-500">
              {selectedFile ? (
                <>
                  {formatLocationLabel(
                    selectedFolderContext.root,
                    selectedFolderContext.folder
                  )}
                  {selectedFileQuery.data?.updatedAt ? (
                    <>
                      {" "}
                      · updated {relativeTime(selectedFileQuery.data.updatedAt)}
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  Create a markdown file in{" "}
                  {formatLocationLabel(
                    selectedFolderContext.root,
                    selectedFolderContext.folder
                  )}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedFile ? (
                <Button
                  disabled={
                    selectedFileQuery.isLoading || !selectedFileQuery.data
                  }
                  onClick={() =>
                    downloadTextFile(
                      selectedFileQuery.data?.filename ?? selectedFile.filename,
                      selectedFileQuery.data?.content ?? editorContent,
                      "text/markdown;charset=utf-8"
                    )
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Download className="mr-1.5 size-4" />
                  Download
                </Button>
              ) : null}
              {selectedFile ? (
                <Button
                  disabled={deleteFileMutation.isPending}
                  onClick={() =>
                    setConfirmDeleteTarget({
                      kind: "file",
                      label: selectedFile.filename,
                    })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Trash2 className="mr-1.5 size-4" />
                  {deleteFileMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              ) : null}
              <Button
                disabled={
                  saveFileMutation.isPending ||
                  !editorFilename.trim() ||
                  !editorContent.trim() ||
                  (selectedFile ? !editorDirty : false)
                }
                onClick={() => saveFileMutation.mutate()}
                size="sm"
                type="button"
              >
                {saveFileMutation.isPending ? "Saving..." : "Save markdown"}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}

export function OpenClawWorkspaceView({
  controller,
}: {
  controller: OpenClawLibraryController
}) {
  const {
    agentAvatarUrl,
    agentGroupLabel,
    agentLabel,
    applyBaseline,
    baselineDraftContent,
    baselineDraftName,
    cancelEditBaseline,
    canonicalBaselines,
    confirmDeleteTarget,
    confirmLinkedLocalLinkDialog,
    createFolderMutation,
    deleteBaseline,
    deleteFileMutation,
    deleteFolderMutation,
    editingBaselineId,
    editorContent,
    editorDirty,
    editorFilename,
    expandedFolders,
    folderDraft,
    folderKey,
    folderStates,
    formatFileLocation,
    formatLocationLabel,
    handlePngUpload,
    handleSelectedFileSyncAction,
    handleSelectedFileSyncToLocalAction,
    handleSelectedFolderSyncAction,
    handleSelectedFolderSyncToLocalAction,
    handleUpload,
    isLinkingSelectedTarget,
    isSyncingSelectedTarget,
    libraryOnly,
    linkedLocalLinkDialog,
    linkingTargetKey,
    onOpenChat,
    pngUploadInputRef,
    renderTreeBranch,
    saveBaseline,
    saveFileMutation,
    selectFolder,
    selectedBaselineId,
    selectedFile,
    selectedFileQuery,
    selectedFolderContext,
    selectedLinkedLocalFile,
    selectedLinkedLocalFolder,
    selectedLinkedLocalMeta,
    selectedLinkedLocalStatus,
    selectedLinkedLocalSummary,
    selectedLinkedLocalSupport,
    selectedNode,
    setBaselineDraftContent,
    setBaselineDraftName,
    setConfirmDeleteTarget,
    setEditorContent,
    setEditorDirty,
    setEditorFilename,
    setFolderDraft,
    setLinkedLocalLinkDialog,
    setSelectedBaselineId,
    setShowBaselineManager,
    showBaselineManager,
    startEditBaseline,
    startNewMarkdown,
    toggleFolder,
    uploadInputRef,
    workspaceId,
    workspaceRoots,
  } = controller

  return (
    <div
      className={
        libraryOnly
          ? "mission-scrollbar h-full min-h-0 overflow-y-auto bg-[var(--claw-bg-page)] px-5 pb-5"
          : undefined
      }
    >
      {libraryOnly ? (
        <div className="sticky top-0 z-20 mx-auto flex h-[54px] w-full max-w-[1500px] items-end gap-2.5 bg-[var(--claw-bg-page)] pb-2.5">
          <Avatar size="sm" className="size-[22px] shrink-0">
            <AvatarImage src={agentAvatarUrl ?? undefined} />
            <AvatarFallback className="claw-avatar-initials-sm">
              {initials(agentLabel)}
            </AvatarFallback>
          </Avatar>
          <div className="claw-control-label min-w-0 truncate text-[var(--claw-text-primary)]">
            {agentLabel}
          </div>
          <Badge className="claw-status-text h-6 rounded-[4px] border-[color-mix(in_srgb,var(--claw-accent-blue)_55%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,transparent)] px-2 text-[var(--claw-accent-blue)] hover:bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,transparent)]">
            Agent Library
          </Badge>
          <Badge className="claw-status-text h-6 rounded-[4px] border-emerald-400/35 bg-emerald-500/10 px-2 text-emerald-300 hover:bg-emerald-500/10">
            {agentGroupLabel || "Unassigned"}
          </Badge>
          <span className="flex-1" />
          <button
            aria-label="Open Direct Chat"
            className="flex size-8 items-center justify-center rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-secondary)] transition hover:border-[var(--claw-border)] hover:bg-[var(--claw-bg-hover)] hover:text-[var(--claw-text-primary)] disabled:opacity-45"
            disabled={!onOpenChat}
            onClick={onOpenChat}
            title="Open Direct Chat"
            type="button"
          >
            <MessageSquare className="size-4" />
          </button>
        </div>
      ) : null}
      <Card
        className={`border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] ${
          libraryOnly ? "mx-auto w-full max-w-[1500px]" : ""
        }`}
      >
        <CardHeader className="hidden" />
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-3">
              <div className="mb-3 text-sm font-medium text-zinc-100">Tree</div>
              <div className="space-y-1">
                {workspaceRoots.map((root) => {
                  const key = folderKey(root.id, "")
                  const isExpanded = Boolean(expandedFolders[key])
                  const state = folderStates[key]

                  return (
                    <div key={root.id}>
                      <button
                        className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm font-medium text-zinc-100 transition hover:bg-[var(--claw-bg-surface)]"
                        onClick={() => {
                          selectFolder(root.id, "")
                          toggleFolder(root.id, "")
                        }}
                        type="button"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
                        )}
                        <Folder className="size-4 shrink-0 text-zinc-400" />
                        <span className="truncate">{root.label}</span>
                        {state?.loading ? (
                          <span className="claw-meta ml-auto text-zinc-500">
                            loading
                          </span>
                        ) : null}
                      </button>
                      {isExpanded ? renderTreeBranch(root.id, "", 1) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] p-3">
              <div className="space-y-4">
                <OpenClawWorkspaceSection1
                  deleteFileMutation={deleteFileMutation}
                  deleteFolderMutation={deleteFolderMutation}
                  editorContent={editorContent}
                  formatFileLocation={formatFileLocation}
                  formatLocationLabel={formatLocationLabel}
                  handlePngUpload={handlePngUpload}
                  handleSelectedFileSyncAction={handleSelectedFileSyncAction}
                  handleSelectedFileSyncToLocalAction={
                    handleSelectedFileSyncToLocalAction
                  }
                  handleSelectedFolderSyncAction={
                    handleSelectedFolderSyncAction
                  }
                  handleSelectedFolderSyncToLocalAction={
                    handleSelectedFolderSyncToLocalAction
                  }
                  handleUpload={handleUpload}
                  isLinkingSelectedTarget={isLinkingSelectedTarget}
                  isSyncingSelectedTarget={isSyncingSelectedTarget}
                  pngUploadInputRef={pngUploadInputRef}
                  selectedFile={selectedFile}
                  selectedFileQuery={selectedFileQuery}
                  selectedFolderContext={selectedFolderContext}
                  selectedLinkedLocalFile={selectedLinkedLocalFile}
                  selectedLinkedLocalFolder={selectedLinkedLocalFolder}
                  selectedLinkedLocalMeta={selectedLinkedLocalMeta}
                  selectedLinkedLocalSupport={selectedLinkedLocalSupport}
                  selectedNode={selectedNode}
                  setConfirmDeleteTarget={setConfirmDeleteTarget}
                  setLinkedLocalLinkDialog={setLinkedLocalLinkDialog}
                  setShowBaselineManager={setShowBaselineManager}
                  showBaselineManager={showBaselineManager}
                  startNewMarkdown={startNewMarkdown}
                  uploadInputRef={uploadInputRef}
                  workspaceId={workspaceId}
                />

                <OpenClawWorkspaceSection2
                  applyBaseline={applyBaseline}
                  baselineDraftContent={baselineDraftContent}
                  baselineDraftName={baselineDraftName}
                  cancelEditBaseline={cancelEditBaseline}
                  canonicalBaselines={canonicalBaselines}
                  createFolderMutation={createFolderMutation}
                  deleteBaseline={deleteBaseline}
                  editingBaselineId={editingBaselineId}
                  editorFilename={editorFilename}
                  folderDraft={folderDraft}
                  saveBaseline={saveBaseline}
                  selectedBaselineId={selectedBaselineId}
                  selectedFile={selectedFile}
                  selectedFileQuery={selectedFileQuery}
                  selectedLinkedLocalMeta={selectedLinkedLocalMeta}
                  selectedLinkedLocalStatus={selectedLinkedLocalStatus}
                  selectedLinkedLocalSummary={selectedLinkedLocalSummary}
                  setBaselineDraftContent={setBaselineDraftContent}
                  setBaselineDraftName={setBaselineDraftName}
                  setEditorDirty={setEditorDirty}
                  setEditorFilename={setEditorFilename}
                  setFolderDraft={setFolderDraft}
                  setSelectedBaselineId={setSelectedBaselineId}
                  showBaselineManager={showBaselineManager}
                  startEditBaseline={startEditBaseline}
                />

                <OpenClawWorkspaceSection3
                  deleteFileMutation={deleteFileMutation}
                  editorContent={editorContent}
                  editorDirty={editorDirty}
                  editorFilename={editorFilename}
                  formatLocationLabel={formatLocationLabel}
                  saveFileMutation={saveFileMutation}
                  selectedFile={selectedFile}
                  selectedFileQuery={selectedFileQuery}
                  selectedFolderContext={selectedFolderContext}
                  setConfirmDeleteTarget={setConfirmDeleteTarget}
                  setEditorContent={setEditorContent}
                  setEditorDirty={setEditorDirty}
                  showBaselineManager={showBaselineManager}
                />
              </div>
            </div>
          </div>
        </CardContent>

        {confirmDeleteTarget && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
                <Card className="w-full max-w-sm border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-zinc-950 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
                  <CardHeader>
                    <CardTitle>You sure you want to delete it?</CardTitle>
                    <CardDescription className="text-zinc-400">
                      Delete{" "}
                      <span className="font-mono text-zinc-200">
                        {confirmDeleteTarget.label}
                      </span>
                      ? This cannot be undone.
                      {confirmDeleteTarget.kind === "folder"
                        ? " All files inside will be permanently removed."
                        : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="justify-between gap-3 border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-white/[0.02]">
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmDeleteTarget(null)}
                      disabled={
                        deleteFileMutation.isPending ||
                        deleteFolderMutation.isPending
                      }
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={
                        deleteFileMutation.isPending ||
                        deleteFolderMutation.isPending
                      }
                      onClick={() => {
                        if (confirmDeleteTarget.kind === "file") {
                          deleteFileMutation.mutate()
                        } else {
                          deleteFolderMutation.mutate()
                        }
                      }}
                    >
                      {deleteFileMutation.isPending ||
                      deleteFolderMutation.isPending
                        ? "Deleting..."
                        : "Delete"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>,
              document.body
            )
          : null}

        <LinkedLocalLinkDialog
          open={Boolean(linkedLocalLinkDialog)}
          pending={Boolean(linkingTargetKey)}
          target={linkedLocalLinkDialog}
          onClose={() => {
            if (linkingTargetKey) return
            setLinkedLocalLinkDialog(null)
          }}
          onConfirm={() => void confirmLinkedLocalLinkDialog()}
        />
      </Card>
    </div>
  )
}
