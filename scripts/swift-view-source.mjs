import { readFileSync, readdirSync } from "node:fs"
import { basename, join, resolve } from "node:path"

function collectSwiftFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory()
        ? collectSwiftFiles(path)
        : entry.name.endsWith(".swift")
          ? [path]
          : []
    })
    .sort()
}

export function relayConsoleViewSourceFiles(repositoryRoot) {
  const appRoot = resolve(
    repositoryRoot,
    "RelayConsoleSwift/Sources/RelayConsoleApp"
  )
  return [
    join(appRoot, "Views.swift"),
    ...collectSwiftFiles(join(appRoot, "Features")).filter(
      (path) => !basename(path).startsWith("AppViewModel+")
    ),
  ]
}

export function readRelayConsoleViewSource(repositoryRoot) {
  return relayConsoleViewSourceFiles(repositoryRoot)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n")
}

export function relayConsoleAppViewModelSourceFiles(repositoryRoot) {
  const appRoot = resolve(
    repositoryRoot,
    "RelayConsoleSwift/Sources/RelayConsoleApp"
  )
  return [
    join(appRoot, "AppViewModel.swift"),
    ...collectSwiftFiles(join(appRoot, "Features")).filter((path) =>
      basename(path).startsWith("AppViewModel+")
    ),
  ]
}

export function readRelayConsoleAppViewModelSource(repositoryRoot) {
  return relayConsoleAppViewModelSourceFiles(repositoryRoot)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n")
}
