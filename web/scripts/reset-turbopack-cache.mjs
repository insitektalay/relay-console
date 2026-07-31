#!/usr/bin/env node

import { lstat, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const TURBOPACK_CACHE_RELATIVE_PATH = path.join(
  ".next",
  "dev",
  "cache",
  "turbopack"
)

export function resolveTurbopackCachePath(projectRoot = process.cwd()) {
  const resolvedRoot = path.resolve(projectRoot)
  const cachePath = path.resolve(resolvedRoot, TURBOPACK_CACHE_RELATIVE_PATH)
  const expectedPath = path.join(resolvedRoot, TURBOPACK_CACHE_RELATIVE_PATH)

  if (cachePath !== expectedPath || !cachePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to reset unexpected cache path: ${cachePath}`)
  }

  return cachePath
}

export async function resetTurbopackCache(projectRoot = process.cwd()) {
  const cachePath = resolveTurbopackCachePath(projectRoot)

  try {
    const cacheStats = await lstat(cachePath)
    if (!cacheStats.isDirectory()) {
      throw new Error(`Refusing to reset non-directory cache path: ${cachePath}`)
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { cachePath, removed: false }
    }
    throw error
  }

  await rm(cachePath, { recursive: true })
  return { cachePath, removed: true }
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  const result = await resetTurbopackCache()
  console.log(
    result.removed
      ? `Removed Turbopack development cache: ${result.cachePath}`
      : `No Turbopack development cache found at: ${result.cachePath}`
  )
}
