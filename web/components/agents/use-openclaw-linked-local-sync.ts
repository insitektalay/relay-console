"use client"

import { useMemo, useState } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  chunkLinkedLocalSyncFiles,
  ensureLinkedLocalHandlePermission,
  loadLinkedLocalSyncMetadataMap,
  pickLinkedLocalDirectory,
  pickLinkedLocalMarkdownFile,
  readLinkedLocalHandle,
  type LinkedLocalSyncMetadata,
  writeLinkedLocalHandle,
} from "@/lib/linked-local-sync"
import { sdk } from "@/lib/sdk"
import {
  buildLinkedLocalFileMappingKey,
  buildLinkedLocalFolderMappingKey,
  hasLinkedLocalHandleAccess,
  isLinkedLocalSyncAbortError,
  joinLibraryFolderPath,
  normalizeLibraryFolderPath,
  normalizeWorkspaceTextFilename,
  readMarkdownFile,
} from "@/components/agents/openclaw-library-paths"

export type WorkspaceTreeRoot =
  | "library"
  | "workspace"
  | "agent"
  | "shared"
  | "sessions"
  | "project"

type HermesWritableRoot = "agent" | "shared" | "project"
type LinkedLocalFolderRoot = "library" | HermesWritableRoot

export type LinkedLocalFolderTarget =
  | { root: "library"; folder: string }
  | {
      root: HermesWritableRoot
      agentId?: string
      folder: string
    }

export type LinkedLocalFileTarget =
  | {
      root: "library"
      folder: string
      filename: string
    }
  | {
      root: "workspace"
      agentId: string
      folder: string
      filename: string
    }
  | {
      root: HermesWritableRoot
      agentId: string
      folder: string
      filename: string
    }

export type LinkedLocalHandleState = {
  key: string | null
  loading: boolean
  handle: FileSystemHandle | null
  missing: boolean
  permission: PermissionState | "unsupported" | "unknown"
}

export type DirectoryHandleWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterable<[string, FileSystemHandle]>
}

export type LinkedLocalLinkDialogState =
  | {
      kind: "folder"
      root: "library" | HermesWritableRoot
      agentId?: string
      folder: string
      syncAfterPick: boolean
      syncDirection?: "from-local" | "to-local"
      locationLabel: string
    }
  | {
      kind: "file"
      root: "library"
      folder: string
      filename: string
      syncAfterPick: boolean
      locationLabel: string
    }
  | {
      kind: "file"
      root: "workspace" | HermesWritableRoot
      agentId: string
      folder: string
      filename: string
      syncAfterPick: boolean
      locationLabel: string
    }
  | null

export const LINKED_LOCAL_SYNC_UNSUPPORTED_MESSAGE =
  "Linked local sync currently requires a supported desktop Chromium-based browser with File System Access support."

export const LINKED_LOCAL_SYNC_TIMEOUT_MS = 60_000

export async function withMutationTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error(message)),
      timeoutMs
    )

    void promise.then(
      (value) => {
        window.clearTimeout(timeout)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timeout)
        reject(error)
      }
    )
  })
}

type LinkedLocalSyncOperationsContext = {
  agentId?: string | null
  formatFileLocation: (
    root: WorkspaceTreeRoot,
    folder: string,
    filename: string
  ) => string
  formatLocationLabel: (root: WorkspaceTreeRoot, folder: string) => string
  isEditableTextTreeFile: (filename: string) => boolean
  linkedLocalBrowserSupport: { folder: boolean; file: boolean }
  linkedLocalHandleState: LinkedLocalHandleState
  linkedLocalLinkDialog: LinkedLocalLinkDialogState
  linkedLocalSyncMetadataMap: Record<string, LinkedLocalSyncMetadata>
  loadFolder: (
    root: WorkspaceTreeRoot,
    folder?: string,
    retryAttempt?: number
  ) => Promise<void>
  queryClient: QueryClient
  selectedFile: {
    root: WorkspaceTreeRoot
    folder: string
    filename: string
  } | null
  selectedLinkedLocalFile: LinkedLocalFileTarget | null
  selectedLinkedLocalFolder: LinkedLocalFolderTarget | null
  selectedLinkedLocalKey: string | null
  selectedLinkedLocalMeta: LinkedLocalSyncMetadata | null
  setEditorContent: (value: string) => void
  setEditorDirty: (value: boolean) => void
  setEditorFilename: (value: string) => void
  setLinkedLocalHandleRevision: React.Dispatch<React.SetStateAction<number>>
  setLinkedLocalLinkDialog: React.Dispatch<
    React.SetStateAction<LinkedLocalLinkDialogState>
  >
  setLinkedLocalSyncMetadataMap: React.Dispatch<
    React.SetStateAction<Record<string, LinkedLocalSyncMetadata>>
  >
  setLinkingTargetKey: React.Dispatch<React.SetStateAction<string | null>>
  setSyncingTargetKey: React.Dispatch<React.SetStateAction<string | null>>
  toHermesPath: (folder: string) => string
  workspaceId?: string | null
}

class OpenClawLinkedLocalSyncOperations {
  constructor(private readonly context: LinkedLocalSyncOperationsContext) {}

  updateLinkedLocalSyncMetadata(
    key: string,
    updater: (
      current: LinkedLocalSyncMetadata | null
    ) => LinkedLocalSyncMetadata | null
  ) {
    this.context.setLinkedLocalSyncMetadataMap((current) => {
      const next = updater(current[key] ?? null)

      if (!next) {
        if (!(key in current)) {
          return current
        }

        const updated = { ...current }
        delete updated[key]
        return updated
      }

      return {
        ...current,
        [key]: next,
      }
    })
  }

  setLinkedLocalSyncLink(key: string, kind: "folder" | "file", label: string) {
    this.updateLinkedLocalSyncMetadata(key, () => ({
      key,
      kind,
      label,
      lastSyncedAt: null,
      lastSyncStatus: null,
      lastSyncSummary: null,
    }))
  }

  setLinkedLocalSyncResult(
    key: string,
    kind: "folder" | "file",
    label: string,
    input: {
      lastSyncedAt?: string | null
      lastSyncStatus?: LinkedLocalSyncMetadata["lastSyncStatus"]
      lastSyncSummary?: string | null
    }
  ) {
    this.updateLinkedLocalSyncMetadata(key, (current) => ({
      key,
      kind,
      label,
      lastSyncedAt:
        input.lastSyncedAt !== undefined
          ? input.lastSyncedAt
          : (current?.lastSyncedAt ?? null),
      lastSyncStatus:
        input.lastSyncStatus !== undefined
          ? input.lastSyncStatus
          : (current?.lastSyncStatus ?? null),
      lastSyncSummary:
        input.lastSyncSummary !== undefined
          ? input.lastSyncSummary
          : (current?.lastSyncSummary ?? null),
    }))
  }

  bumpLinkedLocalHandleRevision() {
    this.context.setLinkedLocalHandleRevision((current) => current + 1)
  }

  getSelectedFileQueryKeyForTarget(target: {
    root: WorkspaceTreeRoot
    folder: string
    filename: string
  }) {
    return [
      "openclaw-tree-file",
      this.context.workspaceId,
      this.context.agentId,
      target.root,
      target.folder,
      target.filename,
    ] as const
  }

  async resolveLinkedLocalFolderHandle(
    key: string,
    providedHandle?: FileSystemDirectoryHandle
  ): Promise<FileSystemDirectoryHandle> {
    const handle = providedHandle ?? (await readLinkedLocalHandle(key))

    if (!handle || handle.kind !== "directory") {
      throw new Error(
        "The linked local folder is no longer available. Choose linked folder again."
      )
    }

    return handle as FileSystemDirectoryHandle
  }

  async resolveLinkedLocalFileHandle(
    key: string,
    providedHandle?: FileSystemFileHandle
  ): Promise<FileSystemFileHandle> {
    const handle = providedHandle ?? (await readLinkedLocalHandle(key))

    if (!handle || handle.kind !== "file") {
      throw new Error(
        "The linked local file is no longer available. Choose linked file again."
      )
    }

    return handle as FileSystemFileHandle
  }

  async collectLinkedLocalFolderFiles(handle: FileSystemDirectoryHandle) {
    const localFiles: Array<{
      sourceName: string
      relativeFolder: string
      normalizedFilename: string
      handle: FileSystemFileHandle
    }> = []

    const walk = async (
      directory: FileSystemDirectoryHandle,
      relativeFolder: string = ""
    ) => {
      for await (const [entryName, entryHandle] of (
        directory as DirectoryHandleWithEntries
      ).entries()) {
        if (entryName.startsWith(".")) {
          continue
        }

        if (entryHandle.kind === "directory") {
          await walk(
            entryHandle as FileSystemDirectoryHandle,
            joinLibraryFolderPath(relativeFolder, entryName)
          )
          continue
        }

        if (
          entryHandle.kind !== "file" ||
          !this.context.isEditableTextTreeFile(entryName)
        ) {
          continue
        }

        localFiles.push({
          sourceName: relativeFolder
            ? `${relativeFolder}/${entryName}`
            : entryName,
          relativeFolder,
          normalizedFilename: normalizeWorkspaceTextFilename(entryName),
          handle: entryHandle as FileSystemFileHandle,
        })
      }
    }

    await walk(handle)

    const duplicates = Array.from(
      localFiles.reduce<Map<string, string[]>>((current, file) => {
        const duplicateKey = joinLibraryFolderPath(
          file.relativeFolder,
          file.normalizedFilename
        ).toLowerCase()
        const existing = current.get(duplicateKey) ?? []
        existing.push(file.sourceName)
        current.set(duplicateKey, existing)
        return current
      }, new Map())
    ).filter((entry) => entry[1].length > 1)

    if (duplicates.length) {
      throw new Error("Duplicate filenames after normalization; sync aborted")
    }

    return await Promise.all(
      localFiles.map(async (entry) => {
        const file = await entry.handle.getFile()
        return {
          folder: normalizeLibraryFolderPath(entry.relativeFolder),
          filename: entry.normalizedFilename,
          content: await readMarkdownFile(file),
        }
      })
    )
  }

  async collectWorkspaceTreeFolderFiles(target: {
    root: WorkspaceTreeRoot
    folder: string
  }) {
    if (!this.context.workspaceId) {
      throw new Error("Select a workspace first")
    }

    const normalizedFolder = normalizeLibraryFolderPath(target.folder)
    const files: Array<{
      folder: string
      filename: string
      content: string
    }> = []

    const walk = async (folder: string, relativeFolder: string = "") => {
      const list = await this.listWorkspaceTreeFolder(target.root, folder)
      const visibleFiles = list.files.filter((entry) =>
        this.context.isEditableTextTreeFile(entry.filename)
      )
      const duplicateNames = Array.from(
        visibleFiles.reduce<Map<string, string[]>>((current, file) => {
          const duplicateKey = normalizeWorkspaceTextFilename(
            file.filename
          ).toLowerCase()
          const existing = current.get(duplicateKey) ?? []
          existing.push(file.filename)
          current.set(duplicateKey, existing)
          return current
        }, new Map())
      ).filter((entry) => entry[1].length > 1)

      if (duplicateNames.length) {
        throw new Error("Duplicate filenames after normalization; sync aborted")
      }

      const folderFiles = await Promise.all(
        visibleFiles.map(async (entry) => {
          const file = await this.readWorkspaceTreeFile({
            root: target.root,
            folder,
            filename: entry.filename,
          })

          return {
            folder: relativeFolder,
            filename: normalizeWorkspaceTextFilename(file.filename),
            content: file.content,
          }
        })
      )

      files.push(...folderFiles)

      for (const childFolder of list.folders) {
        await walk(
          normalizeLibraryFolderPath(childFolder.path),
          joinLibraryFolderPath(relativeFolder, childFolder.name)
        )
      }
    }

    await walk(normalizedFolder)

    return files
  }

  async writeFilesToLinkedLocalFolder(
    handle: FileSystemDirectoryHandle,
    files: Array<{ folder: string; filename: string; content: string }>
  ) {
    async function ensureDirectory(
      directory: FileSystemDirectoryHandle,
      folder: string
    ) {
      const parts = normalizeLibraryFolderPath(folder)
        .split("/")
        .filter(Boolean)
      let currentDirectory = directory

      for (const part of parts) {
        currentDirectory = await currentDirectory.getDirectoryHandle(part, {
          create: true,
        })
      }

      return currentDirectory
    }

    for (const file of files) {
      const parentDirectory = await ensureDirectory(handle, file.folder)
      const fileHandle = await parentDirectory.getFileHandle(file.filename, {
        create: true,
      })
      const writable = await fileHandle.createWritable()

      try {
        await writable.write(file.content)
      } finally {
        await writable.close()
      }
    }
  }

  async writeContentToLinkedLocalFile(
    handle: FileSystemFileHandle,
    content: string
  ) {
    const writable = await handle.createWritable()

    try {
      await writable.write(content)
    } finally {
      await writable.close()
    }
  }

  async readWorkspaceTreeFile(target: {
    root: WorkspaceTreeRoot
    folder: string
    filename: string
  }) {
    if (!this.context.workspaceId) {
      throw new Error("Select a workspace first")
    }

    if (target.root === "library") {
      return sdk.workspaces.libraryReadFile(
        this.context.workspaceId,
        target.folder,
        target.filename
      )
    }

    if (target.root === "workspace") {
      return sdk.workspaces.agentWorkspaceReadFile(
        this.context.workspaceId,
        this.context.agentId!,
        target.folder,
        target.filename
      )
    }

    return sdk.workspaces.hermesWorkspaceReadFile(
      this.context.workspaceId,
      this.context.agentId!,
      target.root,
      this.context.toHermesPath(target.folder),
      target.filename
    )
  }

  async listWorkspaceTreeFolder(root: WorkspaceTreeRoot, folder: string) {
    if (!this.context.workspaceId) {
      throw new Error("Select a workspace first")
    }

    if (root === "library") {
      return sdk.workspaces.libraryList(this.context.workspaceId, folder)
    }

    if (root === "workspace") {
      return sdk.workspaces.agentWorkspaceList(
        this.context.workspaceId,
        this.context.agentId!,
        folder
      )
    }

    return sdk.workspaces.hermesWorkspaceList(
      this.context.workspaceId,
      this.context.agentId!,
      root,
      this.context.toHermesPath(folder)
    )
  }

  async writeWorkspaceTreeFiles(
    root: WorkspaceTreeRoot,
    folder: string,
    files: Array<{ filename: string; content: string }>
  ) {
    if (!this.context.workspaceId) {
      throw new Error("Select a workspace first")
    }

    if (root === "library") {
      return sdk.workspaces.libraryWriteFiles(this.context.workspaceId, {
        folder,
        files,
      })
    }

    if (root === "workspace") {
      return sdk.workspaces.agentWorkspaceWriteFiles(
        this.context.workspaceId,
        this.context.agentId!,
        {
          folder,
          files,
        }
      )
    }

    return sdk.workspaces.hermesWorkspaceWriteFiles(this.context.workspaceId, {
      agentId: this.context.agentId!,
      folder: root,
      path: this.context.toHermesPath(folder),
      files: files.map((file) => ({
        filename: file.filename,
        content: file.content,
        encoding: "utf8",
      })),
    })
  }

  async createWorkspaceTreeFolder(root: WorkspaceTreeRoot, folder: string) {
    if (!this.context.workspaceId) {
      throw new Error("Select a workspace first")
    }

    const normalizedFolder = normalizeLibraryFolderPath(folder)
    if (!normalizedFolder) return

    if (root === "library") {
      await sdk.workspaces.libraryCreateFolder(
        this.context.workspaceId,
        normalizedFolder
      )
      return
    }

    if (root === "workspace") {
      await sdk.workspaces.agentWorkspaceCreateFolder(
        this.context.workspaceId,
        this.context.agentId!,
        normalizedFolder
      )
      return
    }

    const parts = normalizedFolder.split("/")
    for (let index = 0; index < parts.length; index += 1) {
      const filename = parts[index]
      const parent = parts.slice(0, index)
      await sdk.workspaces
        .hermesWorkspaceCreateFolder(this.context.workspaceId, {
          agentId: this.context.agentId!,
          folder: root,
          path: parent.length ? `/${parent.join("/")}` : "/",
          filename,
        })
        .catch(() => {})
    }
  }

  async runLinkedLocalFolderSync(
    target: { root: LinkedLocalFolderRoot; folder: string },
    options?: {
      key?: string
      label?: string
      handle?: FileSystemDirectoryHandle
    }
  ) {
    if (!this.context.workspaceId) {
      toast.error("Select a workspace first")
      return
    }

    if (!this.context.linkedLocalBrowserSupport.folder) {
      toast.error(LINKED_LOCAL_SYNC_UNSUPPORTED_MESSAGE)
      return
    }

    const key =
      options?.key ??
      buildLinkedLocalFolderMappingKey(this.context.workspaceId, target)
    const label =
      options?.label ??
      this.context.linkedLocalSyncMetadataMap[key]?.label ??
      "local folder"

    this.context.setSyncingTargetKey(key)

    try {
      const handle = await this.resolveLinkedLocalFolderHandle(
        key,
        options?.handle
      )
      const permission = await ensureLinkedLocalHandlePermission(handle)

      if (!hasLinkedLocalHandleAccess(permission)) {
        const summary = "Permission required to access linked folder"
        this.setLinkedLocalSyncResult(key, "folder", label, {
          lastSyncStatus: "permission-needed",
          lastSyncSummary: summary,
        })
        toast.error(summary)
        return
      }

      const files = await this.collectLinkedLocalFolderFiles(handle)

      if (!files.length) {
        const syncedAt = new Date().toISOString()
        this.setLinkedLocalSyncResult(key, "folder", label, {
          lastSyncedAt: syncedAt,
          lastSyncStatus: null,
          lastSyncSummary: "No workspace text files found in linked folder",
        })
        toast("No workspace text files found in linked folder")
        return
      }

      let syncedFileCount = 0
      const filesByFolder = files.reduce<
        Record<string, Array<{ filename: string; content: string }>>
      >((current, file) => {
        const folder = normalizeLibraryFolderPath(
          joinLibraryFolderPath(target.folder, file.folder)
        )
        current[folder] = current[folder] ?? []
        current[folder].push({
          filename: file.filename,
          content: file.content,
        })
        return current
      }, {})

      for (const [folder, folderFiles] of Object.entries(filesByFolder)) {
        await this.createWorkspaceTreeFolder(target.root, folder).catch(
          () => {}
        )
        const batches = chunkLinkedLocalSyncFiles(folderFiles, 100)
        for (const batch of batches) {
          try {
            await withMutationTimeout(
              this.writeWorkspaceTreeFiles(target.root, folder, batch),
              LINKED_LOCAL_SYNC_TIMEOUT_MS,
              `Timed out syncing ${this.context.formatLocationLabel(target.root, target.folder)}`
            )
            syncedFileCount += batch.length
          } catch (error) {
            const baseMessage =
              error instanceof Error
                ? error.message
                : "Unable to sync linked folder"
            throw new Error(
              syncedFileCount > 0
                ? `Batch upload failed after syncing ${syncedFileCount} of ${files.length} files. ${baseMessage}`
                : baseMessage
            )
          }
        }
      }

      await this.context.loadFolder(target.root, target.folder)

      const summary = `Synced ${files.length} workspace text ${files.length === 1 ? "file" : "files"} to ${this.context.formatLocationLabel(target.root, target.folder)}`
      const syncedAt = new Date().toISOString()

      this.setLinkedLocalSyncResult(key, "folder", label, {
        lastSyncedAt: syncedAt,
        lastSyncStatus: "success",
        lastSyncSummary: summary,
      })
      toast.success(summary)
    } catch (error) {
      const summary =
        error instanceof Error ? error.message : "Unable to sync linked folder"

      this.setLinkedLocalSyncResult(key, "folder", label, {
        lastSyncStatus: "failed",
        lastSyncSummary: summary,
      })
      toast.error(summary)
    } finally {
      this.context.setSyncingTargetKey((current) =>
        current === key ? null : current
      )
      this.bumpLinkedLocalHandleRevision()
    }
  }

  async runWorkspaceTreeFolderSyncToLinkedLocal(
    target: { root: LinkedLocalFolderRoot; folder: string },
    options?: {
      key?: string
      label?: string
      handle?: FileSystemDirectoryHandle
    }
  ) {
    if (!this.context.workspaceId) {
      toast.error("Select a workspace first")
      return
    }

    if (!this.context.linkedLocalBrowserSupport.folder) {
      toast.error(LINKED_LOCAL_SYNC_UNSUPPORTED_MESSAGE)
      return
    }

    const normalizedFolder = normalizeLibraryFolderPath(target.folder)
    const key =
      options?.key ??
      buildLinkedLocalFolderMappingKey(this.context.workspaceId, {
        root: target.root,
        folder: normalizedFolder,
      })
    const label =
      options?.label ??
      this.context.linkedLocalSyncMetadataMap[key]?.label ??
      "local folder"

    this.context.setSyncingTargetKey(key)

    try {
      const handle = await this.resolveLinkedLocalFolderHandle(
        key,
        options?.handle
      )
      const permission = await ensureLinkedLocalHandlePermission(
        handle,
        "readwrite"
      )

      if (!hasLinkedLocalHandleAccess(permission)) {
        const summary = "Permission required to write to linked folder"
        this.setLinkedLocalSyncResult(key, "folder", label, {
          lastSyncStatus: "permission-needed",
          lastSyncSummary: summary,
        })
        toast.error(summary)
        return
      }

      const files = await this.collectWorkspaceTreeFolderFiles({
        root: target.root,
        folder: normalizedFolder,
      })

      if (!files.length) {
        const syncedAt = new Date().toISOString()
        this.setLinkedLocalSyncResult(key, "folder", label, {
          lastSyncedAt: syncedAt,
          lastSyncStatus: null,
          lastSyncSummary: `No workspace text files found in ${this.context.formatLocationLabel(target.root, normalizedFolder)} or its subfolders`,
        })
        toast("No workspace text files found in this folder tree")
        return
      }

      await this.writeFilesToLinkedLocalFolder(handle, files)

      const summary = `Synced ${files.length} workspace text ${files.length === 1 ? "file" : "files"} from ${this.context.formatLocationLabel(target.root, normalizedFolder)} and its subfolders to linked local folder ${label}`
      const syncedAt = new Date().toISOString()

      this.setLinkedLocalSyncResult(key, "folder", label, {
        lastSyncedAt: syncedAt,
        lastSyncStatus: "success",
        lastSyncSummary: summary,
      })
      toast.success(summary)
    } catch (error) {
      const summary =
        error instanceof Error
          ? error.message
          : "Unable to sync workspace folder to linked local folder"

      this.setLinkedLocalSyncResult(key, "folder", label, {
        lastSyncStatus: "failed",
        lastSyncSummary: summary,
      })
      toast.error(summary)
    } finally {
      this.context.setSyncingTargetKey((current) =>
        current === key ? null : current
      )
      this.bumpLinkedLocalHandleRevision()
    }
  }

  async runLinkedLocalFileSync(
    target:
      | {
          root: "library"
          folder: string
          filename: string
        }
      | {
          root: "workspace"
          agentId: string
          folder: string
          filename: string
        }
      | {
          root: "agent" | "shared" | "project"
          agentId: string
          folder: string
          filename: string
        },
    options?: {
      key?: string
      label?: string
      handle?: FileSystemFileHandle
    }
  ) {
    if (!this.context.workspaceId) {
      toast.error("Select a workspace first")
      return
    }

    if (!this.context.linkedLocalBrowserSupport.file) {
      toast.error(LINKED_LOCAL_SYNC_UNSUPPORTED_MESSAGE)
      return
    }

    const normalizedFolder = normalizeLibraryFolderPath(target.folder)
    const normalizedFilename = normalizeWorkspaceTextFilename(target.filename)
    const key =
      options?.key ??
      buildLinkedLocalFileMappingKey(this.context.workspaceId, {
        ...target,
        folder: normalizedFolder,
        filename: normalizedFilename,
      })
    const label =
      options?.label ??
      this.context.linkedLocalSyncMetadataMap[key]?.label ??
      "local file"

    this.context.setSyncingTargetKey(key)

    try {
      const handle = await this.resolveLinkedLocalFileHandle(
        key,
        options?.handle
      )
      const permission = await ensureLinkedLocalHandlePermission(handle)

      if (!hasLinkedLocalHandleAccess(permission)) {
        const summary = "Permission required to access linked file"
        this.setLinkedLocalSyncResult(key, "file", label, {
          lastSyncStatus: "permission-needed",
          lastSyncSummary: summary,
        })
        toast.error(summary)
        return
      }

      const file = await handle.getFile()
      const content = await readMarkdownFile(file)

      await withMutationTimeout(
        target.root === "library"
          ? sdk.workspaces.libraryWriteFiles(this.context.workspaceId, {
              folder: normalizedFolder,
              files: [
                {
                  filename: normalizedFilename,
                  content,
                },
              ],
            })
          : target.root === "workspace"
            ? sdk.workspaces.agentWorkspaceWriteFiles(
                this.context.workspaceId,
                target.agentId,
                {
                  folder: normalizedFolder,
                  files: [
                    {
                      filename: normalizedFilename,
                      content,
                    },
                  ],
                }
              )
            : sdk.workspaces.hermesWorkspaceWriteFiles(
                this.context.workspaceId,
                {
                  agentId: target.agentId,
                  folder: target.root,
                  path: this.context.toHermesPath(normalizedFolder),
                  files: [
                    {
                      filename: normalizedFilename,
                      content,
                      encoding: "utf8",
                    },
                  ],
                }
              ),
        LINKED_LOCAL_SYNC_TIMEOUT_MS,
        `Timed out syncing ${this.context.formatFileLocation(target.root, normalizedFolder, normalizedFilename)}`
      )

      await this.context.loadFolder(target.root, normalizedFolder)
      this.context.queryClient.invalidateQueries({
        queryKey: this.getSelectedFileQueryKeyForTarget({
          root: target.root,
          folder: normalizedFolder,
          filename: normalizedFilename,
        }),
        exact: true,
      })

      if (
        this.context.selectedFile?.root === target.root &&
        this.context.selectedFile.folder === normalizedFolder &&
        normalizeWorkspaceTextFilename(this.context.selectedFile.filename) ===
          normalizedFilename
      ) {
        this.context.setEditorFilename(normalizedFilename)
        this.context.setEditorContent(content)
        this.context.setEditorDirty(false)
      }

      const summary = `Synced local file to ${this.context.formatFileLocation(target.root, normalizedFolder, normalizedFilename)}`
      const syncedAt = new Date().toISOString()

      this.setLinkedLocalSyncResult(key, "file", label, {
        lastSyncedAt: syncedAt,
        lastSyncStatus: "success",
        lastSyncSummary: summary,
      })
      toast.success(summary)
    } catch (error) {
      const summary =
        error instanceof Error ? error.message : "Unable to sync linked file"

      this.setLinkedLocalSyncResult(key, "file", label, {
        lastSyncStatus: "failed",
        lastSyncSummary: summary,
      })
      toast.error(summary)
    } finally {
      this.context.setSyncingTargetKey((current) =>
        current === key ? null : current
      )
      this.bumpLinkedLocalHandleRevision()
    }
  }

  async runWorkspaceTreeFileSyncToLinkedLocal(
    target:
      | {
          root: "library"
          folder: string
          filename: string
        }
      | {
          root: "workspace"
          agentId: string
          folder: string
          filename: string
        }
      | {
          root: "agent" | "shared" | "project"
          agentId: string
          folder: string
          filename: string
        },
    options?: {
      key?: string
      label?: string
      handle?: FileSystemFileHandle
    }
  ) {
    if (!this.context.workspaceId) {
      toast.error("Select a workspace first")
      return
    }

    if (!this.context.linkedLocalBrowserSupport.file) {
      toast.error(LINKED_LOCAL_SYNC_UNSUPPORTED_MESSAGE)
      return
    }

    const normalizedFolder = normalizeLibraryFolderPath(target.folder)
    const normalizedFilename = normalizeWorkspaceTextFilename(target.filename)
    const key =
      options?.key ??
      buildLinkedLocalFileMappingKey(this.context.workspaceId, {
        ...target,
        folder: normalizedFolder,
        filename: normalizedFilename,
      })
    const label =
      options?.label ??
      this.context.linkedLocalSyncMetadataMap[key]?.label ??
      "local file"

    this.context.setSyncingTargetKey(key)

    try {
      const handle = await this.resolveLinkedLocalFileHandle(
        key,
        options?.handle
      )
      const permission = await ensureLinkedLocalHandlePermission(
        handle,
        "readwrite"
      )

      if (!hasLinkedLocalHandleAccess(permission)) {
        const summary = "Permission required to write to linked file"
        this.setLinkedLocalSyncResult(key, "file", label, {
          lastSyncStatus: "permission-needed",
          lastSyncSummary: summary,
        })
        toast.error(summary)
        return
      }

      const file = await this.readWorkspaceTreeFile({
        root: target.root,
        folder: normalizedFolder,
        filename: normalizedFilename,
      })

      await this.writeContentToLinkedLocalFile(handle, file.content)

      const summary = `Synced ${this.context.formatFileLocation(target.root, normalizedFolder, normalizedFilename)} to linked local file ${label}`
      const syncedAt = new Date().toISOString()

      this.setLinkedLocalSyncResult(key, "file", label, {
        lastSyncedAt: syncedAt,
        lastSyncStatus: "success",
        lastSyncSummary: summary,
      })
      toast.success(summary)
    } catch (error) {
      const summary =
        error instanceof Error
          ? error.message
          : "Unable to sync workspace file to linked local file"

      this.setLinkedLocalSyncResult(key, "file", label, {
        lastSyncStatus: "failed",
        lastSyncSummary: summary,
      })
      toast.error(summary)
    } finally {
      this.context.setSyncingTargetKey((current) =>
        current === key ? null : current
      )
      this.bumpLinkedLocalHandleRevision()
    }
  }

  async performLinkLocalFolder(
    target: { root: LinkedLocalFolderRoot; folder: string },
    options?: {
      syncAfterPick?: boolean
      syncDirection?: "from-local" | "to-local"
    }
  ) {
    if (!this.context.workspaceId) {
      toast.error("Select a workspace first")
      return
    }

    if (!this.context.linkedLocalBrowserSupport.folder) {
      toast.error(LINKED_LOCAL_SYNC_UNSUPPORTED_MESSAGE)
      return
    }

    const normalizedFolder = normalizeLibraryFolderPath(target.folder)
    const key = buildLinkedLocalFolderMappingKey(this.context.workspaceId, {
      root: target.root,
      folder: normalizedFolder,
    })
    this.context.setLinkingTargetKey(key)

    try {
      const handle = await pickLinkedLocalDirectory(key)
      await writeLinkedLocalHandle(key, handle)
      this.setLinkedLocalSyncLink(key, "folder", handle.name)
      this.bumpLinkedLocalHandleRevision()

      if (options?.syncAfterPick) {
        this.context.setLinkingTargetKey(null)
        if (options.syncDirection === "to-local") {
          await this.runWorkspaceTreeFolderSyncToLinkedLocal(
            { root: target.root, folder: normalizedFolder },
            { key, label: handle.name, handle }
          )
        } else {
          await this.runLinkedLocalFolderSync(
            { root: target.root, folder: normalizedFolder },
            { key, label: handle.name, handle }
          )
        }
        return
      }

      toast.success(
        `Linked ${handle.name} to ${this.context.formatLocationLabel(target.root, normalizedFolder)}`
      )
    } catch (error) {
      if (!isLinkedLocalSyncAbortError(error)) {
        toast.error(
          error instanceof Error ? error.message : "Unable to link local folder"
        )
      }
    } finally {
      this.context.setLinkingTargetKey((current) =>
        current === key ? null : current
      )
    }
  }

  async performLinkLocalFile(
    target:
      | {
          root: "library"
          folder: string
          filename: string
        }
      | {
          root: "workspace"
          agentId: string
          folder: string
          filename: string
        }
      | {
          root: "agent" | "shared" | "project"
          agentId: string
          folder: string
          filename: string
        },
    options?: { syncAfterPick?: boolean }
  ) {
    if (!this.context.workspaceId) {
      toast.error("Select a workspace first")
      return
    }

    if (!this.context.linkedLocalBrowserSupport.file) {
      toast.error(LINKED_LOCAL_SYNC_UNSUPPORTED_MESSAGE)
      return
    }

    const normalizedFolder = normalizeLibraryFolderPath(target.folder)
    const normalizedFilename = normalizeWorkspaceTextFilename(target.filename)
    const normalizedTarget =
      target.root === "library"
        ? {
            root: "library" as const,
            folder: normalizedFolder,
            filename: normalizedFilename,
          }
        : target.root === "workspace"
          ? {
              root: "workspace" as const,
              agentId: target.agentId,
              folder: normalizedFolder,
              filename: normalizedFilename,
            }
          : {
              root: target.root,
              agentId: target.agentId,
              folder: normalizedFolder,
              filename: normalizedFilename,
            }
    const key = buildLinkedLocalFileMappingKey(
      this.context.workspaceId,
      normalizedTarget
    )

    this.context.setLinkingTargetKey(key)

    try {
      const handle = await pickLinkedLocalMarkdownFile(key)
      if (!handle) {
        return
      }

      await writeLinkedLocalHandle(key, handle)
      this.setLinkedLocalSyncLink(key, "file", handle.name)
      this.bumpLinkedLocalHandleRevision()

      if (options?.syncAfterPick) {
        this.context.setLinkingTargetKey(null)
        await this.runLinkedLocalFileSync(normalizedTarget, {
          key,
          label: handle.name,
          handle,
        })
        return
      }

      toast.success(
        `Linked ${handle.name} to ${this.context.formatFileLocation(target.root, normalizedFolder, normalizedFilename)}`
      )
    } catch (error) {
      if (!isLinkedLocalSyncAbortError(error)) {
        toast.error(
          error instanceof Error ? error.message : "Unable to link local file"
        )
      }
    } finally {
      this.context.setLinkingTargetKey((current) =>
        current === key ? null : current
      )
    }
  }

  async handleSelectedFolderSyncAction() {
    if (!this.context.selectedLinkedLocalFolder) {
      return
    }

    const hasResolvedMissingLinkedHandle =
      this.context.linkedLocalHandleState.key ===
        this.context.selectedLinkedLocalKey &&
      !this.context.linkedLocalHandleState.loading &&
      (this.context.linkedLocalHandleState.missing ||
        !this.context.linkedLocalHandleState.handle)

    if (
      !this.context.selectedLinkedLocalMeta ||
      hasResolvedMissingLinkedHandle
    ) {
      this.context.setLinkedLocalLinkDialog({
        kind: "folder",
        root: this.context.selectedLinkedLocalFolder.root,
        agentId:
          this.context.selectedLinkedLocalFolder.root === "library"
            ? undefined
            : this.context.selectedLinkedLocalFolder.agentId,
        folder: this.context.selectedLinkedLocalFolder.folder,
        syncAfterPick: true,
        syncDirection: "from-local",
        locationLabel: this.context.formatLocationLabel(
          this.context.selectedLinkedLocalFolder.root,
          this.context.selectedLinkedLocalFolder.folder
        ),
      })
      return
    }

    await this.runLinkedLocalFolderSync(this.context.selectedLinkedLocalFolder)
  }

  async handleSelectedFolderSyncToLocalAction() {
    if (!this.context.selectedLinkedLocalFolder) {
      return
    }

    const hasResolvedMissingLinkedHandle =
      this.context.linkedLocalHandleState.key ===
        this.context.selectedLinkedLocalKey &&
      !this.context.linkedLocalHandleState.loading &&
      (this.context.linkedLocalHandleState.missing ||
        !this.context.linkedLocalHandleState.handle)

    if (
      !this.context.selectedLinkedLocalMeta ||
      hasResolvedMissingLinkedHandle
    ) {
      this.context.setLinkedLocalLinkDialog({
        kind: "folder",
        root: this.context.selectedLinkedLocalFolder.root,
        agentId:
          this.context.selectedLinkedLocalFolder.root === "library"
            ? undefined
            : this.context.selectedLinkedLocalFolder.agentId,
        folder: this.context.selectedLinkedLocalFolder.folder,
        syncAfterPick: true,
        syncDirection: "to-local",
        locationLabel: this.context.formatLocationLabel(
          this.context.selectedLinkedLocalFolder.root,
          this.context.selectedLinkedLocalFolder.folder
        ),
      })
      return
    }

    await this.runWorkspaceTreeFolderSyncToLinkedLocal(
      this.context.selectedLinkedLocalFolder
    )
  }

  async handleSelectedFileSyncAction() {
    if (!this.context.selectedLinkedLocalFile) {
      return
    }

    const hasResolvedMissingLinkedHandle =
      this.context.linkedLocalHandleState.key ===
        this.context.selectedLinkedLocalKey &&
      !this.context.linkedLocalHandleState.loading &&
      (this.context.linkedLocalHandleState.missing ||
        !this.context.linkedLocalHandleState.handle)

    if (
      !this.context.selectedLinkedLocalMeta ||
      hasResolvedMissingLinkedHandle
    ) {
      if (this.context.selectedLinkedLocalFile.root === "library") {
        this.context.setLinkedLocalLinkDialog({
          kind: "file",
          root: "library",
          folder: this.context.selectedLinkedLocalFile.folder,
          filename: this.context.selectedLinkedLocalFile.filename,
          syncAfterPick: true,
          locationLabel: this.context.formatFileLocation(
            "library",
            this.context.selectedLinkedLocalFile.folder,
            this.context.selectedLinkedLocalFile.filename
          ),
        })
      } else {
        this.context.setLinkedLocalLinkDialog({
          kind: "file",
          root: this.context.selectedLinkedLocalFile.root,
          agentId: this.context.selectedLinkedLocalFile.agentId,
          folder: this.context.selectedLinkedLocalFile.folder,
          filename: this.context.selectedLinkedLocalFile.filename,
          syncAfterPick: true,
          locationLabel: this.context.formatFileLocation(
            this.context.selectedLinkedLocalFile.root,
            this.context.selectedLinkedLocalFile.folder,
            this.context.selectedLinkedLocalFile.filename
          ),
        })
      }
      return
    }

    await this.runLinkedLocalFileSync(this.context.selectedLinkedLocalFile)
  }

  async handleSelectedFileSyncToLocalAction() {
    if (!this.context.selectedLinkedLocalFile) {
      return
    }

    const hasResolvedMissingLinkedHandle =
      this.context.linkedLocalHandleState.key ===
        this.context.selectedLinkedLocalKey &&
      !this.context.linkedLocalHandleState.loading &&
      (this.context.linkedLocalHandleState.missing ||
        !this.context.linkedLocalHandleState.handle)

    if (
      !this.context.selectedLinkedLocalMeta ||
      hasResolvedMissingLinkedHandle
    ) {
      toast.error("Choose linked file before syncing this file to local")
      return
    }

    await this.runWorkspaceTreeFileSyncToLinkedLocal(
      this.context.selectedLinkedLocalFile
    )
  }

  async confirmLinkedLocalLinkDialog() {
    const dialog = this.context.linkedLocalLinkDialog
    if (!dialog) {
      return
    }

    this.context.setLinkedLocalLinkDialog(null)

    if (dialog.kind === "folder") {
      await this.performLinkLocalFolder(
        { root: dialog.root, folder: dialog.folder },
        {
          syncAfterPick: dialog.syncAfterPick,
          syncDirection: dialog.syncDirection,
        }
      )
      return
    }

    await this.performLinkLocalFile(
      dialog.root === "library"
        ? {
            root: "library",
            folder: dialog.folder,
            filename: dialog.filename,
          }
        : dialog.root === "workspace"
          ? {
              root: "workspace",
              agentId: dialog.agentId,
              folder: dialog.folder,
              filename: dialog.filename,
            }
          : {
              root: dialog.root,
              agentId: dialog.agentId,
              folder: dialog.folder,
              filename: dialog.filename,
            },
      { syncAfterPick: dialog.syncAfterPick }
    )
  }
}
export function useOpenClawLinkedLocalSyncController({
  agentId,
  formatFileLocation,
  formatLocationLabel,
  isEditableTextTreeFile,
  loadFolder,
  queryClient,
  selectedFile,
  selectedLibraryFile,
  selectedLibraryFolder,
  selectedHermesFile,
  selectedHermesFolder,
  selectedWorkspaceFile,
  setEditorContent,
  setEditorDirty,
  setEditorFilename,
  toHermesPath,
  workspaceId,
}: {
  agentId?: string | null
  formatFileLocation: (
    root: WorkspaceTreeRoot,
    folder: string,
    filename: string
  ) => string
  formatLocationLabel: (root: WorkspaceTreeRoot, folder: string) => string
  isEditableTextTreeFile: (filename: string) => boolean
  loadFolder: (
    root: WorkspaceTreeRoot,
    folder?: string,
    retryAttempt?: number
  ) => Promise<void>
  queryClient: QueryClient
  selectedFile: {
    root: WorkspaceTreeRoot
    folder: string
    filename: string
  } | null
  selectedLibraryFile: Extract<
    LinkedLocalFileTarget,
    { root: "library" }
  > | null
  selectedLibraryFolder: Extract<
    LinkedLocalFolderTarget,
    { root: "library" }
  > | null
  selectedHermesFile: Extract<
    LinkedLocalFileTarget,
    { root: HermesWritableRoot }
  > | null
  selectedHermesFolder: Extract<
    LinkedLocalFolderTarget,
    { root: HermesWritableRoot }
  > | null
  selectedWorkspaceFile: Extract<
    LinkedLocalFileTarget,
    { root: "workspace" }
  > | null
  setEditorContent: (value: string) => void
  setEditorDirty: (value: boolean) => void
  setEditorFilename: (value: string) => void
  toHermesPath: (folder: string) => string
  workspaceId?: string | null
}) {
  const [linkedLocalSyncMetadataMap, setLinkedLocalSyncMetadataMap] = useState<
    Record<string, LinkedLocalSyncMetadata>
  >(() => loadLinkedLocalSyncMetadataMap())
  const [linkedLocalBrowserSupport, setLinkedLocalBrowserSupport] = useState({
    folder: false,
    file: false,
  })
  const [linkedLocalHandleState, setLinkedLocalHandleState] =
    useState<LinkedLocalHandleState>({
      key: null,
      loading: false,
      handle: null,
      missing: false,
      permission: "unknown",
    })
  const [linkedLocalHandleRevision, setLinkedLocalHandleRevision] = useState(0)
  const [linkingTargetKey, setLinkingTargetKey] = useState<string | null>(null)
  const [syncingTargetKey, setSyncingTargetKey] = useState<string | null>(null)
  const [linkedLocalLinkDialog, setLinkedLocalLinkDialog] =
    useState<LinkedLocalLinkDialogState>(null)

  const selectedLinkedLocalFolder =
    selectedLibraryFolder ?? selectedHermesFolder
  const selectedLinkedLocalFile =
    selectedLibraryFile ?? selectedWorkspaceFile ?? selectedHermesFile
  const selectedLinkedLocalKey =
    workspaceId && selectedLinkedLocalFile
      ? buildLinkedLocalFileMappingKey(workspaceId, selectedLinkedLocalFile)
      : workspaceId && selectedLinkedLocalFolder
        ? buildLinkedLocalFolderMappingKey(
            workspaceId,
            selectedLinkedLocalFolder
          )
        : null
  const selectedLinkedLocalMeta = selectedLinkedLocalKey
    ? (linkedLocalSyncMetadataMap[selectedLinkedLocalKey] ?? null)
    : null
  const selectedLinkedLocalSupport = selectedLinkedLocalFile
    ? linkedLocalBrowserSupport.file
    : selectedLinkedLocalFolder
      ? linkedLocalBrowserSupport.folder
      : false
  const isLinkingSelectedTarget =
    Boolean(selectedLinkedLocalKey) &&
    linkingTargetKey === selectedLinkedLocalKey
  const isSyncingSelectedTarget =
    Boolean(selectedLinkedLocalKey) &&
    syncingTargetKey === selectedLinkedLocalKey

  const operations = new OpenClawLinkedLocalSyncOperations({
    agentId,
    formatFileLocation,
    formatLocationLabel,
    isEditableTextTreeFile,
    linkedLocalBrowserSupport,
    linkedLocalHandleState,
    linkedLocalLinkDialog,
    linkedLocalSyncMetadataMap,
    loadFolder,
    queryClient,
    selectedFile,
    selectedLinkedLocalFile,
    selectedLinkedLocalFolder,
    selectedLinkedLocalKey,
    selectedLinkedLocalMeta,
    setEditorContent,
    setEditorDirty,
    setEditorFilename,
    setLinkedLocalHandleRevision,
    setLinkedLocalLinkDialog,
    setLinkedLocalSyncMetadataMap,
    setLinkingTargetKey,
    setSyncingTargetKey,
    toHermesPath,
    workspaceId,
  })
  const confirmLinkedLocalLinkDialog =
    operations.confirmLinkedLocalLinkDialog.bind(operations)
  const handleSelectedFileSyncAction =
    operations.handleSelectedFileSyncAction.bind(operations)
  const handleSelectedFileSyncToLocalAction =
    operations.handleSelectedFileSyncToLocalAction.bind(operations)
  const handleSelectedFolderSyncAction =
    operations.handleSelectedFolderSyncAction.bind(operations)
  const handleSelectedFolderSyncToLocalAction =
    operations.handleSelectedFolderSyncToLocalAction.bind(operations)
  const performLinkLocalFile = operations.performLinkLocalFile.bind(operations)

  const selectedLinkedLocalStatus = useMemo(() => {
    if (!selectedLinkedLocalFolder && !selectedLinkedLocalFile) {
      return null
    }

    if (!selectedLinkedLocalSupport) {
      return {
        label: "Unsupported",
        badgeClassName:
          "border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/10",
        detail: LINKED_LOCAL_SYNC_UNSUPPORTED_MESSAGE,
      }
    }

    if (isLinkingSelectedTarget) {
      return {
        label: "Linking",
        badgeClassName:
          "border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/10",
        detail: selectedLinkedLocalFolder
          ? "Choosing a local folder for this library folder."
          : selectedLinkedLocalFile?.root === "workspace"
            ? "Choosing a local file for this workspace file."
            : "Choosing a local file for this library file.",
      }
    }

    if (isSyncingSelectedTarget) {
      return {
        label: "Syncing",
        badgeClassName:
          "border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/10",
        detail: selectedLinkedLocalFolder
          ? "Syncing this folder tree with the linked local folder."
          : selectedLinkedLocalFile?.root === "workspace"
            ? "Syncing this workspace file with the linked local file."
            : "Syncing this library file with the linked local file.",
      }
    }

    if (!selectedLinkedLocalMeta) {
      return {
        label: "Not linked",
        badgeClassName:
          "border-white/15 bg-white/[0.06] text-zinc-200 hover:bg-white/[0.06]",
        detail: selectedLinkedLocalFolder
          ? "Choose a local folder to enable manual sync for this folder tree."
          : selectedLinkedLocalFile?.root === "workspace"
            ? "Choose a local file to enable manual sync for this workspace file."
            : "Choose a local file to enable manual sync for this library file.",
      }
    }

    if (linkedLocalHandleState.loading) {
      return {
        label: "Linked",
        badgeClassName:
          "border-white/15 bg-white/[0.06] text-zinc-200 hover:bg-white/[0.06]",
        detail: "Checking access to the linked local target.",
      }
    }

    if (linkedLocalHandleState.missing || !linkedLocalHandleState.handle) {
      return {
        label: "Not linked",
        badgeClassName:
          "border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/10",
        detail: selectedLinkedLocalFolder
          ? "The saved linked local folder could not be found. Choose linked folder again."
          : selectedLinkedLocalFile?.root === "workspace"
            ? "The saved linked local file could not be found. Choose linked file again for this workspace file."
            : "The saved linked local file could not be found. Choose linked file again.",
      }
    }

    if (!hasLinkedLocalHandleAccess(linkedLocalHandleState.permission)) {
      return {
        label: "Permission needed",
        badgeClassName:
          "border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/10",
        detail: selectedLinkedLocalFolder
          ? "Permission required to access linked folder."
          : "Permission required to access linked file.",
      }
    }

    if (selectedLinkedLocalMeta.lastSyncStatus === "failed") {
      return {
        label: "Sync failed",
        badgeClassName:
          "border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/10",
        detail:
          selectedLinkedLocalMeta.lastSyncSummary ??
          "The last linked local sync failed.",
      }
    }

    if (selectedLinkedLocalMeta.lastSyncStatus === "permission-needed") {
      return {
        label: "Permission needed",
        badgeClassName:
          "border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/10",
        detail:
          selectedLinkedLocalMeta.lastSyncSummary ??
          (selectedLinkedLocalFolder
            ? "Permission required to access linked folder."
            : "Permission required to access linked file."),
      }
    }

    if (
      selectedLinkedLocalMeta.lastSyncStatus === "success" &&
      selectedLinkedLocalMeta.lastSyncedAt
    ) {
      return {
        label: "Last synced successfully",
        badgeClassName:
          "border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/10",
        detail:
          selectedLinkedLocalMeta.lastSyncSummary ??
          "The linked local target is ready to sync again.",
      }
    }

    return {
      label: "Ready",
      badgeClassName:
        "border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/10",
      detail: selectedLinkedLocalFolder
        ? "Ready to sync this folder tree with the linked local folder."
        : selectedLinkedLocalFile?.root === "workspace"
          ? "Ready to sync this workspace file with the linked local file."
          : "Ready to sync this library file with the linked local file.",
    }
  }, [
    isLinkingSelectedTarget,
    isSyncingSelectedTarget,
    linkedLocalHandleState.handle,
    linkedLocalHandleState.loading,
    linkedLocalHandleState.missing,
    linkedLocalHandleState.permission,
    selectedLinkedLocalFile,
    selectedLinkedLocalFolder,
    selectedLinkedLocalMeta,
    selectedLinkedLocalSupport,
  ])

  const selectedLinkedLocalSummary =
    selectedLinkedLocalMeta?.lastSyncSummary &&
    selectedLinkedLocalMeta.lastSyncSummary !==
      selectedLinkedLocalStatus?.detail
      ? selectedLinkedLocalMeta.lastSyncSummary
      : null

  return {
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
  }
}
