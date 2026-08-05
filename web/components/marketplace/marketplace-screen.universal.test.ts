import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { marketplaceSource } from "./marketplace-source.test"

const root = new URL("../../../", import.meta.url)

async function source(path: string) {
  return readFile(new URL(path, root), "utf8")
}

test("all three clients omit the universal application info cards", async () => {
  const [web, mac, iphone] = await Promise.all([
    Promise.resolve(marketplaceSource),
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/ApplicationExaFormatting.swift"
    ),
    source("ios/ClawChat/Features/Marketplace/MarketplaceView.swift"),
  ])

  assert.doesNotMatch(web, /MarketplaceUniversalInfoCards/)
  assert.match(mac, /isRemovedApplicationDetailCard/)
  assert.match(mac, /if !isRemovedApplicationDetailCard/)
  assert.match(
    iphone,
    /detailOverviewCard[\s\S]*connectedAgentsCard[\s\S]*connectionManagementCard/
  )
  assert.doesNotMatch(iphone, /detailDisclosure\(title:/)
})

test("all three marketplace listings use product descriptions instead of agent setup copy", async () => {
  const [web, mac, iphone] = await Promise.all([
    source("web/components/marketplace/marketplace-catalog-ui.tsx"),
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/ApplicationCatalogViews.swift"
    ),
    source("ios/ClawChat/Features/Marketplace/MarketplaceView.swift"),
  ])

  const webCard = web.slice(
    web.indexOf("export function MarketplaceAppGrid"),
    web.indexOf("export function MarketplaceDenseRow")
  )
  const macCard = mac.slice(
    mac.indexOf("struct ApplicationsMarketplaceCard"),
    mac.indexOf("struct ApplicationsDiagnosticPill")
  )
  const iphoneCard = iphone.slice(
    iphone.indexOf("private struct MarketplaceAppRow"),
    iphone.indexOf("private struct MarketplaceProviderMark")
  )

  assert.match(webCard, /\{app\.description\}/)
  assert.doesNotMatch(webCard, /agentUseSummary/)
  assert.match(webCard, /cursor-pointer/)
  assert.match(webCard, /View app →/)
  assert.match(macCard, /Text\(app\.description\)/)
  assert.doesNotMatch(macCard, /Text\(app\.summary\)/)
  assert.match(macCard, /Text\("View app"\)/)
  assert.match(macCard, /NSCursor\.pointingHand/)
  assert.match(iphoneCard, /Text\(app\.description\)/)
  assert.doesNotMatch(iphoneCard, /agentUseSummary/)
  assert.match(iphoneCard, /Text\("View app"\)/)
})

test("the Mac client consumes manifest-defined credential fields without provider fallbacks", async () => {
  const [mapper, viewModel, views, acoustic, jotform] = await Promise.all([
    source(
      "RelayConsoleSwift/Sources/RelayConsoleCore/MarketplaceCatalogRecordMapper.swift"
    ),
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/AppViewModel+ApplicationCatalogCredentials.swift"
    ),
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/ApplicationCredentialFormsA.swift"
    ),
    source(
      "packages/marketplace-catalog/providers/acoustic-campaign/manifest.json"
    ),
    source("packages/marketplace-catalog/providers/jotform/manifest.json"),
  ])

  assert.match(mapper, /record\["credentialRequirements"\]/)
  assert.match(mapper, /connection\?\["credentialRequirements"\]/)
  assert.match(mapper, /requirement\["name"\][\s\S]*requirement\["key"\]/)
  assert.match(viewModel, /saveManifestDefinedConnection/)
  assert.match(views, /ApplicationsManifestCredentialForm/)

  for (const credential of [
    "ACOUSTIC_CAMPAIGN_CLIENT_ID",
    "ACOUSTIC_CAMPAIGN_CLIENT_SECRET",
    "ACOUSTIC_CAMPAIGN_REFRESH_TOKEN",
    "ACOUSTIC_CAMPAIGN_POD",
  ]) {
    assert.match(acoustic, new RegExp(credential))
  }
  assert.match(jotform, /JOTFORM_API_KEY/)
  assert.match(jotform, /JOTFORM_API_REGION/)
})

test("all three generic clients render Railway-defined select credentials", async () => {
  const [mac, iphone, jotform] = await Promise.all([
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/ApplicationCredentialFormsA.swift"
    ),
    source("ios/ClawChat/Features/Marketplace/MarketplaceView.swift"),
    source("packages/marketplace-catalog/providers/jotform/manifest.json"),
  ])

  assert.match(marketplaceSource, /credential\.inputType === "select"/)
  assert.match(marketplaceSource, /credential\.options\.map/)
  assert.match(marketplaceSource, /Connection name/)
  assert.match(mac, /requirement\.inputType == "select"/)
  assert.match(mac, /requirement\.options/)
  assert.match(mac, /connectionTypes\.count > 1/)
  assert.match(iphone, /requirement\.inputType == "select"/)
  assert.match(iphone, /requirement\.options/)
  assert.match(iphone, /app\.connectionTypes\.count > 1/)
  assert.match(
    jotform,
    /"types": \[\s*"oauth_connector",\s*"customer_owned_api_key"\s*\]/
  )
  assert.match(jotform, /"inputType": "select"/)
  assert.match(jotform, /"defaultValue": "standard"/)
})

test("PayPal delegates its bounded environment selector to the generic clients", async () => {
  const [paypal, railwayCatalog, macCatalog] = await Promise.all([
    source("packages/marketplace-catalog/providers/paypal/manifest.json").then(
      JSON.parse
    ),
    source(
      "backend/src/modules/marketplace/catalog/generated-provider-catalog.json"
    ).then(JSON.parse),
    source(
      "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/marketplace-provider-catalog.json"
    ).then(JSON.parse),
  ])
  type CredentialOption = {
    value: string
    label: string
  }
  type CredentialRequirement = {
    name: string
    inputType?: "text" | "select"
    options?: CredentialOption[]
    defaultValue?: string
  }
  type MarketplaceManifest = {
    slug: string
    connection: {
      credentialRequirements: CredentialRequirement[]
    }
  }
  const environmentFrom = (provider: {
    slug: string
    connection: { credentialRequirements: CredentialRequirement[] }
  } | undefined) => {
    assert.ok(provider, "PayPal provider must be present")
    const environment = provider.connection.credentialRequirements.find(
      (credential) => credential.name === "PAYPAL_ENVIRONMENT"
    )
    assert.ok(environment, "PayPal environment credential must be present")
    return environment
  }
  const environment = environmentFrom(paypal)
  const railwayEnvironment = environmentFrom(
    railwayCatalog.manifests.find(
      (provider: MarketplaceManifest) => provider.slug === "paypal"
    )
  )
  const macEnvironment = environmentFrom(
    macCatalog.manifests.find(
      (provider: MarketplaceManifest) => provider.slug === "paypal"
    )
  )

  assert.deepEqual(environment.options, [
    { value: "sandbox", label: "Sandbox" },
    { value: "live", label: "Live" },
  ])
  assert.equal(environment.inputType, "select")
  assert.equal(environment.defaultValue, "sandbox")
  assert.deepEqual(railwayEnvironment, environment)
  assert.deepEqual(macEnvironment, environment)
})

test("all three clients render one state-appropriate OAuth action", async () => {
  const [mac, iphone, webSetup, jotform] = await Promise.all([
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/ApplicationCredentialFormsA.swift"
    ),
    source("ios/ClawChat/Features/Marketplace/MarketplaceView.swift"),
    source("web/components/marketplace/marketplace-connector-setup.tsx"),
    source("packages/marketplace-catalog/providers/jotform/manifest.json"),
  ])

  assert.match(
    marketplaceSource,
    /accountCreationUrl=\{selectedApp\.accountCreationUrl\}/
  )
  assert.match(marketplaceSource, /`Connect \$\{appName\}`/)
  assert.match(marketplaceSource, /Create a \{appName\} account/)

  assert.match(mac, /func marketplaceUsesConnectorOAuthPage/)
  assert.match(mac, /"oauth_connector", "oauth1_xauth"/)
  assert.match(mac, /struct ApplicationsProviderOAuthActions/)
  assert.match(
    mac,
    /marketplaceUsesSharedProviderPage\(app\) \|\| marketplaceUsesConnectorOAuthPage\(app\)/
  )
  assert.match(mac, /if !isConnected/)
  assert.doesNotMatch(mac, /Reconnect \\\(app\.name\)/)
  assert.match(mac, /Label\("Create a \\\(app\.name\) account"/)
  assert.match(mac, /\.buttonStyle\(SecondaryLightButtonStyle\(\)\)/)

  assert.match(iphone, /if !isConnected/)
  assert.doesNotMatch(iphone, /Reconnect \\\(app\.name\)/)
  assert.match(iphone, /Link\("Create a \\\(app\.name\) account"/)

  assert.match(webSetup, /`Connect \$\{appName\}`/)
  const connectorSetup = webSetup.slice(
    webSetup.indexOf("export function ConnectorOAuthSetupNotice")
  )
  assert.match(connectorSetup, />\s*Disconnect\s*</)
  assert.doesNotMatch(connectorSetup, />\s*Re-authorize\s*</)

  assert.match(
    jotform,
    /"accountCreationUrl": "https:\/\/www\.jotform\.com\/signup\/"/
  )
  assert.match(
    jotform,
    /"types": \[\s*"oauth_connector",\s*"customer_owned_api_key"\s*\]/
  )
})

test("web and iPhone clients can update saved generic connections", async () => {
  const [iphoneEndpoint, iphoneViewModel, iphoneView, webSdk] =
    await Promise.all([
      source("ios/ClawChat/Infrastructure/Network/APIEndpoints.swift"),
      source("ios/ClawChat/Features/Marketplace/MarketplaceViewModel.swift"),
      source("ios/ClawChat/Features/Marketplace/MarketplaceView.swift"),
      source("packages/web-sdk/src/index.ts"),
    ])

  assert.match(marketplaceSource, /updateConnectionMutation/)
  assert.match(marketplaceSource, /Replace saved credentials/)
  assert.match(webSdk, /updateConnection:[\s\S]*method: "PATCH"/)
  assert.match(iphoneEndpoint, /case updateMarketplaceConnection/)
  assert.match(
    iphoneEndpoint,
    /case \.updateMarketplaceConnection:[\s\S]*return \.patch/
  )
  assert.match(
    iphoneViewModel,
    /func update\([\s\S]*\.updateMarketplaceConnection/
  )
  assert.match(iphoneView, /Edit saved connection/)
  assert.match(iphoneView, /Replace saved credentials/)
})

test("generic agent switches persist assignments directly on all three clients", async () => {
  const [macView, macViewModel, webConnect, iphone] = await Promise.all([
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/ApplicationCredentialFormsA.swift"
    ),
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/AppViewModel+ApplicationKnowledgeBusiness.swift"
    ),
    source("web/features/marketplace/use-marketplace-connect-app.ts"),
    source("ios/ClawChat/Features/Marketplace/MarketplaceView.swift"),
  ])

  assert.match(
    macView,
    /setSharedMarketplaceAgentConnection\(target\.agentId, enabled: !isOn, for: app\)/
  )
  assert.doesNotMatch(macView, /@State private var confirming/)
  assert.match(macViewModel, /resolvedExecutionAuthority == \.railway/)
  assert.match(macViewModel, /relativePath: "install"/)
  assert.match(macViewModel, /relativePath: "installs\/\\\(existing\.id\)"/)

  assert.match(marketplaceSource, /assignAgentMutation\.mutate\(agent\.id\)/)
  assert.match(
    marketplaceSource,
    /removeInstallMutation\.mutate\(activeInstall\)/
  )
  assert.match(webConnect, /const assignAgentMutation = useMutation/)

  assert.match(iphone, /Toggle\("", isOn: Binding/)
  assert.match(iphone, /await setAccess\(newValue, for: agent\)/)
  assert.match(
    iphone,
    /connection: selectedConnection \?\? preferredConnection/
  )
})

test("the Mac connected-app and conversation projections survive catalog filtering", async () => {
  const [refresh, credentials, sidebar, conversations] = await Promise.all([
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/AppViewModel+ApplicationRefresh.swift"
    ),
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/AppViewModel+ApplicationCatalogCredentials.swift"
    ),
    source(
      "RelayConsoleSwift/Sources/RelayConsoleApp/Features/Applications/ApplicationCatalogViews.swift"
    ),
    source("RelayConsoleSwift/Sources/RelayConsoleApp/AppViewModel.swift"),
  ])

  assert.match(
    refresh,
    /let nextApplicationsCatalogApps = try loadUnfilteredApplicationsCatalogApps/
  )
  assert.doesNotMatch(
    refresh,
    /let nextApplicationsCatalogApps = nextApplicationsCatalog\.apps/
  )
  assert.match(
    credentials,
    /applicationsCatalogApps = try self\.loadUnfilteredApplicationsCatalogApps/
  )
  assert.doesNotMatch(credentials, /applicationsCatalogApps = next\.apps/)
  assert.match(sidebar, /catalogApps\.filter/)
  assert.doesNotMatch(sidebar, /\(snapshot\?\.apps \?\? \[\]\)\.filter/)
  assert.match(conversations, /let sourceApps =\s*applicationsCatalogApps/)
})
