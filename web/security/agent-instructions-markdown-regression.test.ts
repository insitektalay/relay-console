import assert from "node:assert/strict"
import test from "node:test"

import { normalizeEscapedMarkdownForDisplay } from "../lib/markdown-display"

test("repairs consistently escaped agent instruction markdown for preview", () => {
  const input = String.raw`\# GapMiner

You are \*\*GapMiner\*\*.

\## Core identity

\- \*\*Precise\*\* — clear decisions
\- Use \_short updates\_`

  assert.equal(
    normalizeEscapedMarkdownForDisplay(input),
    `# GapMiner

You are **GapMiner**.

## Core identity

- **Precise** — clear decisions
- Use _short updates_`
  )
})

test("preserves isolated escapes and fenced code examples", () => {
  const isolated = String.raw`Use \# to show a literal hash.`
  assert.equal(normalizeEscapedMarkdownForDisplay(isolated), isolated)

  const fenced = String.raw`\# Instructions

\## Example

\`\`\`text
\# literal heading
\*\*literal stars\*\*
\`\`\``

  assert.equal(
    normalizeEscapedMarkdownForDisplay(fenced),
    [
      "# Instructions",
      "",
      "## Example",
      "",
      "```text",
      String.raw`\# literal heading`,
      String.raw`\*\*literal stars\*\*`,
      "```",
    ].join("\n")
  )
})
