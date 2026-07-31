"use client"

/*
 * These staged hooks preserve the dependency lists and initialization effects
 * from the original single controller hook. The forwarded context object is a
 * composition boundary, so hook analysis cannot infer the underlying fields.
 */
/* eslint-disable react-hooks/exhaustive-deps */

import type { ChangeEvent, ReactNode } from "react"
import { useOpenClawLibraryPhase7 } from "@/components/agents/use-openclaw-library-finalize"
import { OpenClawKnowledgeView } from "@/components/agents/openclaw-library-knowledge-view"
import { OpenClawWorkspaceView } from "@/components/agents/openclaw-library-workspace-view"
import type { LibraryListResult } from "@clawchat/contracts"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  ImageIcon,
  RefreshCcw,
} from "lucide-react"
import { toast } from "sonner"

import {
  isLinkedLocalFileSyncSupported,
  isLinkedLocalFolderSyncSupported,
  queryLinkedLocalHandlePermission,
  readLinkedLocalHandle,
  saveLinkedLocalSyncMetadataMap,
} from "@/lib/linked-local-sync"
import { sdk } from "@/lib/sdk"
import { Button } from "@/components/ui/button"
import {
  joinLibraryFolderPath,
  normalizeLibraryFolderPath,
  normalizePngFilename,
  normalizeWorkspaceTextFilename,
  parentLibraryFolderPath,
  readMarkdownFile,
  readPngFileAsBase64,
} from "@/components/agents/openclaw-library-paths"
import {
  useOpenClawLinkedLocalSyncController,
  withMutationTimeout,
  type WorkspaceTreeRoot,
} from "@/components/agents/use-openclaw-linked-local-sync"

export type {
  DirectoryHandleWithEntries,
  LinkedLocalHandleState,
  LinkedLocalLinkDialogState,
} from "@/components/agents/use-openclaw-linked-local-sync"

export {
  buildLinkedLocalFileMappingKey,
  buildLinkedLocalFolderMappingKey,
  hasLinkedLocalHandleAccess,
  isLinkedLocalSyncAbortError,
  joinLibraryFolderPath,
  normalizeLibraryFolderPath,
  normalizePngFilename,
  normalizeWorkspaceTextFilename,
  parentLibraryFolderPath,
  readMarkdownFile,
  readPngFileAsBase64,
} from "@/components/agents/openclaw-library-paths"

export type CanonicalBaseline = {
  id: string
  name: string
  content: string
}

export const BASELINES_STORAGE_KEY = "clawchat:canonical-baselines"

export function loadBaselinesFromStorage(): CanonicalBaseline[] {
  try {
    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem(BASELINES_STORAGE_KEY)
        : null
    return raw ? (JSON.parse(raw) as CanonicalBaseline[]) : []
  } catch {
    return []
  }
}

export function saveBaselinesToStorage(baselines: CanonicalBaseline[]) {
  localStorage.setItem(BASELINES_STORAGE_KEY, JSON.stringify(baselines))
}

export function formatWorkspaceTreeMutationError(
  error: Error,
  action: "file" | "folder"
) {
  const message = error.message || `Unable to delete ${action}`

  if (
    action === "folder" &&
    /Cannot POST .*\/(library|openclaw\/agent-workspace)\/folder\/delete/i.test(
      message
    )
  ) {
    return [
      "Folder deletion is unavailable on the current API target.",
      "The connected Relay Console backend deployment does not expose the folder-delete route yet.",
    ].join(" ")
  }

  return message
}

export function isBridgeControlUnavailableMessage(message?: string | null) {
  return Boolean(
    message &&
    (/No local OpenClaw bridge control client is connected/i.test(message) ||
      /The selected runtime host is not currently reachable/i.test(message))
  )
}
export type OpenClawLibraryCardProps = {
  isOpen: boolean
  workspaceId?: string | null
  agentId?: string | null
  runtimeType?: string | null
  agentLabel: string
  agentAvatarUrl?: string | null
  agentGroupLabel?: string | null
  knowledgeSection?: "instructions" | "library" | "memory" | "skills"
  libraryOnly?: boolean
  onOpenChat?: () => void
}

type HermesRoot = Extract<
  WorkspaceTreeRoot,
  "agent" | "shared" | "sessions" | "project"
>

function folderKey(root: WorkspaceTreeRoot, folder: string = "") {
  return `${root}:${normalizeLibraryFolderPath(folder)}`
}

function isHermesRoot(root: WorkspaceTreeRoot): root is HermesRoot {
  return (
    root === "agent" ||
    root === "shared" ||
    root === "sessions" ||
    root === "project"
  )
}

function isEditableTextTreeFile(filename: string) {
  return isMarkdownTreeFile(filename) || isEnvTreeFile(filename)
}

function isMarkdownTreeFile(filename: string) {
  return filename.toLowerCase().endsWith(".md")
}

function isEnvTreeFile(filename: string) {
  return filename.toLowerCase().startsWith(".env")
}

function isPngTreeFile(filename: string) {
  return filename.toLowerCase().endsWith(".png")
}

function toHermesPath(folder: string) {
  const normalized = normalizeLibraryFolderPath(folder)
  return normalized ? `/${normalized}` : "/"
}

type SelectedTreeNode =
  | {
      kind: "folder"
      root: WorkspaceTreeRoot
      folder: string
    }
  | {
      kind: "file"
      root: WorkspaceTreeRoot
      folder: string
      filename: string
    }

type SelectedTreeFile = Extract<SelectedTreeNode, { kind: "file" }>

type FolderState = {
  data?: LibraryListResult
  error?: string | null
  loading?: boolean
  bridgeReconnecting?: boolean
}

type KnowledgeItem = {
  id: string
  root: WorkspaceTreeRoot
  rootLabel: string
  folder: string
  filename: string
  path: string
  title: string
  subtitle: string
  kind: "file" | "folder"
  groupTitle: string
  status: string
}

function instructionStatus(filename: string) {
  switch (filename.toLowerCase()) {
    case "soul.md":
    case "identity.md":
      return "Identity"
    case "agents.md":
    case "claude.md":
    case ".cursorrules":
      return "Workspace instructions"
    case "tools.md":
      return "Tool guidance"
    case "user.md":
      return "User context"
    case "heartbeat.md":
      return "Heartbeat"
    default:
      return "Runtime instructions"
  }
}

function useOpenClawLibraryPhase1(
  context: OpenClawLibraryCardProps & { libraryOnly: boolean }
) {
  const [folderStates, setFolderStates] = useState<Record<string, FolderState>>(
    {}
  )
  const isHermesWorkspace = context.runtimeType === "hermes"
  const workspaceRoots = useMemo(
    () =>
      context.libraryOnly
        ? ([{ id: "library", label: "Agent library" }] as Array<{
            id: WorkspaceTreeRoot
            label: string
          }>)
        : isHermesWorkspace
          ? ([
              { id: "agent", label: `${context.agentLabel} workspace` },
              { id: "shared", label: "Hermes shared" },
              { id: "sessions", label: "Sessions" },
              { id: "project", label: "Project" },
            ] as Array<{ id: WorkspaceTreeRoot; label: string }>)
          : ([
              { id: "library", label: "library" },
              { id: "workspace", label: `${context.agentLabel} workspace` },
            ] as Array<{ id: WorkspaceTreeRoot; label: string }>),
    [context.agentLabel, isHermesWorkspace, context.libraryOnly]
  )
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({})
  const [selectedNode, setSelectedNode] = useState<SelectedTreeNode | null>({
    kind: "folder",
    root: isHermesWorkspace && !context.libraryOnly ? "agent" : "library",
    folder: "",
  })
  const [editorFilename, setEditorFilename] = useState("")
  const [editorContent, setEditorContent] = useState("")
  const [editorDirty, setEditorDirty] = useState(false)
  const [knowledgeSelectorCollapsed, setKnowledgeSelectorCollapsed] =
    useState(true)
  const [knowledgeEditing, setKnowledgeEditing] = useState(false)
  const [knowledgeFolderCreating, setKnowledgeFolderCreating] = useState(false)
  const [folderDraft, setFolderDraft] = useState("")
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    kind: "file" | "folder"
    label: string
  } | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const pngUploadInputRef = useRef<HTMLInputElement | null>(null)
  const [canonicalBaselines, setCanonicalBaselines] = useState<
    CanonicalBaseline[]
  >(() => loadBaselinesFromStorage())
  const [selectedBaselineId, setSelectedBaselineId] = useState("")
  const [showBaselineManager, setShowBaselineManager] = useState(false)
  const [baselineDraftName, setBaselineDraftName] = useState("")
  const [baselineDraftContent, setBaselineDraftContent] = useState("")
  const [editingBaselineId, setEditingBaselineId] = useState<string | null>(
    null
  )
  const queryClient = useQueryClient()

  const selectedFile =
    selectedNode?.kind === "file" ? (selectedNode as SelectedTreeFile) : null
  const selectedLibraryFolder = useMemo(
    () =>
      selectedNode?.kind === "folder" && selectedNode.root === "library"
        ? {
            root: "library" as const,
            folder: normalizeLibraryFolderPath(selectedNode.folder),
          }
        : null,
    [selectedNode]
  )
  const selectedLibraryFile = useMemo(
    () =>
      selectedNode?.kind === "file" && selectedNode.root === "library"
        ? {
            root: "library" as const,
            folder: normalizeLibraryFolderPath(selectedNode.folder),
            filename: normalizeWorkspaceTextFilename(selectedNode.filename),
          }
        : null,
    [selectedNode]
  )
  const selectedWorkspaceFile = useMemo(
    () =>
      selectedNode?.kind === "file" &&
      selectedNode.root === "workspace" &&
      context.agentId
        ? {
            root: "workspace" as const,
            agentId: context.agentId,
            folder: normalizeLibraryFolderPath(selectedNode.folder),
            filename: normalizeWorkspaceTextFilename(selectedNode.filename),
          }
        : null,
    [context.agentId, selectedNode]
  )
  const selectedHermesFolder = useMemo(
    () =>
      selectedNode?.kind === "folder" &&
      isHermesRoot(selectedNode.root) &&
      !isReadOnlyRoot(selectedNode.root) &&
      context.agentId
        ? {
            root: selectedNode.root as Exclude<HermesRoot, "sessions">,
            agentId: context.agentId,
            folder: normalizeLibraryFolderPath(selectedNode.folder),
          }
        : null,
    [context.agentId, selectedNode]
  )
  const selectedHermesFile = useMemo(
    () =>
      selectedNode?.kind === "file" &&
      isHermesRoot(selectedNode.root) &&
      !isReadOnlyRoot(selectedNode.root) &&
      context.agentId
        ? {
            root: selectedNode.root as Exclude<HermesRoot, "sessions">,
            agentId: context.agentId,
            folder: normalizeLibraryFolderPath(selectedNode.folder),
            filename: normalizeWorkspaceTextFilename(selectedNode.filename),
          }
        : null,
    [context.agentId, selectedNode]
  )
  const selectedFolderContext =
    selectedNode?.kind === "folder"
      ? {
          root: selectedNode.root,
          folder: selectedNode.folder,
        }
      : selectedNode?.kind === "file"
        ? {
            root: selectedNode.root,
            folder: selectedNode.folder,
          }
        : {
            root: (isHermesWorkspace && !context.libraryOnly
              ? "agent"
              : "library") as WorkspaceTreeRoot,
            folder: "",
          }

  function isReadOnlyRoot(root: WorkspaceTreeRoot) {
    return root === "sessions"
  }

  function formatLocationLabel(root: WorkspaceTreeRoot, folder: string) {
    const rootLabel =
      root === "library"
        ? "library"
        : root === "workspace"
          ? `${context.agentLabel} workspace`
          : root === "agent"
            ? `${context.agentLabel} workspace`
            : root === "shared"
              ? "Hermes shared"
              : root === "sessions"
                ? "Sessions"
                : "Project"
    return folder ? `${rootLabel}/${folder}` : rootLabel
  }

  function formatFileLocation(
    root: WorkspaceTreeRoot,
    folder: string,
    filename: string
  ) {
    const normalizedFolder = normalizeLibraryFolderPath(folder)
    const normalizedFilename = normalizeWorkspaceTextFilename(filename)
    const rootLabel =
      root === "library" || root === "workspace" || root === "agent"
        ? root === "library"
          ? "library"
          : `${context.agentLabel} workspace`
        : root === "shared"
          ? "Hermes shared"
          : root === "sessions"
            ? "Sessions"
            : "Project"

    return normalizedFolder
      ? `${rootLabel}/${normalizedFolder}/${normalizedFilename}`
      : `${rootLabel}/${normalizedFilename}`
  }

  function isVisibleTreeFolder(name: string) {
    if (name === ".openclaw") return true
    return !name.startsWith(".")
  }

  function isVisibleTreeFile(filename: string) {
    return isEditableTextTreeFile(filename) || isPngTreeFile(filename)
  }

  function selectFolder(root: WorkspaceTreeRoot, folder: string = "") {
    setSelectedNode({
      kind: "folder",
      root,
      folder: normalizeLibraryFolderPath(folder),
    })
    setEditorFilename("")
    setEditorContent("")
    setEditorDirty(false)
  }

  function selectFile(
    root: WorkspaceTreeRoot,
    folder: string,
    filename: string
  ) {
    setSelectedNode({
      kind: "file",
      root,
      folder,
      filename,
    })
    setEditorDirty(false)
  }

  function startNewMarkdown() {
    if (isReadOnlyRoot(selectedFolderContext.root)) return
    selectFolder(selectedFolderContext.root, selectedFolderContext.folder)
  }

  useEffect(() => {
    const firstRoot =
      workspaceRoots[0]?.id ??
      (isHermesWorkspace && !context.libraryOnly ? "agent" : "library")
    setExpandedFolders({ [`${firstRoot}:`]: true })
    setFolderStates({})
    setSelectedNode({
      kind: "folder",
      root: firstRoot,
      folder: "",
    })
    setEditorFilename("")
    setEditorContent("")
    setEditorDirty(false)
    setKnowledgeSelectorCollapsed(true)
    setKnowledgeEditing(false)
    setKnowledgeFolderCreating(false)
  }, [context.agentId, isHermesWorkspace, context.libraryOnly, workspaceRoots])
  return {
    ...context,
    folderStates,
    setFolderStates,
    isHermesWorkspace,
    workspaceRoots,
    expandedFolders,
    setExpandedFolders,
    selectedNode,
    setSelectedNode,
    editorFilename,
    setEditorFilename,
    editorContent,
    setEditorContent,
    editorDirty,
    setEditorDirty,
    knowledgeSelectorCollapsed,
    setKnowledgeSelectorCollapsed,
    knowledgeEditing,
    setKnowledgeEditing,
    knowledgeFolderCreating,
    setKnowledgeFolderCreating,
    folderDraft,
    setFolderDraft,
    confirmDeleteTarget,
    setConfirmDeleteTarget,
    uploadInputRef,
    pngUploadInputRef,
    canonicalBaselines,
    setCanonicalBaselines,
    selectedBaselineId,
    setSelectedBaselineId,
    showBaselineManager,
    setShowBaselineManager,
    baselineDraftName,
    setBaselineDraftName,
    baselineDraftContent,
    setBaselineDraftContent,
    editingBaselineId,
    setEditingBaselineId,
    queryClient,
    selectedFile,
    selectedLibraryFolder,
    selectedLibraryFile,
    selectedWorkspaceFile,
    selectedHermesFolder,
    selectedHermesFile,
    selectedFolderContext,
    isReadOnlyRoot,
    formatLocationLabel,
    formatFileLocation,
    isVisibleTreeFolder,
    isVisibleTreeFile,
    selectFolder,
    selectFile,
    startNewMarkdown,
  }
}

function useOpenClawLibraryPhase2(
  context: ReturnType<typeof useOpenClawLibraryPhase1>
) {
  const loadFolder = useCallback(
    async (root: WorkspaceTreeRoot, folder: string = "", retryAttempt = 0) => {
      if (!context.workspaceId) return
      if (root !== "library" && !context.agentId) return

      const normalizedFolder = normalizeLibraryFolderPath(folder)
      const key = folderKey(root, normalizedFolder)
      const maxBridgeRetryAttempts = 3

      context.setFolderStates((current) => ({
        ...current,
        [key]: {
          ...current[key],
          loading: true,
          error: null,
          bridgeReconnecting: false,
        },
      }))

      try {
        const data =
          root === "library"
            ? await sdk.workspaces.libraryList(
                context.workspaceId,
                normalizedFolder
              )
            : root === "workspace"
              ? await sdk.workspaces.agentWorkspaceList(
                  context.workspaceId,
                  context.agentId!,
                  normalizedFolder
                )
              : await sdk.workspaces.hermesWorkspaceList(
                  context.workspaceId,
                  context.agentId!,
                  root,
                  toHermesPath(normalizedFolder)
                )

        context.setFolderStates((current) => ({
          ...current,
          [key]: {
            data,
            loading: false,
            error: null,
          },
        }))
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unable to load folder"
        const bridgeUnavailable =
          isBridgeControlUnavailableMessage(errorMessage)

        if (bridgeUnavailable && retryAttempt < maxBridgeRetryAttempts) {
          context.setFolderStates((current) => ({
            ...current,
            [key]: {
              ...current[key],
              loading: true,
              error:
                "Bridge reconnecting. Retrying workspace files in a moment.",
              bridgeReconnecting: true,
            },
          }))

          window.setTimeout(
            () => {
              void loadFolder(root, normalizedFolder, retryAttempt + 1)
            },
            1200 + retryAttempt * 900
          )
          return
        }

        context.setFolderStates((current) => ({
          ...current,
          [key]: {
            ...current[key],
            loading: false,
            error: bridgeUnavailable
              ? "No bridge control client is connected right now. Start or reconnect the local OpenClaw bridge, then retry."
              : errorMessage,
            bridgeReconnecting: false,
          },
        }))
      }
    },
    [context.agentId, context.workspaceId]
  )

  const {
    confirmLinkedLocalLinkDialog,
    handleSelectedFileSyncAction,
    handleSelectedFileSyncToLocalAction,
    handleSelectedFolderSyncAction,
    handleSelectedFolderSyncToLocalAction,
    isLinkingSelectedTarget,
    isSyncingSelectedTarget,
    linkedLocalHandleRevision,
    linkedLocalLinkDialog,
    linkedLocalSyncMetadataMap,
    linkingTargetKey,
    performLinkLocalFile,
    selectedLinkedLocalFile,
    selectedLinkedLocalFolder,
    selectedLinkedLocalKey,
    selectedLinkedLocalMeta,
    selectedLinkedLocalStatus,
    selectedLinkedLocalSummary,
    selectedLinkedLocalSupport,
    setLinkedLocalBrowserSupport,
    setLinkedLocalHandleState,
    setLinkedLocalLinkDialog,
  } = useOpenClawLinkedLocalSyncController({
    agentId: context.agentId,
    formatFileLocation: context.formatFileLocation,
    formatLocationLabel: context.formatLocationLabel,
    isEditableTextTreeFile,
    loadFolder,
    queryClient: context.queryClient,
    selectedFile: context.selectedFile,
    selectedLibraryFile: context.selectedLibraryFile,
    selectedLibraryFolder: context.selectedLibraryFolder,
    selectedHermesFile: context.selectedHermesFile,
    selectedHermesFolder: context.selectedHermesFolder,
    selectedWorkspaceFile: context.selectedWorkspaceFile,
    setEditorContent: context.setEditorContent,
    setEditorDirty: context.setEditorDirty,
    setEditorFilename: context.setEditorFilename,
    toHermesPath,
    workspaceId: context.workspaceId,
  })

  useEffect(() => {
    saveLinkedLocalSyncMetadataMap(linkedLocalSyncMetadataMap)
  }, [linkedLocalSyncMetadataMap])

  useEffect(() => {
    setLinkedLocalBrowserSupport({
      folder: isLinkedLocalFolderSyncSupported(),
      file: isLinkedLocalFileSyncSupported(),
    })
  }, [setLinkedLocalBrowserSupport])

  useEffect(() => {
    if (!context.isOpen || !context.workspaceId) return

    for (const root of context.workspaceRoots) {
      if (root.id === "library" || context.agentId) {
        void loadFolder(root.id, "")
      }
    }
  }, [
    context.agentId,
    context.isOpen,
    context.knowledgeSection,
    loadFolder,
    context.workspaceId,
    context.workspaceRoots,
  ])

  useEffect(() => {
    let cancelled = false

    if (
      !selectedLinkedLocalKey ||
      !selectedLinkedLocalMeta ||
      !selectedLinkedLocalSupport
    ) {
      setLinkedLocalHandleState({
        key: selectedLinkedLocalKey,
        loading: false,
        handle: null,
        missing: false,
        permission: "unknown",
      })
      return
    }

    const currentLinkedLocalKey = selectedLinkedLocalKey

    setLinkedLocalHandleState({
      key: currentLinkedLocalKey,
      loading: true,
      handle: null,
      missing: false,
      permission: "unknown",
    })

    async function loadLinkedLocalHandleState() {
      try {
        const handle = await readLinkedLocalHandle(currentLinkedLocalKey)

        if (
          !handle ||
          (selectedLinkedLocalFolder && handle.kind !== "directory") ||
          (selectedLinkedLocalFile && handle.kind !== "file")
        ) {
          if (!cancelled) {
            setLinkedLocalHandleState({
              key: currentLinkedLocalKey,
              loading: false,
              handle: null,
              missing: true,
              permission: "unknown",
            })
          }
          return
        }

        const permission = await queryLinkedLocalHandlePermission(handle)

        if (!cancelled) {
          setLinkedLocalHandleState({
            key: currentLinkedLocalKey,
            loading: false,
            handle,
            missing: false,
            permission,
          })
        }
      } catch {
        if (!cancelled) {
          setLinkedLocalHandleState({
            key: currentLinkedLocalKey,
            loading: false,
            handle: null,
            missing: true,
            permission: "unknown",
          })
        }
      }
    }

    void loadLinkedLocalHandleState()

    return () => {
      cancelled = true
    }
  }, [
    selectedLinkedLocalKey,
    selectedLinkedLocalMeta,
    selectedLinkedLocalSupport,
    selectedLinkedLocalFolder,
    selectedLinkedLocalFile,
    linkedLocalHandleRevision,
    setLinkedLocalHandleState,
  ])

  const shouldDiscoverKnowledgeFolder = useCallback(
    (path: string) => {
      const pathParts = normalizeLibraryFolderPath(path)
        .toLowerCase()
        .split("/")
        .filter(Boolean)
      return context.knowledgeSection === "instructions"
        ? !pathParts.includes("skills")
        : context.knowledgeSection === "memory"
          ? !pathParts.includes("skills")
          : context.knowledgeSection === "skills"
            ? pathParts.includes("skills")
            : false
    },
    [context.knowledgeSection]
  )

  function canDescendIntoKnowledgeFolder(folder: string) {
    const depth = normalizeLibraryFolderPath(folder)
      .split("/")
      .filter(Boolean).length
    return depth < 32
  }
  return {
    ...context,
    loadFolder,
    confirmLinkedLocalLinkDialog,
    handleSelectedFileSyncAction,
    handleSelectedFileSyncToLocalAction,
    handleSelectedFolderSyncAction,
    handleSelectedFolderSyncToLocalAction,
    isLinkingSelectedTarget,
    isSyncingSelectedTarget,
    linkedLocalHandleRevision,
    linkedLocalLinkDialog,
    linkedLocalSyncMetadataMap,
    linkingTargetKey,
    performLinkLocalFile,
    selectedLinkedLocalFile,
    selectedLinkedLocalFolder,
    selectedLinkedLocalKey,
    selectedLinkedLocalMeta,
    selectedLinkedLocalStatus,
    selectedLinkedLocalSummary,
    selectedLinkedLocalSupport,
    setLinkedLocalBrowserSupport,
    setLinkedLocalHandleState,
    setLinkedLocalLinkDialog,
    shouldDiscoverKnowledgeFolder,
    canDescendIntoKnowledgeFolder,
  }
}

function useOpenClawLibraryPhase3(
  context: ReturnType<typeof useOpenClawLibraryPhase2>
) {
  useEffect(() => {
    if (
      context.knowledgeSection !== "instructions" &&
      context.knowledgeSection !== "memory" &&
      context.knowledgeSection !== "skills"
    )
      return

    for (const root of context.workspaceRoots) {
      if (
        context.knowledgeSection === "instructions" &&
        (root.id === "library" || root.id === "sessions")
      )
        continue
      const loadedFolders = Object.entries(context.folderStates).filter(
        ([key, state]) => key.startsWith(`${root.id}:`) && state.data
      )

      for (const [, state] of loadedFolders) {
        const data = state.data!
        if (!context.canDescendIntoKnowledgeFolder(data.folder)) continue

        for (const folder of data.folders) {
          const path = normalizeLibraryFolderPath(folder.path)
          const key = folderKey(root.id, path)
          if (
            context.shouldDiscoverKnowledgeFolder(path) &&
            !context.folderStates[key]
          ) {
            void context.loadFolder(root.id, path)
          }
        }
      }
    }
  }, [
    context.folderStates,
    context.knowledgeSection,
    context.loadFolder,
    context.shouldDiscoverKnowledgeFolder,
    context.workspaceRoots,
  ])

  const knowledgeItems = useMemo(() => {
    if (!context.knowledgeSection) return [] as KnowledgeItem[]

    const instructionOrder = [
      "soul.md",
      "identity.md",
      "agents.md",
      "tools.md",
      "user.md",
      "heartbeat.md",
      "workflow.md",
      ".hermes.md",
      "hermes.md",
      "claude.md",
      ".cursorrules",
    ]
    const rootPriority: Record<WorkspaceTreeRoot, number> = {
      agent: 0,
      workspace: 0,
      project: 1,
      shared: 2,
      library: 3,
      sessions: 4,
    }
    const memoryGroupPriority: Record<string, number> = {
      "Pinned Memory": 0,
      "Daily Memory": 1,
      "Session Summaries": 2,
    }
    const items: KnowledgeItem[] = []

    for (const root of context.workspaceRoots) {
      const states = Object.entries(context.folderStates).filter(
        ([key, state]) => key.startsWith(`${root.id}:`) && state.data
      )

      for (const [, state] of states) {
        const data = state.data!

        if (context.knowledgeSection === "instructions") {
          if (root.id === "library" || root.id === "sessions") continue
          const folderParts = data.folder
            .toLowerCase()
            .split("/")
            .filter(Boolean)
          if (folderParts.includes("skills")) continue
          for (const file of data.files) {
            if (!isMarkdownTreeFile(file.filename)) continue
            items.push({
              id: `${root.id}:${file.path}`,
              root: root.id,
              rootLabel: root.label,
              folder: data.folder,
              filename: file.filename,
              path: file.path,
              title: file.filename,
              subtitle: `${root.label}/${file.path}`,
              kind: "file",
              groupTitle: instructionStatus(file.filename),
              status: instructionStatus(file.filename),
            })
          }
          continue
        }

        if (context.knowledgeSection === "library") {
          if (data.folder) {
            items.push({
              id: `${root.id}:folder:${data.folder}`,
              root: root.id,
              rootLabel: root.label,
              folder: data.folder,
              filename: "",
              path: data.folder,
              title: data.folder.split("/").at(-1) ?? "Library",
              subtitle: `Agent library/${data.folder}`,
              kind: "folder",
              groupTitle: "Library folder",
              status: "Folder",
            })
          }
          for (const file of data.files) {
            if (!isEditableTextTreeFile(file.filename)) continue
            items.push({
              id: `${root.id}:${file.path}`,
              root: root.id,
              rootLabel: root.label,
              folder: data.folder,
              filename: file.filename,
              path: file.path,
              title: file.filename,
              subtitle: `Agent library/${file.path}`,
              kind: "file",
              groupTitle: "Library document",
              status: "Document",
            })
          }
          continue
        }

        if (context.knowledgeSection === "memory") {
          const folderParts = data.folder
            .toLowerCase()
            .split("/")
            .filter(Boolean)
          const folderName = folderParts.at(-1) ?? ""
          if (folderName === "memory" || folderName === "memories") {
            items.push({
              id: `${root.id}:folder:${data.folder}`,
              root: root.id,
              rootLabel: root.label,
              folder: data.folder,
              filename: "",
              path: data.folder,
              title: data.folder.split("/").at(-1) ?? folderName,
              subtitle: `${root.label}/${data.folder}`,
              kind: "folder",
              groupTitle: "Pinned Memory",
              status: "Pinned Memory",
            })
          }

          for (const file of data.files) {
            const name = file.filename.toLowerCase()
            const path = file.path.toLowerCase()
            const inMemoryLocation = folderParts.some(
              (part) => part === "memory" || part === "memories"
            )
            let groupTitle: string | null = null
            if (
              name === "memory.md" ||
              (name === "user.md" && inMemoryLocation)
            ) {
              groupTitle = "Pinned Memory"
            } else if (
              /\d{4}[-_]\d{2}[-_]\d{2}/.test(path) ||
              (path.includes("daily") &&
                (path.includes("memory") || path.includes("memories")))
            ) {
              groupTitle = "Daily Memory"
            } else if (
              (path.includes("summary") ||
                path.includes("summaries") ||
                path.includes("wrap-up") ||
                path.includes("wrapup")) &&
              (path.includes("session") ||
                path.includes("conversation") ||
                path.includes("handover"))
            ) {
              groupTitle = "Session Summaries"
            }
            if (!groupTitle) continue
            items.push({
              id: `${root.id}:${file.path}`,
              root: root.id,
              rootLabel: root.label,
              folder: data.folder,
              filename: file.filename,
              path: file.path,
              title: file.filename,
              subtitle: `${root.label}/${file.path}`,
              kind: "file",
              groupTitle,
              status: groupTitle,
            })
          }
          continue
        }

        if (context.knowledgeSection === "skills" && data.folder) {
          const parts = data.folder.toLowerCase().split("/").filter(Boolean)
          const isSkillFolder =
            parts.slice(0, -1).includes("skills") &&
            data.files.some(
              (file) => file.filename.toLowerCase() === "skill.md"
            )
          if (!isSkillFolder) continue
          items.push({
            id: `${root.id}:skill:${data.folder}`,
            root: root.id,
            rootLabel: root.label,
            folder: data.folder,
            filename: "SKILL.md",
            path: data.folder,
            title: data.folder.split("/").at(-1) ?? "Skill",
            subtitle: `${root.label}/${data.folder}`,
            kind: "folder",
            groupTitle: "Installed Skills",
            status: "Installed",
          })
        }
      }
    }

    return items.sort((a, b) => {
      const rootDifference = rootPriority[a.root] - rootPriority[b.root]
      if (rootDifference !== 0) return rootDifference
      if (context.knowledgeSection === "instructions") {
        const aIndex = instructionOrder.indexOf(a.filename.toLowerCase())
        const bIndex = instructionOrder.indexOf(b.filename.toLowerCase())
        return (
          (aIndex === -1 ? instructionOrder.length : aIndex) -
            (bIndex === -1 ? instructionOrder.length : bIndex) ||
          a.path.localeCompare(b.path, undefined, { numeric: true })
        )
      }
      if (context.knowledgeSection === "memory") {
        const groupDifference =
          memoryGroupPriority[a.groupTitle] - memoryGroupPriority[b.groupTitle]
        if (groupDifference !== 0) return groupDifference
      }
      return a.title.localeCompare(b.title, undefined, { numeric: true })
    })
  }, [context.folderStates, context.knowledgeSection, context.workspaceRoots])
  return {
    ...context,
    knowledgeItems,
  }
}

function useOpenClawLibraryPhase4(
  context: ReturnType<typeof useOpenClawLibraryPhase3>
) {
  useEffect(() => {
    if (!context.knowledgeSection || !context.knowledgeItems.length) return
    if (context.knowledgeEditing || context.editorDirty) return
    const selectionIsVisible = context.knowledgeItems.some((item) => {
      if (item.kind === "file") {
        return (
          context.selectedFile?.root === item.root &&
          context.selectedFile.folder === item.folder &&
          context.selectedFile.filename === item.filename
        )
      }
      return (
        context.selectedNode?.root === item.root &&
        ((context.selectedNode.kind === "folder" &&
          context.selectedNode.folder === item.folder) ||
          (context.selectedNode.kind === "file" &&
            (context.selectedNode.folder === item.folder ||
              context.selectedNode.folder.startsWith(`${item.folder}/`))))
      )
    })
    if (selectionIsVisible) return

    const first = context.knowledgeItems[0]
    if (first.kind === "file") {
      context.selectFile(first.root, first.folder, first.filename)
      return
    }
    const folderData =
      context.folderStates[folderKey(first.root, first.folder)]?.data
    const preferredFile =
      context.knowledgeSection === "skills"
        ? folderData?.files.find(
            (file) => file.filename.toLowerCase() === "skill.md"
          )
        : folderData?.files.find((file) =>
            isEditableTextTreeFile(file.filename)
          )
    if (preferredFile) {
      context.selectFile(first.root, first.folder, preferredFile.filename)
    } else {
      context.selectFolder(first.root, first.folder)
    }
  }, [
    context.folderStates,
    context.editorDirty,
    context.knowledgeEditing,
    context.knowledgeItems,
    context.knowledgeSection,
    context.selectedFile,
    context.selectedNode,
  ])

  const selectedFileQuery = useQuery({
    queryKey: [
      "openclaw-tree-file",
      context.workspaceId,
      context.agentId,
      context.selectedFile?.root,
      context.selectedFile?.folder,
      context.selectedFile?.filename,
    ],
    enabled: Boolean(
      context.isOpen &&
      context.workspaceId &&
      context.selectedFile &&
      (context.selectedFile.root === "library" || context.agentId)
    ),
    queryFn: () => {
      if (!context.workspaceId || !context.selectedFile) {
        throw new Error("Select a file")
      }

      return context.selectedFile.root === "library"
        ? sdk.workspaces.libraryReadFile(
            context.workspaceId,
            context.selectedFile.folder,
            context.selectedFile.filename
          )
        : context.selectedFile.root === "workspace"
          ? sdk.workspaces.agentWorkspaceReadFile(
              context.workspaceId,
              context.agentId!,
              context.selectedFile.folder,
              context.selectedFile.filename
            )
          : sdk.workspaces.hermesWorkspaceReadFile(
              context.workspaceId,
              context.agentId!,
              context.selectedFile.root,
              toHermesPath(context.selectedFile.folder),
              context.selectedFile.filename
            )
    },
  })

  const selectedFileQueryKey = [
    "openclaw-tree-file",
    context.workspaceId,
    context.agentId,
    context.selectedFile?.root,
    context.selectedFile?.folder,
    context.selectedFile?.filename,
  ] as const

  useEffect(() => {
    if (!context.selectedFile || !selectedFileQuery.data) return
    context.setEditorFilename(selectedFileQuery.data.filename)
    context.setEditorContent(selectedFileQuery.data.content)
    context.setEditorDirty(false)
    context.setKnowledgeEditing(false)
  }, [context.selectedFile, selectedFileQuery.data])

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      if (!context.workspaceId) throw new Error("Select a workspace first")
      if (!context.folderDraft.trim()) throw new Error("Enter a folder name")
      if (context.isReadOnlyRoot(context.selectedFolderContext.root)) {
        throw new Error("This Hermes surface is read-only")
      }

      const targetFolder = joinLibraryFolderPath(
        context.selectedFolderContext.folder,
        context.folderDraft
      )

      return context.selectedFolderContext.root === "library"
        ? sdk.workspaces.libraryCreateFolder(context.workspaceId, targetFolder)
        : context.selectedFolderContext.root === "workspace"
          ? sdk.workspaces.agentWorkspaceCreateFolder(
              context.workspaceId,
              context.agentId!,
              targetFolder
            )
          : sdk.workspaces.hermesWorkspaceCreateFolder(context.workspaceId, {
              agentId: context.agentId!,
              folder: context.selectedFolderContext.root,
              path: toHermesPath(context.selectedFolderContext.folder),
              filename: context.folderDraft.trim(),
            })
    },
    onSuccess: async () => {
      context.setFolderDraft("")
      context.setKnowledgeFolderCreating(false)
      await context.loadFolder(
        context.selectedFolderContext.root,
        context.selectedFolderContext.folder
      )
      toast.success("Folder created")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const saveFileMutation = useMutation({
    mutationFn: async () => {
      if (!context.workspaceId) throw new Error("Select a workspace first")
      if (context.isReadOnlyRoot(context.selectedFolderContext.root)) {
        throw new Error("This Hermes surface is read-only")
      }

      const filename = normalizeWorkspaceTextFilename(context.editorFilename)
      if (!filename) throw new Error("Enter a markdown or env filename")
      if (!context.editorContent.trim()) throw new Error("Enter file content")

      const input = {
        folder: context.selectedFolderContext.folder,
        files: [
          {
            filename,
            content: context.editorContent,
          },
        ],
      }

      return context.selectedFolderContext.root === "library"
        ? sdk.workspaces.libraryWriteFiles(context.workspaceId, input)
        : context.selectedFolderContext.root === "workspace"
          ? sdk.workspaces.agentWorkspaceWriteFiles(
              context.workspaceId,
              context.agentId!,
              input
            )
          : sdk.workspaces.hermesWorkspaceWriteFiles(context.workspaceId, {
              agentId: context.agentId!,
              folder: context.selectedFolderContext.root,
              path: toHermesPath(context.selectedFolderContext.folder),
              files: input.files.map((file) => ({
                filename: file.filename,
                content: file.content,
                encoding: "utf8",
              })),
            })
    },
    onSuccess: async (result) => {
      const filename =
        result.written[0] ??
        normalizeWorkspaceTextFilename(context.editorFilename)

      await context.loadFolder(
        context.selectedFolderContext.root,
        context.selectedFolderContext.folder
      )
      context.selectFile(
        context.selectedFolderContext.root,
        context.selectedFolderContext.folder,
        filename
      )
      context.setEditorFilename(filename)
      context.setEditorDirty(false)
      context.setKnowledgeEditing(false)
      toast.success(`Saved ${filename}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteFileMutation = useMutation({
    onMutate: async () => {
      context.setConfirmDeleteTarget(null)
      await context.queryClient.cancelQueries({
        queryKey: selectedFileQueryKey,
      })
    },
    mutationFn: async () => {
      if (!context.workspaceId || !context.selectedFile) {
        throw new Error("Select a file")
      }
      if (context.isReadOnlyRoot(context.selectedFile.root)) {
        throw new Error("This Hermes surface is read-only")
      }

      const fileToDelete = {
        root: context.selectedFile.root,
        folder: context.selectedFile.folder,
        filename: context.selectedFile.filename,
      }

      const input = {
        folder: fileToDelete.folder,
        filename: fileToDelete.filename,
      }

      const result = await withMutationTimeout(
        fileToDelete.root === "library"
          ? sdk.workspaces.libraryDeleteFile(context.workspaceId, input)
          : fileToDelete.root === "workspace"
            ? sdk.workspaces.agentWorkspaceDeleteFile(
                context.workspaceId,
                context.agentId!,
                input
              )
            : sdk.workspaces.hermesWorkspaceDeleteFile(context.workspaceId, {
                agentId: context.agentId!,
                folder: fileToDelete.root,
                path: toHermesPath(fileToDelete.folder),
                filename: fileToDelete.filename,
              }),
        20_000,
        `Timed out deleting ${fileToDelete.filename}`
      )

      return {
        ...fileToDelete,
        result,
      }
    },
    onSuccess: async ({ root, folder, filename, result }) => {
      context.queryClient.removeQueries({
        queryKey: [
          "openclaw-tree-file",
          context.workspaceId,
          context.agentId,
          root,
          folder,
          filename,
        ],
        exact: true,
      })
      context.selectFolder(root, result.folder)
      await context.loadFolder(root, result.folder)
      toast.success(`Deleted ${result.filename}`)
    },
    onError: (error: Error) => {
      context.setConfirmDeleteTarget(null)
      toast.error(error.message)
    },
    onSettled: () => {
      context.setConfirmDeleteTarget(null)
    },
  })
  return {
    ...context,
    selectedFileQuery,
    selectedFileQueryKey,
    createFolderMutation,
    saveFileMutation,
    deleteFileMutation,
  }
}

function useOpenClawLibraryPhase5(
  context: ReturnType<typeof useOpenClawLibraryPhase4>
) {
  const deleteFolderMutation = useMutation({
    mutationFn: async () => {
      if (
        !context.workspaceId ||
        !context.selectedNode ||
        context.selectedNode.kind !== "folder"
      ) {
        throw new Error("Select a folder")
      }
      const { root, folder } = context.selectedNode
      if (isHermesRoot(root)) {
        throw new Error("Hermes folder deletion is not available")
      }
      return root === "library"
        ? sdk.workspaces.libraryDeleteFolder(context.workspaceId, { folder })
        : sdk.workspaces.agentWorkspaceDeleteFolder(
            context.workspaceId,
            context.agentId!,
            {
              folder,
            }
          )
    },
    onSuccess: async () => {
      context.setConfirmDeleteTarget(null)
      if (context.selectedNode?.kind === "folder") {
        const parent = parentLibraryFolderPath(context.selectedNode.folder)
        await context.loadFolder(context.selectedNode.root, parent)
        context.selectFolder(context.selectedNode.root, parent)
        const parentKey = folderKey(context.selectedNode.root, parent)
        context.setExpandedFolders((prev) => ({ ...prev, [parentKey]: true }))
      }
      toast.success("Folder deleted")
    },
    onError: (error: Error) => {
      context.setConfirmDeleteTarget(null)
      toast.error(formatWorkspaceTreeMutationError(error, "folder"))
    },
  })

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!context.workspaceId) return
    if (context.isReadOnlyRoot(context.selectedFolderContext.root)) {
      toast.error("This Hermes surface is read-only")
      return
    }

    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    try {
      const payloadFiles = await Promise.all(
        files.map(async (file) => ({
          filename: normalizeWorkspaceTextFilename(file.name),
          content: await readMarkdownFile(file),
        }))
      )

      const input = {
        folder: context.selectedFolderContext.folder,
        files: payloadFiles,
      }

      const result =
        context.selectedFolderContext.root === "library"
          ? await sdk.workspaces.libraryWriteFiles(context.workspaceId, input)
          : context.selectedFolderContext.root === "workspace"
            ? await sdk.workspaces.agentWorkspaceWriteFiles(
                context.workspaceId,
                context.agentId!,
                input
              )
            : await sdk.workspaces.hermesWorkspaceWriteFiles(
                context.workspaceId,
                {
                  agentId: context.agentId!,
                  folder: context.selectedFolderContext.root,
                  path: toHermesPath(context.selectedFolderContext.folder),
                  files: input.files.map((file) => ({
                    filename: file.filename,
                    content: file.content,
                    encoding: "utf8",
                  })),
                }
              )

      await context.loadFolder(
        context.selectedFolderContext.root,
        context.selectedFolderContext.folder
      )

      if (result.written.length === 1) {
        context.selectFile(
          context.selectedFolderContext.root,
          context.selectedFolderContext.folder,
          result.written[0]
        )
      }

      toast.success(
        result.written.length === 1
          ? `Uploaded ${result.written[0]}`
          : `Uploaded ${result.written.length} workspace text files`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      event.target.value = ""
    }
  }

  async function handlePngUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!context.workspaceId) return
    if (context.isReadOnlyRoot(context.selectedFolderContext.root)) {
      toast.error("This Hermes surface is read-only")
      return
    }

    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    try {
      const payloadFiles = await Promise.all(
        files.map(async (file) => ({
          filename: normalizePngFilename(file.name),
          content: await readPngFileAsBase64(file),
          contentEncoding: "base64" as const,
          contentType: file.type || "image/png",
        }))
      )

      const input = {
        folder: context.selectedFolderContext.folder,
        files: payloadFiles,
      }

      const result =
        context.selectedFolderContext.root === "library"
          ? await sdk.workspaces.libraryWriteFiles(context.workspaceId, input)
          : context.selectedFolderContext.root === "workspace"
            ? await sdk.workspaces.agentWorkspaceWriteFiles(
                context.workspaceId,
                context.agentId!,
                input
              )
            : await sdk.workspaces.hermesWorkspaceWriteFiles(
                context.workspaceId,
                {
                  agentId: context.agentId!,
                  folder: context.selectedFolderContext.root,
                  path: toHermesPath(context.selectedFolderContext.folder),
                  files: input.files.map((file) => ({
                    filename: file.filename,
                    content: file.content,
                    encoding: file.contentEncoding,
                  })),
                }
              )

      await context.loadFolder(
        context.selectedFolderContext.root,
        context.selectedFolderContext.folder
      )

      toast.success(
        result.written.length === 1
          ? `Uploaded ${result.written[0]}`
          : `Uploaded ${result.written.length} PNG files`
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to upload PNG files"
      )
    } finally {
      event.target.value = ""
    }
  }

  function saveBaseline() {
    const name = context.baselineDraftName.trim()
    const content = context.baselineDraftContent.trim()
    if (!name || !content) return
    let updated: CanonicalBaseline[]
    if (context.editingBaselineId) {
      updated = context.canonicalBaselines.map((b) =>
        b.id === context.editingBaselineId ? { ...b, name, content } : b
      )
    } else {
      updated = [
        ...context.canonicalBaselines,
        { id: crypto.randomUUID(), name, content },
      ]
    }
    context.setCanonicalBaselines(updated)
    saveBaselinesToStorage(updated)
    context.setBaselineDraftName("")
    context.setBaselineDraftContent("")
    context.setEditingBaselineId(null)
  }

  function startEditBaseline(baseline: CanonicalBaseline) {
    context.setEditingBaselineId(baseline.id)
    context.setBaselineDraftName(baseline.name)
    context.setBaselineDraftContent(baseline.content)
  }

  function cancelEditBaseline() {
    context.setEditingBaselineId(null)
    context.setBaselineDraftName("")
    context.setBaselineDraftContent("")
  }

  function deleteBaseline(id: string) {
    const updated = context.canonicalBaselines.filter((b) => b.id !== id)
    context.setCanonicalBaselines(updated)
    saveBaselinesToStorage(updated)
    if (context.selectedBaselineId === id) context.setSelectedBaselineId("")
    if (context.editingBaselineId === id) cancelEditBaseline()
  }

  function applyBaseline() {
    const baseline = context.canonicalBaselines.find(
      (b) => b.id === context.selectedBaselineId
    )
    if (!baseline) return
    context.setEditorContent(baseline.content)
    context.setEditorDirty(true)
  }

  function toggleFolder(root: WorkspaceTreeRoot, folder: string = "") {
    const normalizedFolder = normalizeLibraryFolderPath(folder)
    const key = folderKey(root, normalizedFolder)
    const nextExpanded = !context.expandedFolders[key]

    context.setExpandedFolders((current) => ({
      ...current,
      [key]: nextExpanded,
    }))

    if (
      nextExpanded &&
      !context.folderStates[key]?.data &&
      !context.folderStates[key]?.loading
    ) {
      void context.loadFolder(root, normalizedFolder)
    }
  }
  return {
    ...context,
    deleteFolderMutation,
    handleUpload,
    handlePngUpload,
    saveBaseline,
    startEditBaseline,
    cancelEditBaseline,
    deleteBaseline,
    applyBaseline,
    toggleFolder,
  }
}

export function useOpenClawLibraryPhase6(
  context: ReturnType<typeof useOpenClawLibraryPhase5>
) {
  function renderTreeBranch(
    root: WorkspaceTreeRoot,
    folder: string,
    depth: number
  ): ReactNode {
    const key = folderKey(root, folder)
    const state = context.folderStates[key]
    const data = state?.data

    if (state?.loading && !data) {
      return (
        <div
          className={`px-3 py-1.5 text-xs ${
            state.bridgeReconnecting ? "text-amber-200/80" : "text-zinc-500"
          }`}
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
        >
          {state.error ?? "Loading..."}
        </div>
      )
    }

    if (state?.error && !data) {
      return (
        <div
          className="space-y-2 px-3 py-1.5 text-xs text-rose-300/80"
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
        >
          <div>{state.error}</div>
          {isBridgeControlUnavailableMessage(state.error) ||
          state.error.includes("bridge control client") ? (
            <Button
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => void context.loadFolder(root, folder)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCcw className="size-3" />
              Retry
            </Button>
          ) : null}
        </div>
      )
    }

    if (!data) {
      return null
    }

    const visibleFolders = data.folders.filter((entry) =>
      context.isVisibleTreeFolder(entry.name)
    )
    const visibleFiles = data.files.filter((entry) =>
      context.isVisibleTreeFile(entry.filename)
    )

    const folderNodes = visibleFolders.map((entry) => {
      const childKey = folderKey(root, entry.path)
      const isExpanded = Boolean(context.expandedFolders[childKey])
      const isSelected =
        context.selectedNode?.kind === "folder" &&
        context.selectedNode.root === root &&
        context.selectedNode.folder === entry.path

      return (
        <div key={childKey}>
          <button
            className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition ${
              isSelected
                ? "bg-primary/12 text-zinc-100"
                : "text-zinc-300 hover:bg-[var(--claw-bg-surface)] hover:text-zinc-100"
            }`}
            onClick={() => {
              context.selectFolder(root, entry.path)
              context.toggleFolder(root, entry.path)
            }}
            style={{ paddingLeft: `${depth * 14 + 12}px` }}
            type="button"
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
            )}
            <Folder className="size-4 shrink-0 text-zinc-400" />
            <span className="truncate">{entry.name}</span>
          </button>
          {isExpanded ? renderTreeBranch(root, entry.path, depth + 1) : null}
        </div>
      )
    })

    const fileNodes = visibleFiles.map((entry) => {
      const isEditableTextFile = isEditableTextTreeFile(entry.filename)
      const isPngFile = isPngTreeFile(entry.filename)
      const isSelected =
        isEditableTextFile &&
        context.selectedFile?.root === root &&
        context.selectedFile?.folder === data.folder &&
        context.selectedFile?.filename === entry.filename

      return (
        <button
          key={`${root}:${entry.path}`}
          className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition ${
            isSelected
              ? "bg-primary/12 text-zinc-100"
              : isEditableTextFile
                ? "text-zinc-300 hover:bg-[var(--claw-bg-surface)] hover:text-zinc-100"
                : "cursor-default text-zinc-400"
          }`}
          onClick={() => {
            if (isEditableTextFile) {
              context.selectFile(root, data.folder, entry.filename)
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 30}px` }}
          type="button"
        >
          {isPngFile ? (
            <ImageIcon className="size-4 shrink-0 text-zinc-500" />
          ) : (
            <FileText className="size-4 shrink-0 text-zinc-500" />
          )}
          <span className="truncate">{entry.filename}</span>
          {entry.syncState ? (
            <span
              className={`claw-badge-text ml-auto rounded-[4px] border px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase ${
                entry.syncState === "applied"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                  : entry.syncState === "conflict" ||
                      entry.syncState === "failed"
                    ? "border-red-400/30 bg-red-500/10 text-red-300"
                    : entry.syncState === "offline"
                      ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
                      : "border-blue-400/30 bg-blue-500/10 text-blue-300"
              }`}
              title={`Desired revision ${entry.desiredVersion ?? "unknown"}; applied revision ${entry.appliedVersion ?? "unknown"}`}
            >
              {entry.syncState}
            </span>
          ) : null}
          {isPngFile ? (
            <span className="claw-badge-text rounded-[4px] border border-white/10 px-1.5 py-0.5 font-semibold tracking-[0.14em] text-zinc-500 uppercase">
              PNG
            </span>
          ) : null}
        </button>
      )
    })

    if (!folderNodes.length && !fileNodes.length) {
      return (
        <div
          className="px-3 py-1.5 text-xs text-zinc-500"
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
        >
          Empty
        </div>
      )
    }

    return (
      <>
        {folderNodes}
        {fileNodes}
      </>
    )
  }

  const activeKnowledgeItem =
    context.knowledgeItems.find(
      (item) =>
        item.kind === "file" &&
        context.selectedFile?.root === item.root &&
        context.selectedFile.folder === item.folder &&
        context.selectedFile.filename === item.filename
    ) ??
    context.knowledgeItems.find(
      (item) =>
        item.kind === "folder" &&
        context.selectedNode?.root === item.root &&
        ((context.selectedNode.kind === "folder" &&
          context.selectedNode.folder === item.folder) ||
          (context.selectedNode.kind === "file" &&
            (context.selectedNode.folder === item.folder ||
              context.selectedNode.folder.startsWith(`${item.folder}/`))))
    )
  const dropdownKnowledgeItems = activeKnowledgeItem
    ? context.knowledgeItems.filter(
        (item) => item.id !== activeKnowledgeItem.id
      )
    : context.knowledgeItems

  function startKnowledgeMarkdown() {
    const defaults = {
      instructions: {
        filename: "new-instructions.md",
        content: "# New Instructions\n",
      },
      library: { filename: "new-document.md", content: "# New Document\n" },
      memory: { filename: "MEMORY.md", content: "# Memory\n" },
      skills: {
        filename: "new-skill.md",
        content: "# New Skill Document\n",
      },
    }[context.knowledgeSection ?? "instructions"]
    const targetRoot: WorkspaceTreeRoot =
      context.knowledgeSection === "library"
        ? "library"
        : context.isHermesWorkspace
          ? "agent"
          : "workspace"
    const targetFolder =
      context.knowledgeSection === "library"
        ? context.selectedFolderContext.root === "library"
          ? context.selectedFolderContext.folder
          : ""
        : context.knowledgeSection === "memory"
          ? context.isHermesWorkspace
            ? "memories"
            : "memory"
          : context.knowledgeSection === "skills"
            ? context.selectedFolderContext.root === targetRoot &&
              normalizeLibraryFolderPath(context.selectedFolderContext.folder)
                .toLowerCase()
                .split("/")
                .includes("skills")
              ? context.selectedFolderContext.folder
              : "skills"
            : ""
    context.selectFolder(targetRoot, targetFolder)
    context.setEditorFilename(defaults.filename)
    context.setEditorContent(defaults.content)
    context.setEditorDirty(true)
    context.setKnowledgeEditing(true)
    context.setKnowledgeFolderCreating(false)
    context.setShowBaselineManager(false)
  }

  function openKnowledgeItem(item: KnowledgeItem) {
    if (item.kind === "file") {
      context.selectFile(item.root, item.folder, item.filename)
      return
    }
    const folderData =
      context.folderStates[folderKey(item.root, item.folder)]?.data
    const preferredFile =
      context.knowledgeSection === "skills"
        ? folderData?.files.find(
            (file) => file.filename.toLowerCase() === "skill.md"
          )
        : folderData?.files.find((file) =>
            isEditableTextTreeFile(file.filename)
          )
    if (preferredFile) {
      context.selectFile(item.root, item.folder, preferredFile.filename)
    } else {
      context.selectFolder(item.root, item.folder)
    }
  }
  return {
    ...context,
    renderTreeBranch,
    activeKnowledgeItem,
    dropdownKnowledgeItems,
    startKnowledgeMarkdown,
    openKnowledgeItem,
  }
}

function useOpenClawLibraryController(props: OpenClawLibraryCardProps) {
  const initial = { ...props, libraryOnly: props.libraryOnly ?? false }
  const phase1 = useOpenClawLibraryPhase1(initial)
  const phase2 = useOpenClawLibraryPhase2(phase1)
  const phase3 = useOpenClawLibraryPhase3(phase2)
  const phase4 = useOpenClawLibraryPhase4(phase3)
  const phase5 = useOpenClawLibraryPhase5(phase4)
  const phase6 = useOpenClawLibraryPhase6(phase5)
  return useOpenClawLibraryPhase7(phase6)
}

export type OpenClawLibraryController = ReturnType<
  typeof useOpenClawLibraryController
>

export function OpenClawLibraryCard(props: OpenClawLibraryCardProps) {
  const controller = useOpenClawLibraryController(props)
  if (!controller.isOpen) return null
  return controller.knowledgeSection ? (
    <OpenClawKnowledgeView controller={controller} />
  ) : (
    <OpenClawWorkspaceView controller={controller} />
  )
}
