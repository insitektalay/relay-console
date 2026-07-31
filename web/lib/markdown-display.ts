const ESCAPED_BLOCK_MARKER = /^( {0,3})\\(?=#{1,6}\s|(?:[-+*>]|\d+\.)\s)/gm

const FENCE_MARKER = /^ {0,3}(`{3,}|~{3,})/

function normalizeEscapedFence(line: string) {
  const escapedBackticks = line.match(/^( {0,3})((?:\\`){3,})(.*)$/)
  if (escapedBackticks) {
    return `${escapedBackticks[1]}${"`".repeat(escapedBackticks[2].length / 2)}${escapedBackticks[3]}`
  }

  const escapedTildes = line.match(/^( {0,3})((?:\\~){3,})(.*)$/)
  if (escapedTildes) {
    return `${escapedTildes[1]}${"~".repeat(escapedTildes[2].length / 2)}${escapedTildes[3]}`
  }

  return line
}

/**
 * Some agent-authored instruction files escape Markdown punctuation throughout
 * the document (for example `\# Heading` and `\*\*bold\*\*`). That is useful
 * when Markdown is embedded in another prompt, but makes the knowledge viewer
 * display the punctuation literally.
 *
 * Only repair documents with multiple escaped block markers, which avoids
 * changing an isolated, intentionally escaped character. The saved file is not
 * modified; this normalization is for the rendered preview only.
 */
export function normalizeEscapedMarkdownForDisplay(value: string) {
  const escapedBlockMarkers = value.match(ESCAPED_BLOCK_MARKER)?.length ?? 0

  if (escapedBlockMarkers < 2) {
    return value
  }

  let activeFence: string | null = null

  return value
    .split("\n")
    .map((line) => {
      const normalizedFenceLine = normalizeEscapedFence(line)
      const fenceMatch = normalizedFenceLine.match(FENCE_MARKER)
      if (fenceMatch) {
        const marker = fenceMatch[1]
        if (!activeFence) {
          activeFence = marker[0]
        } else if (marker[0] === activeFence) {
          activeFence = null
        }
        return normalizedFenceLine
      }

      if (activeFence) {
        return line
      }

      return line
        .replace(/^( {0,3})\\(?=#{1,6}\s|(?:[-+*>]|\d+\.)\s)/, "$1")
        .replace(/\\\*\\\*/g, "**")
        .replace(/\\_\\_/g, "__")
        .replace(/\\~\\~/g, "~~")
        .replace(/\\\*([^*\n]+)\\\*/g, "*$1*")
        .replace(/\\_([^_\n]+)\\_/g, "_$1_")
    })
    .join("\n")
}
