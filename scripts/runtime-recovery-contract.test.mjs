import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

function functionBody(text, signature, nextSignature) {
  const start = text.indexOf(signature)
  assert.notEqual(start, -1, `Missing ${signature}`)
  const end = text.indexOf(nextSignature, start + signature.length)
  assert.notEqual(end, -1, `Missing boundary ${nextSignature}`)
  return text.slice(start, end)
}

test("macOS bridge refresh renews authentication and keeps last valid data on failure", () => {
  const settings = source(
    "RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift",
  )
  const body = functionBody(
    settings,
    "private func loadBridgeDevices() async",
    "private func loadNativeAgents",
  )

  assert.match(body, /withValidAccessToken\s*\(/)
  assert.doesNotMatch(
    body,
    /catch\s*\{[\s\S]*?bridgeDevices\s*=\s*\[\]/,
    "A failed refresh must not replace the last valid bridge list with an empty list",
  )
})

test("the Swift bridge waits for Railway registration acceptance before suppressing retries", () => {
  const transport = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRuntimeDeviceTransport.swift",
  )
  const registerBody = functionBody(
    transport,
    "private func registerPublishedAgents(",
    "private func exchangeNativeInventory(",
  )
  const receiveBody = functionBody(
    transport,
    "private func receiveSocketLoop(",
    "private func handleAttachmentControl(",
  )

  assert.doesNotMatch(
    registerBody,
    /registeredExternalAgentIds\.insert\(externalId\)\.inserted/,
    "Sending a frame is not proof that Railway accepted the registration",
  )
  assert.match(receiveBody, /bridge_agent_registration/)
  assert.match(receiveBody, /accepted/)
})

test("automatic Relay setup repairs eligible local agent links and respects an explicit opt-out", () => {
  const coordination = source(
    "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Shell/AppViewModel+Coordination.swift",
  )
  const sync = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRelaySync.swift",
  )
  const migrations = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/Migrations.swift",
  )

  const automaticLinkBody = functionBody(
    coordination,
    "func ensureAutomaticCloudLinkIfPossible() async -> Bool",
    "func resolvedCalendarGroup",
  )
  assert.match(automaticLinkBody, /repairAutomaticConnectAgentLinks/)
  assert.match(sync, /public func repairAutomaticConnectAgentLinks/)
  assert.match(sync, /connect_auto_link_suppressed\s*=\s*0/)
  assert.match(sync, /public func railwayMarketplaceRequest[\s\S]*?withValidAccessToken/)
  assert.match(sync, /public func railwayMarketplaceArrayRequest[\s\S]*?withValidAccessToken/)
  assert.match(
    migrations,
    /ALTER TABLE runtime_bindings ADD COLUMN connect_auto_link_suppressed/,
  )
})

test("the macOS Remote Access setup step starts automatic Relay Host recovery", () => {
  const setup = source(
    "RelayConsoleSwift/Sources/RelayConsoleApp/SetupAssistantView.swift",
  )
  const model = source(
    "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Settings/AppViewModel+SetupAssistant.swift",
  )
  const remoteAccessBody = functionBody(
    setup,
    "private var remoteInstallationStep: some View",
    "private var allSelectedBridgesConnected: Bool",
  )

  assert.match(remoteAccessBody, /await model\.recoverSetupBridgeConnections\(\)/)
  assert.match(
    model,
    /func recoverSetupBridgeConnections\(\) async[\s\S]*?ensureAutomaticCloudLinkIfPossible\(\)/,
    "The setup action must reach the recovery path that starts RelayHostService",
  )
})

test("RelayHostService shares the app signing identity and proves connection ownership", () => {
  const daemon = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/RelayHostDaemon.swift",
  )
  const developmentBuild = source(
    "RelayConsoleSwift/Scripts/open-relay-console.sh",
  )
  const releaseBuild = source(
    "RelayConsoleSwift/Scripts/build-release-app.sh",
  )
  const distributionBuild = source(
    "RelayConsoleSwift/Scripts/build-distribution.sh",
  )

  assert.match(daemon, /connectedWorkspaceCount\s*>\s*0/)
  assert.doesNotMatch(
    daemon,
    /status\.state\s*==\s*"ready"\s*\|\|\s*status\.state\s*==\s*"recovering"/,
    "A recovering service with no live workspace must not suppress the app fallback",
  )
  assert.match(developmentBuild, /sign_local_executable .*HOST_EXECUTABLE.* "Relay Console"/)
  assert.match(developmentBuild, /sign_local_executable .*MACOS_DIR\/\$HOST_NAME.* "Relay Console"/)
  assert.match(releaseBuild, /--identifier "Relay Console" --sign - "\$HOST_EXECUTABLE"/)
  assert.match(releaseBuild, /--identifier "Relay Console" --sign - "\$MAIN_EXECUTABLE"/)
  assert.match(distributionBuild, /--identifier "\$RELAY_SIGNING_IDENTIFIER"[^\n]*"\$HOST_EXECUTABLE"/)
  assert.match(distributionBuild, /--identifier "\$RELAY_SIGNING_IDENTIFIER"[^\n]*"\$MAIN_EXECUTABLE"/)
})

test("automatic recovery keeps one Relay Host owner and presents both runtime adapters", () => {
  const daemon = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/RelayHostDaemon.swift",
  )
  const transport = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRuntimeDeviceTransport.swift",
  )
  const model = source(
    "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Settings/AppViewModel+SetupAssistant.swift",
  )
  const setup = source(
    "RelayConsoleSwift/Sources/RelayConsoleApp/SetupAssistantView.swift",
  )

  assert.match(daemon, /if activeOwner && isCurrentOwner\(executableIdentity: executableIdentity\) \{ return true \}/)
  assert.match(daemon, /public func isActiveOwner\(now: Date = Date\(\)\) -> Bool/)
  assert.match(daemon, /for _ in 0\.\.<300/)
  assert.match(daemon, /let replaceActiveOwner = activeOwner[\s\S]*?!isCurrentOwner\(executableIdentity: executableIdentity\)/)
  assert.match(daemon, /replaceActiveOwner[\s\S]*?\["kickstart", "-k"/)
  assert.match(daemon, /executableIdentity/)
  assert.match(transport, /clawchat\.runtime\.openclaw/)
  assert.match(model, /setupBridgeDeviceSupportsRuntime/)
  assert.match(model, /state: \.connecting/)
  assert.match(setup, /case \.connecting: return "Connecting"/)
  assert.match(setup, /canInstallLocally && pairing\.state != \.connecting/)
})

test("Relay Host migration preserves recovery and groups runtime adapters by stable installation", () => {
  const transport = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRuntimeDeviceTransport.swift",
  )
  const identity = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/RelayHostIdentity.swift",
  )
  const backend = source("backend/src/modules/bridge/bridge.service.ts")
  const authority = source(
    "backend/src/modules/runtime/runtime-authority.service.ts",
  )
  const daemon = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/RelayHostDaemon.swift",
  )
  const coordination = source(
    "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Shell/AppViewModel+Coordination.swift",
  )
  const webGrouping = source("web/features/runtime/group-relay-hosts.ts")
  const iosSettings = source("ios/ClawChat/Features/Operations/SettingsView.swift")

  assert.match(identity, /relay\.host\.installation-id/)
  assert.match(transport, /clawchat\.relay_host\.v1/)
  assert.match(transport, /hostInstallationId/)
  assert.match(transport, /bridge_agent_registration/)
  assert.match(backend, /hostInstallationId/)
  assert.match(backend, /adapterRole/)
  assert.match(authority, /supportedRuntimes/)
  assert.match(authority, /executionBridgeDeviceId/)
  assert.match(authority, /adapterRole:\s*"DESC"/)
  assert.match(daemon, /CloudRuntimeDeviceTransport/)
  assert.match(daemon, /repairAutomaticConnectAgentLinks/)
  assert.match(coordination, /RelayHostServiceManager/)
  assert.match(coordination, /!relayHostOwnsRuntime/)
  assert.match(webGrouping, /groupRelayHosts/)
  assert.match(iosSettings, /relayHostGroups/)
})

test("Relay Host-owned macOS dispatch uses a refreshable signed-in Marketplace session", () => {
  const proxy = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/CloudMarketplaceRuntimeToolProxy.swift",
  )
  const services = source(
    "RelayConsoleSwift/Sources/RelayConsoleCore/RelayConsoleServices.swift",
  )
  const backend = source(
    "backend/src/modules/marketplace/localappconnector-agent-api-tools.controller.ts",
  )

  assert.match(proxy, /setLocalDispatchSessionLoader/)
  assert.match(proxy, /clawchat_control_plane_marketplace_tool/)
  assert.match(proxy, /requiresUserAccessToken/)
  assert.match(proxy, /error\.code == \.permissionDenied[\s\S]*?loader\(context\.workspaceId\)/)
  assert.match(services, /cloudConnections\.validAccessToken/)
  assert.match(
    backend,
    /@UseGuards\(JwtAuthGuard\)[\s\S]*?workspaces\/:workspaceId\/marketplace\/agents\/:agentId\/runtime-tools/,
  )
  assert.match(backend, /workspaceMembershipService\.ensureWorkspaceAccess/)
})
