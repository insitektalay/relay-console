import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const providersRoot = resolve(packageRoot, "providers");

const requiredTopLevelKeys = [
  "schemaVersion",
  "slug",
  "name",
  "category",
  "description",
  "agentUseSummary",
  "provider",
  "authentication",
  "connection",
  "capabilities",
  "actions",
  "approvalProfiles",
  "riskLevel",
  "runtimeSupport",
  "availability",
  "evidence",
];

let entries = [];
try {
  entries = await readdir(providersRoot, { withFileTypes: true });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const failures = [];
const slugs = new Set();
let count = 0;

for (const entry of entries
  .filter((value) => value.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  const manifestPath = resolve(providersRoot, entry.name, "manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    failures.push(
      `${entry.name}: cannot read valid manifest.json (${error.message})`,
    );
    continue;
  }
  count += 1;
  for (const key of requiredTopLevelKeys) {
    if (!(key in manifest)) failures.push(`${entry.name}: missing ${key}`);
  }
  if (manifest.schemaVersion !== "relay.marketplace-provider.v1")
    failures.push(`${entry.name}: unsupported schemaVersion`);
  if (manifest.slug !== entry.name)
    failures.push(`${entry.name}: slug must match directory`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.slug ?? ""))
    failures.push(`${entry.name}: invalid slug`);
  if (slugs.has(manifest.slug)) failures.push(`${entry.name}: duplicate slug`);
  slugs.add(manifest.slug);
  if (!/^https:\/\//.test(manifest.provider?.websiteUrl ?? ""))
    failures.push(
      `${entry.name}: provider websiteUrl must use HTTPS for shared icon resolution`,
    );
  if (
    typeof manifest.description !== "string" ||
    manifest.description.trim().length < 50
  )
    failures.push(
      `${entry.name}: description must explain what the product is`,
    );
  const callback = manifest.connection?.callbackPath;
  const expectedCallback = `/api/v1/marketplace/oauth/${entry.name}/callback`;
  for (const credential of manifest.connection?.credentialRequirements ?? []) {
    if (credential?.inputType !== "select") continue;
    const optionValues = new Set(
      (credential.options ?? []).map((option) => option?.value).filter(Boolean),
    );
    if (!optionValues.size) {
      failures.push(
        `${entry.name}: select credential ${credential.name ?? credential.key} must declare options`,
      );
    }
    if (
      credential.defaultValue !== undefined &&
      !optionValues.has(credential.defaultValue)
    ) {
      failures.push(
        `${entry.name}: select credential ${credential.name ?? credential.key} defaultValue must match an option`,
      );
    }
    if (credential.secret === true) {
      failures.push(
        `${entry.name}: select credential ${credential.name ?? credential.key} cannot be secret`,
      );
    }
  }
  if (
    manifest.authentication?.model === "oauth2" &&
    callback !== expectedCallback
  ) {
    failures.push(`${entry.name}: OAuth callback must be ${expectedCallback}`);
  }
  if (
    manifest.authentication?.relayOwned &&
    manifest.authentication?.model !== "oauth2" &&
    manifest.authentication?.model !== "oauth1" &&
    manifest.authentication?.model !== "remote_mcp_oauth"
  ) {
    failures.push(
      `${entry.name}: relayOwned is invalid for ${manifest.authentication?.model}`,
    );
  }
  const runtimeFormats = new Set(
    (manifest.runtimeSupport ?? []).map((item) => item.format),
  );
  if (!runtimeFormats.has("openclaw") || !runtimeFormats.has("hermes"))
    failures.push(
      `${entry.name}: runtimeSupport must cover OpenClaw and Hermes`,
    );
  const defaultApprovalProfiles = (manifest.approvalProfiles ?? []).filter(
    (profile) => profile.defaultSelected,
  );
  if (defaultApprovalProfiles.length !== 1) {
    failures.push(
      `${entry.name}: exactly one approval profile must be selected by default`,
    );
  }
  if (
    defaultApprovalProfiles.some(
      (profile) => profile.id === "dangerously_skip_permissions",
    )
  ) {
    failures.push(
      `${entry.name}: dangerously_skip_permissions must never be selected by default`,
    );
  }
  const actionId = (action) =>
    typeof action === "string" ? action : action?.id;
  const allowedActionIds = new Set(
    (manifest.actions?.allowed ?? []).map(actionId),
  );
  const consequentialActionIds = new Set(
    (manifest.actions?.approvalRequired ?? []).map(actionId),
  );
  const blockedActionIds = new Set(
    (manifest.actions?.blocked ?? []).map(actionId),
  );
  for (const action of consequentialActionIds) {
    if (allowedActionIds.has(action) || blockedActionIds.has(action)) {
      failures.push(
        `${entry.name}: action ${action} appears in multiple top-level policy groups`,
      );
    }
  }
  for (const action of blockedActionIds) {
    if (allowedActionIds.has(action)) {
      failures.push(
        `${entry.name}: blocked action ${action} also appears in allowed actions`,
      );
    }
  }
  for (const profile of manifest.approvalProfiles ?? []) {
    const profileAllowed = new Set(
      (profile.allowedActions ?? []).map(actionId),
    );
    const profileApprovalRequired = new Set(
      (profile.approvalRequiredActions ?? []).map(actionId),
    );
    const profileBlocked = new Set(
      (profile.blockedActions ?? []).map(actionId),
    );
    const knownActionIds = new Set([
      ...allowedActionIds,
      ...consequentialActionIds,
      ...blockedActionIds,
    ]);
    for (const action of [
      ...profileAllowed,
      ...profileApprovalRequired,
      ...profileBlocked,
    ]) {
      if (!knownActionIds.has(action)) {
        failures.push(
          `${entry.name}: profile ${profile.id} references unknown action ${action}`,
        );
      }
    }
    for (const action of profileAllowed) {
      if (profileApprovalRequired.has(action) || profileBlocked.has(action)) {
        failures.push(
          `${entry.name}: profile ${profile.id} places action ${action} in multiple policy groups`,
        );
      }
      if (blockedActionIds.has(action)) {
        failures.push(
          `${entry.name}: profile ${profile.id} allows globally blocked action ${action}`,
        );
      }
    }
    for (const action of profileApprovalRequired) {
      if (profileBlocked.has(action)) {
        failures.push(
          `${entry.name}: profile ${profile.id} both requires approval and blocks action ${action}`,
        );
      }
    }
    if (profile.id !== "dangerously_skip_permissions") {
      for (const action of consequentialActionIds) {
        if (profileAllowed.has(action)) {
          failures.push(
            `${entry.name}: ordinary profile ${profile.id} allows consequential action ${action}`,
          );
        }
        if (
          !profileApprovalRequired.has(action) &&
          !profileBlocked.has(action)
        ) {
          failures.push(
            `${entry.name}: ordinary profile ${profile.id} must require approval or block consequential action ${action}`,
          );
        }
      }
    }
  }
  for (const evidence of manifest.evidence ?? []) {
    if (!/^https:\/\//.test(evidence.url ?? ""))
      failures.push(`${entry.name}: evidence URL must use HTTPS`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.checkedAt ?? ""))
      failures.push(`${entry.name}: evidence checkedAt must be YYYY-MM-DD`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${count} Marketplace provider manifest${count === 1 ? "" : "s"}.`,
  );
}
