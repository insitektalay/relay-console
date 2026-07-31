const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n', 'off'])

function parseBooleanFlag(value?: string) {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return undefined
  }

  if (TRUE_VALUES.has(normalized)) {
    return true
  }

  if (FALSE_VALUES.has(normalized)) {
    return false
  }

  return undefined
}

export function shouldMountApiDocs(env: NodeJS.ProcessEnv = process.env) {
  const explicitDocsFlag = parseBooleanFlag(env.CLAWCHAT_API_DOCS_ENABLED)

  if (explicitDocsFlag === false) {
    return false
  }

  if (env.NODE_ENV === 'production') {
    return parseBooleanFlag(env.CLAWCHAT_INTERNAL_API_DOCS_ENABLED) === true
  }

  return true
}
