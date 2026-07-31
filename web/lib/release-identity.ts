export const RELEASE_IDENTITY_SCHEMA_VERSION =
  "relay.web-release-identity.v1" as const
export const RELEASE_REPOSITORY = "insitektalay/relay-console"

export type WebReleaseIdentity = {
  schemaVersion: typeof RELEASE_IDENTITY_SCHEMA_VERSION
  repository: string
  sourceCommit: string
  sourceBranch: string
  environment: "production"
  deploymentId: string
  deploymentURL: string
}

type Environment = Readonly<Record<string, string | undefined>>

function value(environment: Environment, name: string) {
  return environment[name]?.trim() ?? ""
}

function deploymentURL(hostname: string) {
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.vercel\.app$/i.test(hostname)) {
    return null
  }
  return `https://${hostname.toLowerCase()}`
}

export function buildWebReleaseIdentity(
  environment: Environment
): WebReleaseIdentity | null {
  const owner = value(environment, "VERCEL_GIT_REPO_OWNER")
  const repository = value(environment, "VERCEL_GIT_REPO_SLUG")
  const sourceCommit = value(environment, "VERCEL_GIT_COMMIT_SHA")
  const sourceBranch = value(environment, "VERCEL_GIT_COMMIT_REF")
  const deploymentId = value(environment, "VERCEL_DEPLOYMENT_ID")
  const releaseDeploymentURL = deploymentURL(value(environment, "VERCEL_URL"))
  const deployedRepository = `${owner}/${repository}`
  const configuredRepository =
    value(environment, "RELAY_RELEASE_REPOSITORY") || deployedRepository

  if (
    value(environment, "VERCEL") !== "1" ||
    value(environment, "VERCEL_ENV") !== "production" ||
    value(environment, "VERCEL_GIT_PROVIDER") !== "github" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(deployedRepository) ||
    deployedRepository !== configuredRepository ||
    !/^[a-f0-9]{40}$/.test(sourceCommit) ||
    !/^release\/.+/.test(sourceBranch) ||
    !/^dpl_[A-Za-z0-9]+$/.test(deploymentId) ||
    !releaseDeploymentURL
  ) {
    return null
  }

  return {
    schemaVersion: RELEASE_IDENTITY_SCHEMA_VERSION,
    repository: deployedRepository,
    sourceCommit,
    sourceBranch,
    environment: "production",
    deploymentId,
    deploymentURL: releaseDeploymentURL,
  }
}
