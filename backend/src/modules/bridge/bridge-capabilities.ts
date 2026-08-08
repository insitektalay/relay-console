export const SERVER_AUTHORIZED_BRIDGE_CAPABILITIES = new Set<string>([
  "clawchat.relay_host.v1",
  "clawchat.runtime.hermes",
  "clawchat.runtime.openclaw",
  "clawchat.marketplace.tools",
  "marketplaceHermesSkillInstall",
  "marketplaceLocalRepoDocsRead",
  "marketplaceLocalRepoDocsWrite",
  "marketplaceLocalAppAgentApiSetup",
  "localAppRuntimeRecovery",
  "clawchat.attachments.local_media",
  "claude.cli.structured_prompt",
  "clawchat.runtime.structured_jobs",
  "clawchat.runtime.structured_output",
  "clawchat.host.agent_workspace_purge",
  "clawchat.host.scheduler_maintenance",
  "clawchat.host.cron_management",
  "clawchat.agent_replica_sync",
]);

export function normalizeServerAuthorizedBridgeCapabilities(
  capabilities: unknown,
) {
  if (!Array.isArray(capabilities)) {
    return [];
  }

  const authorized: string[] = [];
  const seen = new Set<string>();
  for (const entry of capabilities) {
    if (typeof entry !== "string") continue;
    const capability = entry.trim();
    if (!capability) continue;
    if (!SERVER_AUTHORIZED_BRIDGE_CAPABILITIES.has(capability)) continue;
    if (seen.has(capability)) continue;
    seen.add(capability);
    authorized.push(capability);
  }
  return authorized;
}

export function mergeServerAuthorizedBridgeCapabilities(
  storedCapabilities?: string[] | null,
  liveCapabilities?: string[] | null,
) {
  return new Set(
    normalizeServerAuthorizedBridgeCapabilities([
      ...(storedCapabilities ?? []),
      ...(liveCapabilities ?? []),
    ]),
  );
}
