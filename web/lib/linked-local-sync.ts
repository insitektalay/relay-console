"use client"

export type LinkedLocalSyncTargetKind = "folder" | "file"
export type LinkedLocalSyncStoredStatus =
  | "success"
  | "failed"
  | "permission-needed"

export type LinkedLocalSyncMetadata = {
  key: string
  kind: LinkedLocalSyncTargetKind
  label: string
  lastSyncedAt?: string | null
  lastSyncStatus?: LinkedLocalSyncStoredStatus | null
  lastSyncSummary?: string | null
}

type StoredLinkedLocalSyncMetadataMap = Record<string, LinkedLocalSyncMetadata>
type LinkedLocalStartIn =
  | "desktop"
  | "documents"
  | "downloads"
  | "music"
  | "pictures"
  | "videos"
type LinkedLocalWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string
    mode?: "read" | "readwrite"
    startIn?: FileSystemHandle | LinkedLocalStartIn
  }) => Promise<FileSystemDirectoryHandle>
  showOpenFilePicker?: (options?: {
    id?: string
    excludeAcceptAllOption?: boolean
    multiple?: boolean
    startIn?: FileSystemHandle | LinkedLocalStartIn
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }) => Promise<FileSystemFileHandle[]>
}
type PermissionCapableHandle = FileSystemHandle & {
  queryPermission?: (descriptor?: {
    mode?: "read" | "readwrite"
  }) => Promise<PermissionState>
  requestPermission?: (descriptor?: {
    mode?: "read" | "readwrite"
  }) => Promise<PermissionState>
}

const LINKED_LOCAL_SYNC_METADATA_KEY = "clawchat:linked-local-sync-metadata"
const LINKED_LOCAL_SYNC_DB_NAME = "clawchat-linked-local-sync"
const LINKED_LOCAL_SYNC_STORE_NAME = "handles"

function buildLinkedLocalPickerId(key: string) {
  const normalized = key
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12)

  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  }

  const suffix = hash.toString(36).slice(0, 12)
  return `lls-${normalized || "target"}-${suffix}`.slice(0, 32)
}

function getLinkedLocalWindow() {
  return window as LinkedLocalWindow
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"))
  })
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"))
  })
}

async function openLinkedLocalSyncDb() {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("IndexedDB is unavailable in this browser")
  }

  const request = window.indexedDB.open(LINKED_LOCAL_SYNC_DB_NAME, 1)

  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(LINKED_LOCAL_SYNC_STORE_NAME)) {
      db.createObjectStore(LINKED_LOCAL_SYNC_STORE_NAME)
    }
  }

  return await requestToPromise(request)
}

export function isLinkedLocalFolderSyncSupported() {
  if (typeof window === "undefined") {
    return false
  }

  const linkedWindow = getLinkedLocalWindow()
  return Boolean(
    window.indexedDB && typeof linkedWindow.showDirectoryPicker === "function"
  )
}

export function isLinkedLocalFileSyncSupported() {
  if (typeof window === "undefined") {
    return false
  }

  const linkedWindow = getLinkedLocalWindow()
  return Boolean(
    window.indexedDB && typeof linkedWindow.showOpenFilePicker === "function"
  )
}

export function loadLinkedLocalSyncMetadataMap(): StoredLinkedLocalSyncMetadataMap {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LINKED_LOCAL_SYNC_METADATA_KEY)
        : null

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, LinkedLocalSyncMetadata] => {
          const candidate = entry[1] as Partial<LinkedLocalSyncMetadata> | null

          return Boolean(
            candidate &&
            typeof candidate === "object" &&
            !Array.isArray(candidate) &&
            typeof candidate.key === "string" &&
            (candidate.kind === "folder" || candidate.kind === "file") &&
            typeof candidate.label === "string"
          )
        }
      )
    )
  } catch {
    return {}
  }
}

export function saveLinkedLocalSyncMetadataMap(
  value: StoredLinkedLocalSyncMetadataMap
) {
  if (typeof window === "undefined") {
    return
  }

  if (!Object.keys(value).length) {
    window.localStorage.removeItem(LINKED_LOCAL_SYNC_METADATA_KEY)
    return
  }

  window.localStorage.setItem(
    LINKED_LOCAL_SYNC_METADATA_KEY,
    JSON.stringify(value)
  )
}

export async function readLinkedLocalHandle(key: string) {
  const db = await openLinkedLocalSyncDb()

  try {
    const transaction = db.transaction(LINKED_LOCAL_SYNC_STORE_NAME, "readonly")
    const store = transaction.objectStore(LINKED_LOCAL_SYNC_STORE_NAME)
    const request = store.get(key) as IDBRequest<FileSystemHandle | undefined>
    const value = await requestToPromise(request)
    await transactionToPromise(transaction)
    return value ?? null
  } finally {
    db.close()
  }
}

export async function writeLinkedLocalHandle(
  key: string,
  handle: FileSystemDirectoryHandle | FileSystemFileHandle
) {
  const db = await openLinkedLocalSyncDb()

  try {
    const transaction = db.transaction(
      LINKED_LOCAL_SYNC_STORE_NAME,
      "readwrite"
    )
    const store = transaction.objectStore(LINKED_LOCAL_SYNC_STORE_NAME)
    store.put(handle, key)
    await transactionToPromise(transaction)
  } finally {
    db.close()
  }
}

export async function deleteLinkedLocalHandle(key: string) {
  const db = await openLinkedLocalSyncDb()

  try {
    const transaction = db.transaction(
      LINKED_LOCAL_SYNC_STORE_NAME,
      "readwrite"
    )
    const store = transaction.objectStore(LINKED_LOCAL_SYNC_STORE_NAME)
    store.delete(key)
    await transactionToPromise(transaction)
  } finally {
    db.close()
  }
}

export async function queryLinkedLocalHandlePermission(
  handle: FileSystemHandle,
  mode: "read" | "readwrite" = "read"
): Promise<PermissionState | "unsupported"> {
  const permissionHandle = handle as PermissionCapableHandle

  if (typeof permissionHandle.queryPermission !== "function") {
    return "unsupported"
  }

  return await permissionHandle.queryPermission({ mode })
}

export async function ensureLinkedLocalHandlePermission(
  handle: FileSystemHandle,
  mode: "read" | "readwrite" = "read"
): Promise<PermissionState | "unsupported"> {
  const current = await queryLinkedLocalHandlePermission(handle, mode)

  if (current === "granted" || current === "unsupported") {
    return current
  }

  const permissionHandle = handle as PermissionCapableHandle
  if (typeof permissionHandle.requestPermission !== "function") {
    return current
  }

  return await permissionHandle.requestPermission({ mode })
}

export async function pickLinkedLocalDirectory(key: string) {
  const linkedWindow = getLinkedLocalWindow()
  const pickerId = buildLinkedLocalPickerId(key)

  if (typeof linkedWindow.showDirectoryPicker !== "function") {
    throw new Error(
      "Linked local sync requires a supported desktop Chromium-based browser with File System Access support"
    )
  }

  return await linkedWindow.showDirectoryPicker({
    id: pickerId,
    mode: "readwrite",
    startIn: "documents",
  })
}

export async function pickLinkedLocalMarkdownFile(key: string) {
  const linkedWindow = getLinkedLocalWindow()
  const pickerId = buildLinkedLocalPickerId(key)

  if (typeof linkedWindow.showOpenFilePicker !== "function") {
    throw new Error(
      "Linked local sync requires a supported desktop Chromium-based browser with File System Access support"
    )
  }

  const handles = await linkedWindow.showOpenFilePicker({
    id: pickerId,
    multiple: false,
    startIn: "documents",
    types: [
      {
        description: "Workspace text files",
        accept: {
          "text/markdown": [".md"],
          "text/plain": [".md", ".env", ".envrc", ".local"],
        },
      },
    ],
  })

  return handles[0] ?? null
}

export function chunkLinkedLocalSyncFiles<T>(items: T[], chunkSize: number) {
  if (chunkSize <= 0) {
    throw new Error("Chunk size must be greater than zero")
  }

  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}
