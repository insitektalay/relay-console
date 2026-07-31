import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Library,
  Link2,
  MessageSquare,
  Pencil,
  Plus,
  Puzzle,
  RefreshCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react"

import type { OpenClawLibraryController } from "@/components/agents/openclaw-library-card"
import { LabeledField } from "@/components/shared/relay-compact-fields"
import { RenderAgentKnowledgeMarkdown } from "@/components/shared/relay-markdown-content"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { downloadTextFile, initials } from "@/lib/relay-presentation-utils"

function KnowledgeSelectorPanel({
  controller,
  activeLocation,
  KnowledgeIcon,
  sectionPresentation,
}: {
  controller: OpenClawLibraryController
  activeLocation: string
  KnowledgeIcon: typeof Library
  sectionPresentation: {
    empty: string
    emptyLoading: string
    iconClass: string
    statusClass: string
  }
}) {
  const {
    activeKnowledgeItem,
    dropdownKnowledgeItems,
    expandedFolders,
    folderKey,
    knowledgeDiscoveryError,
    knowledgeDiscoveryLoading,
    knowledgeSection,
    knowledgeSelectorCollapsed,
    openKnowledgeItem,
    renderTreeBranch,
    retryKnowledgeDiscovery,
    selectFolder,
    selectedFolderContext,
    selectedNode,
    setKnowledgeSelectorCollapsed,
    toggleFolder,
  } = controller

  return (
    <div className="space-y-2.5 border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] pb-3.5">
      {knowledgeSection === "library" ? (
        <div className="overflow-hidden rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-inset)]">
          <div className="flex items-center gap-2.5 border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-3 py-2.5">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-[4px] ${sectionPresentation.iconClass}`}
            >
              <Library className="size-[17px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="claw-control-label block text-[var(--claw-text-primary)]">
                Agent Library
              </span>
              <span className="claw-meta mt-0.5 block truncate text-[var(--claw-text-muted)]">
                {selectedFolderContext.folder
                  ? `library/${selectedFolderContext.folder}`
                  : "library"}
              </span>
            </span>
          </div>
          <div className="mission-scrollbar max-h-[370px] overflow-y-auto p-2">
            <button
              className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm font-medium transition ${
                selectedNode?.kind === "folder" &&
                selectedNode.root === "library" &&
                selectedNode.folder === ""
                  ? "bg-primary/12 text-zinc-100"
                  : "text-zinc-200 hover:bg-[var(--claw-bg-hover)]"
              }`}
              onClick={() => {
                selectFolder("library", "")
                toggleFolder("library", "")
              }}
              type="button"
            >
              {expandedFolders[folderKey("library", "")] ? (
                <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
              )}
              <Folder className="size-4 shrink-0 text-zinc-400" />
              <span className="truncate">library</span>
            </button>
            {expandedFolders[folderKey("library", "")]
              ? renderTreeBranch("library", "", 1)
              : null}
          </div>
        </div>
      ) : activeKnowledgeItem ? (
        <button
          className="flex w-full items-center gap-2.5 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_48%,var(--claw-border))] bg-[var(--claw-bg-selected)] p-2.5 text-left"
          onClick={() => setKnowledgeSelectorCollapsed((current) => !current)}
          type="button"
        >
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-[4px] ${sectionPresentation.iconClass}`}
          >
            <KnowledgeIcon className="size-[17px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="claw-control-label block truncate text-[var(--claw-text-primary)]">
              {activeKnowledgeItem.title}
            </span>
            <span className="claw-meta mt-0.5 block truncate font-medium text-[var(--claw-text-muted)]">
              {activeLocation}
            </span>
          </span>
          <span
            className={`claw-status-text rounded-[4px] border px-2 py-1 ${sectionPresentation.statusClass}`}
          >
            {activeKnowledgeItem.status}
          </span>
          {dropdownKnowledgeItems.length ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_40%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-primary)]">
              <ChevronDown
                className={`size-4 transition-transform ${
                  knowledgeSelectorCollapsed ? "" : "rotate-180"
                }`}
              />
            </span>
          ) : null}
        </button>
      ) : (
        <div className="flex min-h-[66px] items-center justify-center rounded-[4px] border border-dashed border-[color-mix(in_srgb,var(--claw-border)_50%,transparent)] px-4 py-3 text-center text-sm text-[var(--claw-text-muted)]">
          {knowledgeDiscoveryLoading ? (
            sectionPresentation.emptyLoading
          ) : knowledgeDiscoveryError ? (
            <div className="flex items-center gap-3">
              <span>{knowledgeDiscoveryError}</span>
              <Button
                onClick={retryKnowledgeDiscovery}
                size="sm"
                type="button"
                variant="secondary"
              >
                <RefreshCcw className="size-3.5" />
                Retry
              </Button>
            </div>
          ) : (
            sectionPresentation.empty
          )}
        </div>
      )}

      {knowledgeSection !== "library" &&
      !knowledgeSelectorCollapsed &&
      dropdownKnowledgeItems.length ? (
        <div className="max-h-[370px] space-y-2 overflow-y-auto">
          {dropdownKnowledgeItems.map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center gap-2.5 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_36%,transparent)] bg-[var(--claw-bg-inset)] p-2.5 text-left transition hover:border-[color-mix(in_srgb,var(--claw-accent-blue)_34%,var(--claw-border))] hover:bg-[var(--claw-bg-hover)]"
              onClick={() => {
                openKnowledgeItem(item)
                setKnowledgeSelectorCollapsed(true)
              }}
              type="button"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-[4px] ${sectionPresentation.iconClass}`}
              >
                <KnowledgeIcon className="size-[17px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="claw-control-label block truncate text-[var(--claw-text-primary)]">
                  {item.title}
                </span>
                <span className="claw-meta mt-0.5 block truncate text-[var(--claw-text-muted)]">
                  {item.subtitle}
                </span>
              </span>
              <span
                className={`claw-status-text rounded-[4px] border px-2 py-1 ${sectionPresentation.statusClass}`}
              >
                {item.status}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function OpenClawKnowledgeView({
  controller,
}: {
  controller: OpenClawLibraryController
}) {
  const {
    activeKnowledgeItem,
    agentAvatarUrl,
    agentGroupLabel,
    agentLabel,
    baselineDraftContent,
    baselineDraftName,
    cancelEditBaseline,
    canonicalBaselines,
    createFolderMutation,
    deleteBaseline,
    deleteFileMutation,
    editingBaselineId,
    editorContent,
    editorDirty,
    editorFilename,
    folderDraft,
    handleUpload,
    isHermesWorkspace,
    knowledgeDiscoveryError,
    knowledgeDiscoveryLoading,
    knowledgeEditing,
    knowledgeFolderCreating,
    knowledgeSection,
    linkSelectedKnowledgeFile,
    onOpenChat,
    saveBaseline,
    saveFileMutation,
    selectedFile,
    selectedFileQuery,
    selectedFolderContext,
    selectedLinkedLocalFile,
    setBaselineDraftContent,
    setBaselineDraftName,
    setEditorContent,
    setEditorDirty,
    setEditorFilename,
    setFolderDraft,
    setKnowledgeEditing,
    setKnowledgeFolderCreating,
    setShowBaselineManager,
    showBaselineManager,
    startEditBaseline,
    startKnowledgeMarkdown,
    uploadInputRef,
  } = controller

  if (!knowledgeSection) return null

  const sectionPresentation = {
    instructions: {
      emptyLoading: "Loading agent instruction files...",
      empty:
        "No agent instructions found. Create or upload an instruction file.",
      noun: "instruction",
      icon: FileText,
      iconClass:
        "bg-[color-mix(in_srgb,var(--claw-accent-blue)_14%,transparent)] text-[var(--claw-accent-blue)]",
      statusClass:
        "border-[color-mix(in_srgb,var(--claw-accent-blue)_48%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_10%,transparent)] text-[var(--claw-accent-blue)]",
    },
    library: {
      emptyLoading: "Loading agent library...",
      empty: "The agent library is empty. Create a folder or markdown file.",
      noun: "library document",
      icon: Library,
      iconClass:
        "bg-[color-mix(in_srgb,var(--claw-accent-blue)_14%,transparent)] text-[var(--claw-accent-blue)]",
      statusClass:
        "border-[color-mix(in_srgb,var(--claw-accent-blue)_48%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_10%,transparent)] text-[var(--claw-accent-blue)]",
    },
    memory: {
      emptyLoading: "Loading agent memory...",
      empty:
        "No agent memory found. Create or upload a memory file to keep useful context between sessions.",
      noun: "memory",
      icon: Archive,
      iconClass: "bg-emerald-500/12 text-emerald-300",
      statusClass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    },
    skills: {
      emptyLoading: "Loading installed skills...",
      empty:
        "No installed skills found. Create or upload a skill to make it available to this agent.",
      noun: "skill",
      icon: Puzzle,
      iconClass: "bg-violet-500/12 text-violet-300",
      statusClass: "border-violet-400/30 bg-violet-500/10 text-violet-300",
    },
  }[knowledgeSection]
  const KnowledgeIcon = sectionPresentation.icon
  const runtimeBadge = isHermesWorkspace ? "Hermes" : "OpenClaw"
  const activeLocation = activeKnowledgeItem
    ? activeKnowledgeItem.subtitle
    : `${agentLabel} profile`
  const toolbarButtonClass =
    "flex size-9 items-center justify-center rounded-[6px] border transition disabled:cursor-not-allowed disabled:opacity-45"

  return (
    <div className="mission-scrollbar h-full min-h-0 overflow-y-auto bg-[var(--claw-bg-page)] px-5 pb-5">
      <div className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-3.5">
        <div className="sticky top-0 z-20 flex h-[54px] shrink-0 items-end gap-2.5 bg-[var(--claw-bg-page)] pb-2.5">
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
            {runtimeBadge}
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

        <KnowledgeSelectorPanel
          controller={controller}
          activeLocation={activeLocation}
          KnowledgeIcon={KnowledgeIcon}
          sectionPresentation={sectionPresentation}
        />

        <div className="flex shrink-0 items-center gap-2 border-b border-[color-mix(in_srgb,var(--claw-border)_26%,transparent)] pt-0.5 pb-3.5">
          {knowledgeSection !== "memory" ? (
            <button
              aria-label="Create new markdown"
              className={`${toolbarButtonClass} border-[color-mix(in_srgb,var(--claw-accent-blue)_36%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_11%,transparent)] text-[var(--claw-accent-blue)] hover:bg-[color-mix(in_srgb,var(--claw-accent-blue)_20%,transparent)]`}
              onClick={startKnowledgeMarkdown}
              title="Create new markdown"
              type="button"
            >
              <Plus className="size-4" />
            </button>
          ) : null}
          {knowledgeSection === "library" ? (
            <button
              aria-label="Create new folder"
              className={`${toolbarButtonClass} border-amber-400/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
              onClick={() => {
                setKnowledgeFolderCreating((current) => !current)
                setKnowledgeEditing(false)
                setShowBaselineManager(false)
              }}
              title="Create new folder"
              type="button"
            >
              <FolderPlus className="size-4" />
            </button>
          ) : null}
          <button
            aria-label="Upload markdown"
            className={`${toolbarButtonClass} border-emerald-400/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}
            onClick={() => uploadInputRef.current?.click()}
            title="Upload markdown"
            type="button"
          >
            <Upload className="size-4" />
          </button>
          <button
            aria-label="Download selected item"
            className={`${toolbarButtonClass} border-violet-400/25 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20`}
            disabled={!activeKnowledgeItem || !selectedFileQuery.data}
            onClick={() => {
              if (!activeKnowledgeItem || !selectedFileQuery.data) return
              downloadTextFile(
                selectedFileQuery.data.filename,
                selectedFileQuery.data.content,
                "text/markdown;charset=utf-8"
              )
            }}
            title="Download selected item"
            type="button"
          >
            <Download className="size-4" />
          </button>
          <button
            aria-label="Change linked local file"
            className={`${toolbarButtonClass} border-amber-400/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
            disabled={!selectedLinkedLocalFile}
            onClick={linkSelectedKnowledgeFile}
            title="Change linked local file"
            type="button"
          >
            <Link2 className="size-4" />
          </button>
          <button
            aria-label="Edit markdown"
            className={`${toolbarButtonClass} border-cyan-400/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20`}
            disabled={!activeKnowledgeItem || !selectedFileQuery.data}
            onClick={() => {
              setKnowledgeEditing(true)
              setShowBaselineManager(false)
            }}
            title="Edit markdown"
            type="button"
          >
            <Pencil className="size-4" />
          </button>

          <span className="flex-1" />

          {knowledgeEditing ? (
            <button
              aria-label="Save file"
              className={`${toolbarButtonClass} border-emerald-400/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}
              disabled={
                saveFileMutation.isPending ||
                !editorFilename.trim() ||
                !editorContent.trim() ||
                !editorDirty
              }
              onClick={() => saveFileMutation.mutate()}
              title="Save file"
              type="button"
            >
              <Check className="size-4" />
            </button>
          ) : null}
          <button
            aria-label="Apply canonical baseline"
            className={`${toolbarButtonClass} border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20`}
            onClick={() => {
              setShowBaselineManager((current) => !current)
              setKnowledgeEditing(false)
            }}
            title="Apply canonical baseline"
            type="button"
          >
            <SlidersHorizontal className="size-4" />
          </button>
          <button
            aria-label="Delete selected item"
            className={`${toolbarButtonClass} border-red-400/25 bg-red-500/10 text-red-300 hover:bg-red-500/20`}
            disabled={!activeKnowledgeItem || deleteFileMutation.isPending}
            onClick={() => {
              if (!activeKnowledgeItem) return
              if (
                window.confirm(
                  `Delete ${selectedFile?.filename ?? activeKnowledgeItem.title}? This cannot be undone.`
                )
              ) {
                deleteFileMutation.mutate()
              }
            }}
            title="Delete selected item"
            type="button"
          >
            <Trash2 className="size-4" />
          </button>

          <input
            ref={uploadInputRef}
            accept=".md,.env,.envrc,text/markdown,text/plain"
            className="hidden"
            multiple
            onChange={handleUpload}
            type="file"
          />
        </div>

        {knowledgeSection === "library" && knowledgeFolderCreating ? (
          <div className="flex flex-wrap items-end gap-3 rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-inset)] p-4">
            <div className="min-w-[240px] flex-1">
              <LabeledField label="Folder name">
                <Input
                  autoFocus
                  placeholder="new-folder"
                  value={folderDraft}
                  onChange={(event) => setFolderDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && folderDraft.trim()) {
                      event.preventDefault()
                      createFolderMutation.mutate()
                    }
                  }}
                />
              </LabeledField>
              <div className="claw-meta mt-1.5 text-[var(--claw-text-muted)]">
                Creates inside{" "}
                {selectedFolderContext.folder
                  ? `library/${selectedFolderContext.folder}`
                  : "library"}
                .
              </div>
            </div>
            <Button
              disabled={!folderDraft.trim() || createFolderMutation.isPending}
              onClick={() => createFolderMutation.mutate()}
              size="sm"
              type="button"
            >
              <FolderPlus className="mr-1.5 size-4" />
              {createFolderMutation.isPending ? "Creating..." : "Create folder"}
            </Button>
          </div>
        ) : null}

        {showBaselineManager ? (
          <div className="space-y-4 rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-inset)] p-4">
            <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
              Baselines
            </div>
            {canonicalBaselines.length ? (
              <div className="space-y-2">
                {canonicalBaselines.map((baseline) => (
                  <div
                    key={baseline.id}
                    className="flex items-center gap-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] p-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--claw-text-primary)]">
                      {baseline.name}
                    </span>
                    <Button
                      onClick={() => {
                        setEditorContent(baseline.content)
                        setEditorDirty(true)
                        setKnowledgeEditing(true)
                        setShowBaselineManager(false)
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Apply
                    </Button>
                    <Button
                      onClick={() => startEditBaseline(baseline)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => deleteBaseline(baseline.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--claw-text-muted)]">
                No baselines saved yet.
              </div>
            )}
            <Input
              placeholder="Baseline name"
              value={baselineDraftName}
              onChange={(event) => setBaselineDraftName(event.target.value)}
            />
            <Textarea
              className="min-h-36 font-mono text-sm"
              placeholder="# Canonical agent instructions"
              value={baselineDraftContent}
              onChange={(event) => setBaselineDraftContent(event.target.value)}
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
        ) : knowledgeEditing ? (
          <div className="flex min-h-[620px] flex-1 flex-col gap-3 rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-inset)] p-4">
            <div className="max-w-sm">
              <LabeledField label="Filename">
                <Input
                  value={editorFilename}
                  onChange={(event) => {
                    setEditorFilename(event.target.value)
                    setEditorDirty(true)
                  }}
                />
              </LabeledField>
            </div>
            <Textarea
              aria-label="Contents"
              className="min-h-[520px] flex-1 resize-none font-mono text-sm leading-6"
              value={editorContent}
              onChange={(event) => {
                setEditorContent(event.target.value)
                setEditorDirty(true)
              }}
            />
          </div>
        ) : (
          <div className="min-h-[620px] flex-1 rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-inset)] px-8 py-7">
            {knowledgeDiscoveryLoading || selectedFileQuery.isLoading ? (
              <div className="text-sm text-[var(--claw-text-muted)]">
                Loading {activeKnowledgeItem?.title ?? sectionPresentation.noun}
                ...
              </div>
            ) : knowledgeDiscoveryError && !activeKnowledgeItem ? (
              <div className="text-sm text-red-300">
                {knowledgeDiscoveryError}
              </div>
            ) : selectedFileQuery.error ? (
              <div className="text-sm text-red-300">
                {selectedFileQuery.error instanceof Error
                  ? selectedFileQuery.error.message
                  : `Unable to load ${sectionPresentation.noun} file`}
              </div>
            ) : editorContent.trim() ? (
              <RenderAgentKnowledgeMarkdown value={editorContent} />
            ) : (
              <div className="text-sm text-[var(--claw-text-muted)]">
                Select a {sectionPresentation.noun} file to view its contents.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
