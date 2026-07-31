import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import * as path from 'path'

const repoRoot = path.resolve(__dirname, '../../../..')
const sourceRoots = [
  'backend/src',
  'packages/web-sdk/src',
  'web/components',
  'web/lib',
  'claude-runtime/src',
  'hermes-runtime',
]
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json'])
const forbiddenSurfaces = [
  {
    label: 'legacy x-bridge-secret header',
    pattern: /x-bridge-secret/i,
  },
  {
    label: 'legacy BRIDGE_SECRET env/config surface',
    pattern: /\bBRIDGE_SECRET\b/,
  },
  {
    label: 'legacy bridgeSecret property',
    pattern: /\bbridgeSecret\b/,
  },
]

function listSourceFiles(relativeRoot: string): string[] {
  const absoluteRoot = path.join(repoRoot, relativeRoot)
  if (!existsSync(absoluteRoot)) return []

  const entries = readdirSync(absoluteRoot)
  return entries.flatMap((entry) => {
    const absolutePath = path.join(absoluteRoot, entry)
    const relativePath = path.relative(repoRoot, absolutePath)
    const stat = statSync(absolutePath)

    if (stat.isDirectory()) {
      if (['dist', 'node_modules', '.next'].includes(entry)) return []
      return listSourceFiles(relativePath)
    }

    if (!sourceExtensions.has(path.extname(entry))) return []
    if (relativePath.endsWith('bridge-shared-secret-regression.spec.ts')) {
      return []
    }
    return [absolutePath]
  })
}

describe('bridge shared secret regression guard', () => {
  it('keeps product source on per-device bridge credentials', () => {
    const matches = sourceRoots
      .flatMap(listSourceFiles)
      .flatMap((absolutePath) => {
        const content = readFileSync(absolutePath, 'utf8')
        return forbiddenSurfaces
          .filter(({ pattern }) => pattern.test(content))
          .map(({ label }) => `${path.relative(repoRoot, absolutePath)}: ${label}`)
      })

    expect(matches).toEqual([])
  })
})
