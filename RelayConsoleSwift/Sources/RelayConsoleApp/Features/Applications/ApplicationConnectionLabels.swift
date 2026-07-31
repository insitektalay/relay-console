import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

func gmailConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Gmail OAuth account"
}

func gmailConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  guard connection.status == .connected, connection.health.state == .ready,
    connection.grantedScopes == ProviderConnectionService.gmailOAuthScopes
  else { return false }
  if connection.credentialOwnership == .relayOwned {
    return connection.providerKey.localizedCaseInsensitiveContains("gmail-relay-owned-google-oauth")
      && connection.health.diagnostics["apiOrigin"]?.string == "https://gmail.googleapis.com"
      && connection.health.diagnostics["accountEmail"]?.string.map { $0.contains("@") } == true
  }
  return connection.credentialOwnership == .userOwned
    && connection.providerKey == "gmail-user-oauth"
}

func gmailConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if gmailConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func gmailAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty ?? connection.accountLabel?.nilIfEmpty
    ?? "Account metadata not saved"
}

func googleDocsConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Google Docs OAuth account"
}

func googleDocsConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
    && connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
    && connection.providerKey.localizedCaseInsensitiveContains(
      "google-docs-relay-owned-google-oauth")
    && connection.grantedScopes == ProviderConnectionService.googleDocsRelayOwnedOAuthScopes
    && connection.health.diagnostics["documentTargetRequired"]?.bool == true
}

func googleDocsConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if googleDocsConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func googleDocsAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty ?? connection.accountLabel?.nilIfEmpty
    ?? "Account metadata not saved"
}

func googleDocsProjectPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["projectId"]?.string?.nilIfEmpty ?? "Not saved"
}

func slackConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Slack workspace"
}

func slackConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func slackConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if slackConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func slackWorkspacePreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty
    ?? connection.health.diagnostics["workspaceName"]?.string?.nilIfEmpty
    ?? connection.accountLabel?.nilIfEmpty
    ?? "Workspace metadata not saved"
}

func githubConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "GitHub OAuth account"
}

func githubConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func githubConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if githubConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func githubAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty
    ?? connection.health.diagnostics["login"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["organization"]?.string?.nilIfEmpty
    ?? connection.accountLabel?.nilIfEmpty
    ?? "Account metadata not saved"
}

func gitLabConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "GitLab OAuth account"
}

func gitLabConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func gitLabConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if gitLabConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func gitLabAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty
    ?? connection.health.diagnostics["username"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["group"]?.string?.nilIfEmpty
    ?? connection.accountLabel?.nilIfEmpty
    ?? "Account metadata not saved"
}

func bitbucketConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Bitbucket OAuth account"
}

func bitbucketConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func bitbucketConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if bitbucketConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func bitbucketAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty
    ?? connection.health.diagnostics["username"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["group"]?.string?.nilIfEmpty
    ?? connection.accountLabel?.nilIfEmpty
    ?? "Account metadata not saved"
}

func linearConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Linear OAuth account"
}

func linearConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func linearConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if linearConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func linearAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty
    ?? connection.health.diagnostics["username"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["team"]?.string?.nilIfEmpty
    ?? connection.accountLabel?.nilIfEmpty
    ?? "Account metadata not saved"
}

func asanaConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Asana OAuth account"
}

func asanaConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func asanaConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if asanaConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func asanaAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["workspaceName"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
    ?? connection.health.diagnostics["userName"]?.string?.nilIfEmpty
    ?? connection.accountLabel?.nilIfEmpty
    ?? "Workspace metadata not saved"
}

func trelloConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Trello account"
}
func trelloConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func trelloConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  trelloConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func trelloAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["workspaceName"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["fullName"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["username"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty ?? "Member metadata not saved"
}

func clickUpConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "ClickUp OAuth account"
}
func clickUpConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func clickUpConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  clickUpConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func clickUpAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let account =
    connection.health.diagnostics["accountName"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  let workspaceValues: [JSONValue]
  if case .some(.array(let values)) = connection.health.diagnostics["authorizedWorkspaceNames"] {
    workspaceValues = values
  } else {
    workspaceValues = []
  }
  let workspaces = workspaceValues.compactMap(\.string).filter { !$0.isEmpty }.joined(
    separator: ", ")
  return [account, workspaces.nilIfEmpty].compactMap { $0 }.joined(separator: " · ").nilIfEmpty
    ?? "Authorized Workspace grant"
}
func mondayConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Monday.com OAuth account"
}
func mondayConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func mondayConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  mondayConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func mondayAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let account =
    connection.health.diagnostics["accountName"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  var names: [String] = []
  if case .some(.array(let values)) = connection.health.diagnostics["workspaceNames"] {
    names = values.compactMap(\.string)
  }
  return [account, names.joined(separator: ", ").nilIfEmpty].compactMap { $0 }.joined(
    separator: " · "
  ).nilIfEmpty ?? "Authorized account"
}
func airtableConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Airtable OAuth grant"
}
func airtableConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func airtableConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  airtableConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func airtableAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let user =
    connection.health.diagnostics["userEmail"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  var bases: [String] = []
  if case .some(.array(let values)) = connection.health.diagnostics["authorizedBaseNames"] {
    bases = values.compactMap(\.string)
  }
  return [user, bases.joined(separator: ", ").nilIfEmpty].compactMap { $0 }.joined(separator: " · ")
    .nilIfEmpty ?? "Authorized resource grant"
}
func dropboxConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Dropbox OAuth account"
}
func dropboxConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func dropboxConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  dropboxConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func dropboxAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let email =
    connection.health.diagnostics["email"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  let root = connection.health.diagnostics["rootNamespaceId"]?.string?.nilIfEmpty
  return [email, root.map { "root \($0)" }].compactMap { $0 }.joined(separator: " · ").nilIfEmpty
    ?? "Authorized root namespace"
}
func boxConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Box OAuth account"
}
func boxConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func boxConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  boxConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func boxAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let login =
    connection.health.diagnostics["login"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  let enterprise = connection.health.diagnostics["enterpriseName"]?.string?.nilIfEmpty
  return [login, enterprise].compactMap { $0 }.joined(separator: " · ").nilIfEmpty
    ?? "Authorized Box user"
}
func figmaConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Figma OAuth user"
}
func figmaConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func figmaConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  figmaConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func figmaAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["email"]?.string?.nilIfEmpty ?? connection.connectedHandle?
    .nilIfEmpty ?? connection.health.diagnostics["handle"]?.string?.nilIfEmpty
    ?? "Authorized Figma user"
}
func miroConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Miro OAuth team"
}
func miroConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func miroConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  miroConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func miroAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let team =
    connection.health.diagnostics["teamId"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  let user = connection.health.diagnostics["userId"]?.string?.nilIfEmpty
  return [team.map { "team \($0)" }, user.map { "user \($0)" }].compactMap { $0 }.joined(
    separator: " · "
  ).nilIfEmpty ?? "Authorized Miro team"
}
func canvaConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Canva OAuth team"
}
func canvaConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func canvaConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  canvaConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func canvaAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let team =
    connection.health.diagnostics["teamId"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  let user = connection.health.diagnostics["userId"]?.string?.nilIfEmpty
  return [team.map { "team \($0)" }, user.map { "user \($0)" }].compactMap { $0 }.joined(
    separator: " · "
  ).nilIfEmpty ?? "Authorized Canva team"
}
func webflowConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Webflow App grant"
}
func webflowConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func webflowConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  webflowConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func webflowAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  func strings(_ value: JSONValue?) -> [String] {
    guard case .array(let values)? = value else { return [] }
    return values.compactMap(\.string)
  }
  let sites = strings(connection.health.diagnostics["authorizedSiteNames"])
  let workspaces = strings(connection.health.diagnostics["authorizedWorkspaceNames"])
  return (sites + workspaces).prefix(3).joined(separator: " · ").nilIfEmpty ?? connection
    .connectedHandle?.nilIfEmpty ?? "Authorized Webflow sites"
}
func wordpressComConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "WordPress.com site"
}
func wordpressComConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func wordpressComConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  wordpressComConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func wordpressComAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let name = connection.health.diagnostics["blogName"]?.string?.nilIfEmpty
  let url = connection.health.diagnostics["blogURL"]?.string?.nilIfEmpty
  let id =
    connection.health.diagnostics["blogId"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  return [name, url, id.map { "site \($0)" }].compactMap { $0 }.joined(separator: " · ").nilIfEmpty
    ?? "Authorized WordPress.com site"
}
func contentfulConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Contentful OAuth resources"
}
func contentfulConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func contentfulConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  contentfulConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func contentfulAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  func strings(_ key: String) -> [String] {
    guard case .array(let values)? = connection.health.diagnostics[key] else { return [] }
    return values.compactMap(\.string)
  }
  let namedSpaces = strings("authorizedSpaceNames")
  let spaces = namedSpaces.isEmpty ? strings("authorizedSpaceIds") : namedSpaces
  let environments = strings("authorizedEnvironmentIds")
  let region = connection.health.diagnostics["cmaHost"]?.string?.nilIfEmpty
  return (Array(spaces.prefix(2)) + Array(environments.prefix(2)) + [region].compactMap { $0 })
    .joined(separator: " · ").nilIfEmpty ?? connection.connectedHandle?.nilIfEmpty
    ?? "Authorized Contentful resources"
}
func shopifyConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Shopify shop"
}
func shopifyConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func shopifyConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  shopifyConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func shopifyAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let shop =
    connection.health.diagnostics["shopDomain"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  let name = connection.health.diagnostics["shopName"]?.string?.nilIfEmpty
  return [name, shop].compactMap { $0 }.joined(separator: " · ").nilIfEmpty
    ?? "Connected Shopify shop"
}
func wooCommerceConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "WooCommerce store"
}
func wooCommerceConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func wooCommerceConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  wooCommerceConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func wooCommerceAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let origin =
    connection.health.diagnostics["storeOrigin"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  let name = connection.health.diagnostics["storeName"]?.string?.nilIfEmpty
  return [name, origin].compactMap { $0 }.joined(separator: " · ").nilIfEmpty
    ?? "Connected WooCommerce store"
}
func stripeConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Stripe account"
}
func stripeConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}
func stripeConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  stripeConnectionIsValid(connection)
    ? "Ready" : ProviderConnectionService.providerStatusTitle(for: connection)
}
func stripeAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  let account =
    connection.health.diagnostics["stripeAccountId"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
  let mode = connection.health.diagnostics["livemode"]?.bool == true ? "Live" : "Test"
  return [account, mode].compactMap { $0 }.joined(separator: " · ").nilIfEmpty
    ?? "Connected Stripe account"
}

func googleCalendarConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Google Calendar OAuth account"
}

func googleCalendarConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected
    && connection.health.state == .ready
    && connection.credentialOwnership == .relayOwned
    && !connection.userOwnedCredentialsRequired
    && connection.providerKey.localizedCaseInsensitiveContains(
      "google-calendar-relay-owned-google-oauth")
    && connection.grantedScopes == ProviderConnectionService.googleCalendarRelayOwnedOAuthScopes
    && connection.health.diagnostics["clientSecretLocation"]?.string == "secure-railway-broker-only"
}

func googleCalendarConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if googleCalendarConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func googleCalendarAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty ?? connection.accountLabel?.nilIfEmpty
    ?? "Account metadata not saved"
}

func googleDriveConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Google Drive OAuth account"
}

func googleDriveAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty ?? connection.accountLabel?.nilIfEmpty
    ?? "Account metadata not saved"
}

func googleDriveConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
    && connection.credentialOwnership == .relayOwned && !connection.userOwnedCredentialsRequired
    && connection.providerKey.localizedCaseInsensitiveContains(
      "google-drive-relay-owned-google-oauth")
    && connection.grantedScopes == ProviderConnectionService.googleDriveRelayOwnedOAuthScopes
    && connection.health.diagnostics["appVisibleFileCorpusEnforced"]?.bool == true
}

func googleDriveConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if googleDriveConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func googleSearchConsoleConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Google Search Console OAuth account"
}

func googleSearchConsoleConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func googleSearchConsoleConnectionIsAssignable(_ connection: MarketplaceProviderConnection) -> Bool
{
  guard googleSearchConsoleConnectionIsValid(connection),
    connection.appSlug == "google-search-console",
    connection.credentialOwnership == .relayOwned,
    connection.userOwnedCredentialsRequired == false,
    connection.grantedScopes == ProviderConnectionService.googleSearchConsoleRelayOwnedOAuthScopes,
    connection.health.diagnostics["readOnlyV1"]?.bool == true,
    connection.health.diagnostics["writesEnabled"]?.bool == false,
    connection.health.diagnostics["automaticPagination"]?.bool == false,
    connection.health.diagnostics["serviceAccountEnabled"]?.bool == false,
    connection.health.diagnostics["domainDelegationEnabled"]?.bool == false,
    let site = connection.health.diagnostics["selectedSiteUrl"]?.string?.nilIfEmpty
  else { return false }
  return site.hasPrefix("sc-domain:") || URL(string: site)?.scheme == "https"
}

func googleSearchConsoleConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String
{
  if googleSearchConsoleConnectionIsAssignable(connection) { return "Ready" }
  if googleSearchConsoleConnectionIsValid(connection) { return "Needs property" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func googleSearchConsoleAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty ?? connection.accountLabel?.nilIfEmpty
    ?? "Account metadata not saved"
}

func googleSearchConsoleSitePreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["selectedSiteUrl"]?.string?.nilIfEmpty ?? "No property saved"
}

func googleAnalyticsConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Google Analytics OAuth account"
}

func googleAnalyticsConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func googleAnalyticsConnectionIsAssignable(_ connection: MarketplaceProviderConnection) -> Bool {
  googleAnalyticsConnectionIsValid(connection)
    && connection.health.diagnostics["selectedPropertyId"]?.string?.nilIfEmpty != nil
}

func googleAnalyticsConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if googleAnalyticsConnectionIsAssignable(connection) { return "Ready" }
  if googleAnalyticsConnectionIsValid(connection) { return "Needs property" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func googleAnalyticsAccountPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty ?? connection.accountLabel?.nilIfEmpty
    ?? "Account metadata not saved"
}

func googleAnalyticsPropertyPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["selectedPropertyDisplayName"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["selectedPropertyName"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["selectedPropertyId"]?.string?.nilIfEmpty
    ?? "No GA4 property"
}

func microsoftClarityConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Microsoft Clarity project"
}

func postHogConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "PostHog OAuth project"
}

func postHogConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func postHogConnectionIsAssignable(_ connection: MarketplaceProviderConnection) -> Bool {
  postHogConnectionIsReady(connection)
}

func postHogConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if postHogConnectionIsAssignable(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func postHogProjectPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["projectName"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["projectId"]?.string?.nilIfEmpty
    ?? "Project ID optional"
}

func postHogOrganizationPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["organizationName"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["organizationId"]?.string?.nilIfEmpty
    ?? "Organization optional"
}

func postHogBaseURLPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["apiBaseURL"]?.string?.nilIfEmpty ?? "https://us.posthog.com"
}

func postHogTokenPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.secretReferenceIds.isEmpty
    ? "Missing key reference" : "phx_" + String(repeating: "*", count: 12)
}

func postHogLastCheckedText(_ connection: MarketplaceProviderConnection) -> String {
  guard let value = connection.lastCheckedAt?.nilIfEmpty else { return "Not checked" }
  let formatter = ISO8601DateFormatter()
  guard let date = formatter.date(from: value) else { return value }
  let relative = RelativeDateTimeFormatter()
  relative.unitsStyle = .full
  return relative.localizedString(for: date, relativeTo: Date())
}

func microsoftClarityConnectionIsAssignable(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected
}

func microsoftClarityConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func microsoftClarityConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if microsoftClarityConnectionIsReady(connection) { return "Ready" }
  if microsoftClarityConnectionIsAssignable(connection) { return "Saved" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func microsoftClarityProjectPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["projectLabel"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
    ?? connection.health.diagnostics["projectURL"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["projectId"]?.string?.nilIfEmpty
    ?? "Project metadata optional"
}

func microsoftClarityTokenPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.secretReferenceIds.isEmpty
    ? "Missing token reference" : "clarity_" + String(repeating: "*", count: 12)
}

func microsoftClarityLastCheckedText(_ connection: MarketplaceProviderConnection) -> String {
  guard let value = connection.lastCheckedAt?.nilIfEmpty else { return "Not checked" }
  let formatter = ISO8601DateFormatter()
  guard let date = formatter.date(from: value) else { return value }
  let relative = RelativeDateTimeFormatter()
  relative.unitsStyle = .full
  return relative.localizedString(for: date, relativeTo: Date())
}

func telemetryDeckConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "TelemetryDeck app"
}

func telemetryDeckConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func telemetryDeckConnectionIsAssignable(_ connection: MarketplaceProviderConnection) -> Bool {
  telemetryDeckConnectionIsReady(connection)
    && connection.health.diagnostics["namespace"]?.string?.nilIfEmpty != nil
    && connection.health.diagnostics["telemetryDeckAppId"]?.string?.nilIfEmpty != nil
}

func telemetryDeckConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if telemetryDeckConnectionIsAssignable(connection) { return "Ready" }
  if telemetryDeckConnectionIsReady(connection) { return "Needs app" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func telemetryDeckTokenPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.secretReferenceIds.isEmpty
    ? "Missing PAT reference" : "td_pat_" + String(repeating: "*", count: 10)
}

func telemetryDeckScopePreview(_ connection: MarketplaceProviderConnection) -> String {
  let namespace = connection.health.diagnostics["namespace"]?.string?.nilIfEmpty
  let appDisplayName = connection.health.diagnostics["appDisplayName"]?.string?.nilIfEmpty
  let appId = connection.health.diagnostics["telemetryDeckAppId"]?.string?.nilIfEmpty
  if let namespace, let label = appDisplayName ?? appId {
    return "\(namespace) / \(label)"
  }
  if let namespace {
    return namespace
  }
  if let label = appDisplayName ?? appId {
    return label
  }
  return "No app scope saved"
}

func telemetryDeckDefaultInsightPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["defaultInsightId"]?.string?.nilIfEmpty ?? "Optional"
}

func telemetryDeckLastCheckedText(_ connection: MarketplaceProviderConnection) -> String {
  guard let value = connection.lastCheckedAt?.nilIfEmpty else { return "Not checked" }
  let formatter = ISO8601DateFormatter()
  guard let date = formatter.date(from: value) else { return value }
  let relative = RelativeDateTimeFormatter()
  relative.unitsStyle = .full
  return relative.localizedString(for: date, relativeTo: Date())
}

func sentryConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Sentry organization"
}

func sentryConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func sentryConnectionIsAssignable(_ connection: MarketplaceProviderConnection) -> Bool {
  sentryConnectionIsReady(connection)
    && connection.health.diagnostics["organizationSlug"]?.string?.nilIfEmpty != nil
}

func sentryConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if sentryConnectionIsAssignable(connection) { return "Ready" }
  if sentryConnectionIsReady(connection) { return "Needs org" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func sentryTokenPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.secretReferenceIds.isEmpty
    ? "Missing token reference" : "sentry_" + String(repeating: "*", count: 12)
}

func sentryOrganizationPreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.health.diagnostics["organizationName"]?.string?.nilIfEmpty
    ?? connection.health.diagnostics["organizationSlug"]?.string?.nilIfEmpty
    ?? connection.connectedHandle?.nilIfEmpty
    ?? "Organization not saved"
}

func sentryProjectPreview(_ connection: MarketplaceProviderConnection) -> String {
  let project = connection.health.diagnostics["defaultProjectSlug"]?.string?.nilIfEmpty
  let environment = connection.health.diagnostics["defaultEnvironment"]?.string?.nilIfEmpty
  if let project, let environment {
    return "\(project) / \(environment)"
  }
  if let project {
    return project
  }
  if let environment {
    return environment
  }
  return "Optional"
}

func sentryLastCheckedText(_ connection: MarketplaceProviderConnection) -> String {
  guard let value = connection.lastCheckedAt?.nilIfEmpty else { return "Not checked" }
  let formatter = ISO8601DateFormatter()
  guard let date = formatter.date(from: value) else { return value }
  let relative = RelativeDateTimeFormatter()
  relative.unitsStyle = .full
  return relative.localizedString(for: date, relativeTo: Date())
}

func notionConnectionName(_ connection: MarketplaceProviderConnection) -> String {
  connection.accountLabel?.nilIfEmpty ?? "Notion token"
}

func notionConnectionIsValid(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.status == .connected && connection.health.state == .ready
}

func notionConnectionStatusText(_ connection: MarketplaceProviderConnection) -> String {
  if notionConnectionIsValid(connection) { return "Ready" }
  return ProviderConnectionService.providerStatusTitle(for: connection)
}

func notionTokenPreview(_ connection: MarketplaceProviderConnection) -> String {
  if connection.providerKey.contains("internal_connection_token") {
    return "notion_internal_" + String(repeating: "*", count: 8)
  }
  return "ntn_" + String(repeating: "*", count: 14)
}

func notionWorkspacePreview(_ connection: MarketplaceProviderConnection) -> String {
  connection.connectedHandle?.nilIfEmpty ?? "Workspace label not saved"
}

func notionCredentialModeLabel(_ connection: MarketplaceProviderConnection) -> String {
  if let label = connection.health.diagnostics["credentialModeLabel"]?.string?.nilIfEmpty {
    return label
  }
  if connection.providerKey.contains("internal_connection_token") {
    return "Internal connection token"
  }
  return "Personal access token"
}
