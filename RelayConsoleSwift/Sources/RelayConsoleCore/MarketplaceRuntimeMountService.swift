import CryptoKit
import Foundation

public struct MarketplaceRuntimeMountedApp: Codable, Equatable, Sendable {
    public var appId: RelayId
    public var appSlug: String
    public var appName: String
    public var installId: RelayId
    public var connectionId: RelayId?
    public var permissionMapId: RelayId?
    public var policyPreset: MarketplaceActionPolicyPreset?
    public var connected: Bool
    public var assignedAgentReady: Bool
    public var instructions: String
    public var tools: [RelayProviderWrapperTool]
    public var diagnostics: RelayProviderWrapperToolDiagnostics
    public var redactionStatus: String

    public init(
        appId: RelayId,
        appSlug: String,
        appName: String,
        installId: RelayId,
        connectionId: RelayId?,
        permissionMapId: RelayId?,
        policyPreset: MarketplaceActionPolicyPreset?,
        connected: Bool,
        assignedAgentReady: Bool,
        instructions: String,
        tools: [RelayProviderWrapperTool],
        diagnostics: RelayProviderWrapperToolDiagnostics,
        redactionStatus: String
    ) {
        self.appId = appId
        self.appSlug = appSlug
        self.appName = appName
        self.installId = installId
        self.connectionId = connectionId
        self.permissionMapId = permissionMapId
        self.policyPreset = policyPreset
        self.connected = connected
        self.assignedAgentReady = assignedAgentReady
        self.instructions = instructions
        self.tools = tools
        self.diagnostics = diagnostics
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceRuntimeCapabilitySnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var agentId: RelayId
    public var runtimeType: RuntimeType
    public var generatedAt: IsoTimestamp
    public var fingerprint: String
    public var apps: [MarketplaceRuntimeMountedApp]
    public var toolCount: Int
    public var rawProviderToolExposure: Bool
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        agentId: RelayId,
        runtimeType: RuntimeType,
        generatedAt: IsoTimestamp,
        fingerprint: String,
        apps: [MarketplaceRuntimeMountedApp],
        toolCount: Int,
        rawProviderToolExposure: Bool,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.agentId = agentId
        self.runtimeType = runtimeType
        self.generatedAt = generatedAt
        self.fingerprint = fingerprint
        self.apps = apps
        self.toolCount = toolCount
        self.rawProviderToolExposure = rawProviderToolExposure
        self.redactionStatus = redactionStatus
    }
}

extension MarketplaceRuntimeCapabilitySnapshot {
    public var mountedToolNames: [String] {
        apps.flatMap { $0.tools.map(\.toolName) }.sorted()
    }

    public func confirmedRegisteredToolSnapshot(registeredToolNames: Set<String>) -> MarketplaceRuntimeCapabilitySnapshot {
        let filteredApps = apps.map { app -> MarketplaceRuntimeMountedApp in
            var next = app
            next.tools = app.tools.filter { registeredToolNames.contains($0.toolName) }
            return next
        }
        let nextToolCount = filteredApps.reduce(0) { $0 + $1.tools.count }
        var next = self
        next.apps = filteredApps
        next.toolCount = nextToolCount
        return next
    }
}

public final class MarketplaceRuntimeMountService {
    public static let runtimeToolBridgeVersion = "runtime-tools-v1"

    private let data: LocalDataService
    private let wrapperTools: RelayProviderWrapperToolCompilerService

    public init(data: LocalDataService, wrapperTools: RelayProviderWrapperToolCompilerService? = nil) {
        self.data = data
        self.wrapperTools = wrapperTools ?? RelayProviderWrapperToolCompilerService(data: data)
    }

    public func snapshot(
        context: ServiceRequestContext,
        agent: AgentWithBinding,
        now: Date = Date()
    ) throws -> MarketplaceRuntimeCapabilitySnapshot {
        try requireReadAccess(context: context)
        guard agent.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace runtime mount agent workspace does not match the request context.")
        }
        let installs = try data.listMarketplaceInstalls(workspaceId: context.workspaceId, limit: 500)
            .filter { Self.isActiveInstall($0) && $0.agentId == agent.id && $0.runtimeFormat == agent.binding.runtimeType }
            .sorted { lhs, rhs in
                if lhs.appSlug == rhs.appSlug {
                    return lhs.id < rhs.id
                }
                return lhs.appSlug < rhs.appSlug
            }
        var apps = try installs.compactMap { install -> MarketplaceRuntimeMountedApp? in
            guard let app = try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: install.appId),
                  Self.isMountableProviderApp(app),
                  app.runtimeSupport.contains(agent.binding.runtimeType),
                  app.roleManifest.compatibleRuntimeTypes.contains(agent.binding.runtimeType)
            else {
                return nil
            }
            let surface = try wrapperTools.compileSurface(
                context: context,
                appIdOrSlug: app.id,
                connectionId: install.connectionId,
                installId: install.id,
                agentId: agent.id,
                now: now
            )
            return MarketplaceRuntimeMountedApp(
                appId: app.id,
                appSlug: app.slug,
                appName: app.name,
                installId: install.id,
                connectionId: surface.connectionId,
                permissionMapId: surface.permissionMapId,
                policyPreset: surface.policyPreset,
                connected: surface.diagnostics.connected,
                assignedAgentReady: surface.diagnostics.assignedAgentReady,
                instructions: Self.instructions(for: app),
                tools: surface.tools.sorted { $0.toolName < $1.toolName },
                diagnostics: surface.diagnostics,
                redactionStatus: "private-state-excluded"
            )
        }
        if isRelayConsoleResidentAgent(agent) {
            apps.append(Self.residentRelayConsoleApp(
                workspaceId: context.workspaceId,
                agentId: agent.id,
                runtimeType: agent.binding.runtimeType
            ))
        }
        let toolCount = apps.reduce(0) { $0 + $1.tools.count }
        let stablePayload = Self.fingerprintPayload(
            workspaceId: context.workspaceId,
            agentId: agent.id,
            runtimeType: agent.binding.runtimeType,
            apps: apps
        )
        return MarketplaceRuntimeCapabilitySnapshot(
            workspaceId: context.workspaceId,
            agentId: agent.id,
            runtimeType: agent.binding.runtimeType,
            generatedAt: ISO8601DateFormatter.relayConsole.string(from: now),
            fingerprint: Self.sha256(stablePayload),
            apps: apps,
            toolCount: toolCount,
            rawProviderToolExposure: false,
            redactionStatus: "private-state-excluded"
        )
    }

    public func renderPromptBlock(_ snapshot: MarketplaceRuntimeCapabilitySnapshot) -> String? {
        guard !snapshot.apps.isEmpty else { return nil }
        var lines: [String] = [
            "[Relay Marketplace Provider Capabilities]",
            "Relay Console mounted installed Marketplace apps as brokered runtime tools for this agent.",
            "Use only callable tools exposed by the harness and the concise app instructions below; do not look for provider credentials, raw MCP servers, raw provider tool dumps, or unlisted provider actions.",
            "If a callable Relay provider tool is approval-required, prepare the exact payload and wait for Relay approval before execution.",
            "Snapshot: \(snapshot.fingerprint)"
        ]
        for app in snapshot.apps {
            lines.append("")
            lines.append("App: \(app.appName) (\(app.appSlug))")
            lines.append("- Connection: \(app.connected ? "connected" : "not connected")")
            if let policy = app.policyPreset?.rawValue {
                lines.append("- Policy: \(policy)")
            }
            lines.append("- Instructions: \(app.instructions)")
            if app.tools.isEmpty {
                lines.append("- Runtime tools: none currently mounted by policy")
                continue
            }
            let readOnlyCount = app.tools.filter(\.readOnly).count
            let approvalCount = app.tools.filter(\.requiresApproval).count
            let autoExecuteCount = app.tools.filter(\.autoExecutes).count
            lines.append("- Runtime tools: \(app.tools.count) brokered callable Relay tool(s), \(readOnlyCount) read-only, \(approvalCount) approval-required, \(autoExecuteCount) auto-execute.")
        }
        return lines.joined(separator: "\n")
    }

    public func mountPrompt(_ prompt: String, snapshot: MarketplaceRuntimeCapabilitySnapshot) -> String {
        guard let block = renderPromptBlock(snapshot) else {
            return prompt
        }
        return [block, "", "[User message]", prompt].joined(separator: "\n")
    }

    public static func metadata(for snapshot: MarketplaceRuntimeCapabilitySnapshot) -> JSONRecord {
        [
            "marketplaceRuntimeMount": .object([
                "fingerprint": .string(snapshot.fingerprint),
                "generatedAt": .string(snapshot.generatedAt),
                "appCount": .number(Double(snapshot.apps.count)),
                "toolCount": .number(Double(snapshot.toolCount)),
                "appSlugs": .array(snapshot.apps.map { .string($0.appSlug) }),
                "rawProviderToolExposure": .bool(snapshot.rawProviderToolExposure),
                "redactionStatus": .string(snapshot.redactionStatus),
                "runtimeToolBridgeVersion": .string(Self.runtimeToolBridgeVersion)
            ])
        ]
    }

    private static func isActiveInstall(_ install: MarketplaceInstallRecord) -> Bool {
        install.installStatus == .installed || install.installStatus == .requested
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .member, .operator, .approver], context: context) {
            throw denied
        }
    }

    private static func isMountableProviderApp(_ app: MarketplaceCatalogApp) -> Bool {
        app.sourceType == .externalProvider
            && app.availability == .available
            && !app.localAppExcluded
            && !app.reviewExcluded
            && !app.slug.localizedCaseInsensitiveContains("paperclip")
    }

    private static func instructions(for app: MarketplaceCatalogApp) -> String {
        switch app.slug {
        case "x":
            return "Use brokered Relay wrappers for X timeline reads, drafts, posts, and replies. X credentials stay in Relay Keychain references; never request or inspect environment variables."
        case "exa-search":
            return "Use brokered Relay wrappers for focused web research and answer retrieval. Exa credentials stay in Relay Keychain references; keep searches narrow and cite source URLs."
        case "linkedin":
            return
                """
                    Use only the three brokered Relay LinkedIn wrappers for bounded connected-member identity, local text drafting, and intentional public text-post publishing. Publishing follows approval or explicitly selected Direct \
                    writes while still routing through Relay policy, idempotency and audit. Never expose email, picture data, tokens or client credentials; read member posts/comments/likes; publish comments, likes, media, documents, \
                    articles, reshares, polls, celebrations, mentions or organization content; access DMs, invitations, connections, enrichment, network/search/scraping, advertising, leads or learning; use raw/RPC/MCP tools, retries or \
                    pagination.
                    """
        case "gmail":
            return
                """
                    Use brokered Relay wrappers for Gmail searches, message reads, draft preparation, and email sends according to the selected approval or Direct writes policy. Gmail OAuth credentials stay in Relay Keychain references; \
                    keep message content task-scoped and do not request or expose provider secrets.
                    """
        case "google-docs":
            return
                """
                    Use brokered Relay wrappers for Google Docs reads, local document preparation, document creation, and document updates according to the selected approval or Direct writes policy. Google OAuth credentials stay in Relay \
                    Keychain references; read only user-specified document URLs or IDs, keep document text task-scoped, and never invoke raw Google Workspace MCP tools.
                    """
        case "google-search-console":
            return
                """
                    Use only brokered Relay wrappers for Google Search Console property discovery, bounded Search Analytics, URL Inspection, and sitemap status reads. Google OAuth credentials stay in Relay Keychain references; use only the \
                    webmasters.readonly scope, keep reads property-scoped and task-scoped, and do not request Search Console writes, raw REST calls, Testing Tools APIs, sitemap submission or deletion, or property administration.
                    """
        case "slack":
            return
                """
                    Use brokered Relay wrappers for Slack channel search, bounded conversation history, user lookup, message drafts, and approval-scoped message sends according to the selected approval or Direct writes policy. Slack OAuth \
                    tokens stay in Relay Keychain references; keep reads workspace/channel-scoped, never request or expose Slack tokens, and do not use raw Slack API calls, broad exports, workspace administration, or unapproved bulk \
                    messaging.
                    """
        case "github":
            return
                """
                    Use brokered Relay wrappers for GitHub repository search, bounded issue and pull request reads, local comment preparation, and approval-scoped issue or pull request comments according to the selected approval or Direct \
                    writes policy. GitHub OAuth tokens stay in Relay Keychain references; keep reads repository-scoped, never request or expose GitHub tokens, and do not use raw GitHub API calls, workflow mutation, repository \
                    administration, branch protection changes, or broad code exports.
                    """
        case "gitlab":
            return
                """
                    Use brokered Relay wrappers for GitLab project search, bounded issue and merge request reads, local comment preparation, and approval-scoped issue or merge request comments according to the selected approval or Direct \
                    writes policy. GitLab OAuth tokens stay in Relay Keychain references; keep reads project-scoped, never request or expose GitLab tokens, and do not use raw GitLab API calls, CI/CD mutation, project or group \
                    administration, branch protection changes, secret mutation, or broad code exports.
                    """
        case "bitbucket":
            return
                """
                    Use brokered Relay wrappers for Bitbucket repository search, bounded issue and pull request reads, local comment preparation, and approval-scoped issue or pull request comments according to the selected approval or \
                    Direct writes policy. Bitbucket OAuth tokens stay in Relay Keychain references; keep reads repository-scoped, never request or expose Bitbucket tokens, and do not use raw Bitbucket API calls, pipeline mutation, \
                    repository or workspace administration, branch restriction changes, secret mutation, or broad code exports.
                    """
        case "linear":
            return
                """
                    Use brokered Relay wrappers for Linear issue search, bounded issue and project reads, local issue comment preparation, and approval-scoped issue comments or issue creation according to the selected approval or Direct \
                    writes policy. Linear OAuth tokens stay in Relay Keychain references; keep reads workspace-scoped, never request or expose Linear tokens, and do not use raw Linear GraphQL/API calls, workspace administration, webhook \
                    mutation, team administration, secret mutation, or broad workspace exports.
                    """
        case "asana":
            return
                """
                    Use brokered Relay wrappers for bounded Asana workspace or project task search, project listing, task detail, local task preparation, and approval-scoped task creation or updates according to the selected approval or \
                    Direct rights policy. Asana OAuth tokens stay in Relay Keychain references; use workspace, project, task, assignee, due date, completion, and notes context only through the registered wrappers. Never request tokens or \
                    use raw Asana API/MCP calls, task deletion, project or workspace administration, webhook mutation, bulk mutation, or broad exports.
                    """
        case "trello":
            return
                """
                    Use brokered Relay wrappers for bounded Trello board discovery, board/list/card reads, board and card search, local card preparation, and approval-scoped card creation, updates, or comments according to Standard or \
                    Direct rights. Trello API keys, user tokens, and OAuth secrets stay in Relay Keychain references. Never request provider secrets or use raw Trello REST calls, card/list deletion, board or Workspace administration, member \
                    or Power-Up administration, webhook mutation, bulk mutation, attachment export, or broad crawling.
                    """
        case "clickup":
            return
                """
                    Use brokered Relay wrappers to list authorized ClickUp Workspaces, search bounded Workspace tasks, inspect List tasks or one useful task, prepare exact task changes locally, and create, update, or comment only through \
                    approval-scoped or Direct rights. OAuth tokens stay in Relay Keychain references. Never request provider secrets or use raw ClickUp REST/MCP calls, task deletion, Workspace/Space/Folder/List administration, custom-field \
                    or dependency mutation, webhooks, bulk mutation, attachment export, or broad crawling.
                    """
        case "monday-com":
            return
                """
                    Use brokered Relay wrappers to list authorized Monday.com boards, inspect bounded board items with useful group and column context, read one item or its discussion updates, prepare exact item changes locally, and create, \
                    update, or comment only through approval-scoped or Direct rights. OAuth tokens stay in Relay Keychain references. Never request provider secrets or use raw GraphQL/MCP, item deletion, \
                    Workspace/board/group/column/user/team administration, schema mutation, subscriptions/webhooks, file mutation, bulk mutation, or broad export.
                    """
        case "airtable":
            return
                """
                    Use brokered Relay wrappers to list OAuth-authorized Airtable bases, inspect bounded table/field/view schema, read useful records or record comments, prepare exact record changes locally, and create, update, or comment \
                    only through approval-scoped or Direct rights. Access and rotating refresh tokens stay in Relay Keychain references. Never request provider secrets or use raw REST/MCP, record deletion, Workspace/base/table/field/view \
                    administration, schema or webhook mutation, attachment transfer, bulk sync/upsert, or broad export.
                    """
        case "dropbox":
            return
                """
                    Use brokered Relay wrappers to list bounded Dropbox folders, search or inspect useful file/folder metadata, prepare bounded UTF-8 text uploads locally, and create folders or upload, copy, or move entries only through \
                    approval-scoped or Direct rights. Access and refresh tokens stay in Relay Keychain references. Never request provider secrets or use raw Dropbox API calls, deletion, sharing/team administration, arbitrary binary \
                    transfer, recursive export/sync, or scope expansion.
                    """
        case "box":
            return
                """
                    Use brokered Relay wrappers to list bounded Box folder items, search or inspect useful file/folder metadata, prepare bounded UTF-8 text uploads locally, and create folders or upload, copy, or move items only through \
                    approval-scoped or Direct rights. Access and single-use rotating refresh tokens stay in Relay Keychain references. Never request provider secrets or use raw Box API calls, deletion, collaboration/enterprise \
                    administration, arbitrary binary transfer, broad export/sync, As-User impersonation, or scope expansion.
                    """
        case "figma":
            return
                """
                    Use brokered Relay wrappers only with an explicit task-scoped Figma file key to inspect bounded file metadata, document/page/frame/node/text context, and comments, then prepare or post/reply to comments through \
                    approval-scoped or Direct rights. OAuth tokens stay in Relay Keychain references. Never request secrets or use project/team discovery, broad file ingestion, raw REST/MCP, image/export URLs, \
                    design/dev-resource/variable/library/webhook mutation, comment deletion/reactions, or organization administration.
                    """
        case "miro":
            return
                """
                    Use brokered Relay wrappers only to inspect bounded Miro boards and cursor-paginated items while preserving item type, content, style, position, geometry, parent, and creator semantics. Prepare writes locally, then \
                    create sticky notes or cards or update supported item types through approval-scoped or Direct rights. OAuth tokens stay in Relay Keychain references. Never request secrets or delete items, administer boards, mutate \
                    connectors/tags/webhooks, transfer images/documents/embeds, broadly ingest boards, or call raw Miro APIs.
                    """
        case "canva":
            return
                """
                    Use brokered Relay wrappers only to find bounded Canva design metadata, inspect one design, list typed folder items with explicit continuation, and prepare or create stable preset/custom blank designs through \
                    approval-scoped or Direct rights. Treat edit/view and thumbnail links as temporary user-bound metadata; never fetch or persist their content. OAuth tokens stay in Relay Keychain references. Never request secrets or use \
                    preview APIs, design content/pages, exports, binary downloads, assets, folder/permission/comment/webhook mutation, autofill, resize/merge, deletion, broad crawling, or raw Canva APIs.
                    """
        case "webflow":
            return
                """
                    Use brokered Relay wrappers only to inspect authorized Webflow sites, collection schemas, and bounded staged CMS items. Resolve field slugs and types from collection schema before preparing exact fieldData patches. \
                    Update staged items or publish explicit reviewed item IDs only through approval-scoped or Direct rights; staged update and publication are distinct operations. The non-refreshable Webflow App access token stays in one \
                    Relay Keychain reference and is replaced only by reauthorization. Never request secrets or create, delete, archive, or unpublish CMS content; publish a full site; mutate pages, custom code, forms, assets, ecommerce, or \
                    webhooks; broadly ingest content; or call raw/beta Webflow APIs.
                    """
        case "wordpress-com":
            return
                """
                    Use brokered Relay wrappers only to inspect the OAuth-authorized WordPress.com or Jetpack site and bounded useful post/editor metadata. Prepare changes locally, create drafts, update existing drafts only after an exact \
                    modified-time precondition check, and publish an explicit reviewed draft through approval-scoped or Direct rights. Draft creation never publishes. The server-side OAuth access token stays in one Relay Keychain reference \
                    and is replaced by reauthorization; no refresh token or global grant is exposed. Never request secrets or delete/restore/bulk-mutate posts, transfer media, mutate \
                    comments/taxonomy/menus/widgets/themes/plugins/users/sharing/Reader state, access stats or hosting/SSH, request global scope, batch requests, broadly ingest content, or call raw WordPress.com APIs.
                    """
        case "contentful":
            return
                """
                    Use brokered Relay wrappers only within the explicitly authorized Contentful space and environment IDs. Inspect bounded content-type schema and localized entry fields, prepare complete field payloads locally, create \
                    unpublished entries, update drafts with exact X-Contentful-Version, and publish an explicit reviewed version through approval-scoped or Direct rights. Contentful does not merge omitted fields. The CMA OAuth token stays \
                    in one Keychain reference and is replaced by reauthorization. Never request secrets or delete/archive/unpublish entries, mutate assets/schema/locales/environments/spaces/org/users, manage \
                    releases/schedules/webhooks/apps/tokens, use delivery/preview surfaces, broadly export, switch unapproved regions, or call raw Contentful APIs.
                    """
        case "sanity":
            return
                """
                    Use brokered Relay wrappers only for the connected Sanity project and dataset. Discover bounded document types, read bounded published and draft documents, prepare exact changes locally, create drafts, update drafts with \
                    an exact revision, and publish one explicit reviewed draft through approval-scoped or Direct rights. The customer-owned robot token stays in one Keychain reference. Never request secrets or delete/unpublish/bulk-mutate \
                    content, administer projects/datasets/members/roles/tokens/CORS/schema/webhooks/releases/assets/AI, run arbitrary GROQ, broadly export, automatically paginate, or call raw Sanity APIs.
                    """
        case "strapi-cloud":
            return
                """
                    Use brokered Relay wrappers only for the exact connected strapiapp.com project and explicitly allowed plural API IDs. Read bounded draft or published Strapi 5 documents, prepare exact changes locally, create drafts, \
                    update drafts after an exact updatedAt preflight, and publish one explicit reviewed draft through approval-scoped or Direct rights. The customer-owned Custom Content API token stays in one Keychain reference. Never \
                    request secrets or delete/unpublish/discard/bulk-mutate content, administer users/roles/tokens/schema/plugins/projects/deployments/releases/workflows/webhooks/assets/uploads, use arbitrary filters/population/custom \
                    endpoints, broadly export, automatically paginate, or call raw REST or GraphQL APIs.
                    """
        case "shopify":
            return
                """
                    Use brokered Relay wrappers only for the exact connected Shopify shop. Inspect bounded products and publications, prepare changes locally, force creation and editing to DRAFT, and treat updatedAt as a preflight guard \
                    rather than atomic concurrency. Activation and channel publication are separate explicit writes through approval-scoped or Direct rights. Expiring offline access and rotating refresh tokens stay in Keychain references. \
                    Never request secrets or access customers/orders/payments/fulfillment, mutate inventory/prices/variants, delete/archive/unpublish, transfer media/files, change themes/discounts/billing/admin, run bulk operations, or call \
                    raw GraphQL.
                    """
        case "woocommerce":
            return
                """
                    Use brokered Relay wrappers only for the exact authorized public HTTPS WooCommerce store and static wc/v3 product/category routes. Create and update drafts first, treat date_modified_gmt as a preflight guard rather than \
                    atomic concurrency, and publish only an explicit reviewed draft. Consumer key/secret stay in Keychain references and use Basic auth headers only. Never request secrets, use query-string authentication, follow redirects, \
                    access private origins, expose raw REST/MCP, or access orders/customers/payments/settings and broader commerce/admin surfaces.
                    """
        case "stripe":
            return
                """
                    Use only the three mounted read-only Relay Stripe wrappers for bounded balance and privacy-redacted PaymentIntent status. Preserve integer minor-unit amounts, lowercase currency, and livemode; never infer settlement \
                    beyond Stripe available/pending fields or expose client secrets, customers, payment instruments, contact/shipping data, metadata, descriptions, raw errors, writes, refunds, payouts, transfers, disputes, Connect, billing, \
                    expansions, or raw API/MCP.
                    """
        case "xero":
            return
                """
                    Use only the three mounted read-only Relay Xero wrappers for the exact connected ORGANISATION tenant and bounded privacy-redacted invoice status. Preserve decimal amounts, currency, invoice dates, due dates, status, and \
                    opaque ContactID semantics. Invoice reads are approval-gated. Never expose contact identity, addresses, line items, references, branding, attachments, payments, bank data, writes, broader \
                    reports/payroll/files/assets/projects/admin surfaces, or raw API/MCP.
                    """
        case "quickbooks":
            return
                """
                    Use only the five mounted read-only Relay QuickBooks Online wrappers for the exact connected company realm, bounded privacy-redacted Invoice balances, at most ten pay-type assignments for one exact numeric employee ID, \
                    and one exact redacted Payments charge status. Preserve provider amounts, currencies, dates, status, and capture state without inferring settlement. Invoice, Payroll Compensation, and Payments charge reads are \
                    approval-gated. The Payroll Compensation wrapper is production-only and returns only pay-type IDs, names, active state, and types. The Payments wrapper returns only charge ID, status, amount, currency, created time, and \
                    capture state. Never expose customer or employee identity, payment instruments, authorization codes, tokens, receipts, refunds, contact/address data, lines, notes, tax, attachments, writes, payment mutation, banking, \
                    reports, payslips, deductions, benefits, tax identifiers, bank details, payroll execution, arbitrary queries, or raw API/MCP.
                    """
        case "freshbooks":
            return
                """
                    Use only the three mounted read-only Relay FreshBooks wrappers for selectable business/account memberships and bounded privacy-redacted Invoice money/status. Preserve provider amount strings, currency codes, dates, \
                    v3/display/payment statuses, and opaque CustomerId; never infer overdue, cash, tax, or converted-currency state. Invoice reads are approval-gated. Never expose identity/client names, contact/address data, notes, terms, \
                    lines, payment details, links, attachments, writes, broader accounting/project/time/team data, arbitrary searches/includes, or raw API/MCP.
                    """
        case "wave":
            return
                """
                    Use only the three mounted read-only Relay Wave Accounting wrappers for the exact connected business and bounded privacy-redacted Invoice money/status. Preserve provider amount strings, currency codes, dates, status, \
                    pagination, and opaque CustomerId; never infer cash, tax, or converted-currency state. Invoice reads are approval-gated. Never expose customer identity, lines, tax, memos, URLs, payment controls/history, writes, broader \
                    accounting resources, payment-wallet APIs, full-access tokens, arbitrary GraphQL, or unrelated Wave meeting APIs/MCP.
                    """
        case "freeagent":
            return
                """
                    Use only the three mounted read-only Relay FreeAgent wrappers for the exact token-bound company and bounded privacy-redacted Invoice value/status. Preserve provider decimal strings, currencies, dates, references, \
                    statuses, and opaque contact/project IDs; never infer tax, cash, or converted-currency state. Invoice reads are approval-gated. FreeAgent OAuth inherits the user's permission level, but identity, lines, comments, tax, \
                    banking, payments, PDF/timeline, writes, broader accounting, the separate Practice API, XML, and arbitrary paths remain blocked.
                    """
        case "salesforce":
            return
                """
                    Use only the three mounted approval-gated Relay Salesforce wrappers for the exact connected org and at most 25 Accounts or Opportunities. Preserve Salesforce IDs, stages, amounts, close dates, probabilities, \
                    IsClosed/IsWon, and modification times without inferring forecast, currency, or revenue. Never expose contacts, leads, users, activities, notes, files, email, custom objects/fields, writes, queryAll, bulk export, \
                    arbitrary SOQL/REST, broader APIs, or frontdoor sessions.
                    """
        case "hubspot":
            return
                """
                    Use only the three mounted approval-gated Relay HubSpot wrappers for the exact connected account and at most 25 Companies or Deals. Preserve HubSpot record IDs, amount strings, pipeline/stage IDs, dates, and modification \
                    times without inferring forecast, currency, probability, or revenue. Never expose contacts, owners, engagements, tickets, custom objects/properties, associations/history, writes, exports, arbitrary \
                    search/filter/property/path, webhooks, extensions, or legacy OAuth APIs.
                    """
        case "pipedrive":
            return
                """
                    Use only the three mounted approval-gated Relay Pipedrive wrappers for the exact connected company and at most 25 Organizations or Deals. Preserve Pipedrive IDs, value, currency, status, pipeline/stage IDs, expected \
                    close dates, and update times without inferring forecast, probability, or revenue. Never expose persons, owners, activities, mail, notes/files, participants, products/leads/projects, filters/statistics/custom fields, \
                    writes, archived data, exports, search, arbitrary parameters, or API tokens.
                    """
        case "zoho":
            return
                """
                    Use only the three mounted Relay Zoho CRM reads for the exact consent-selected organization, environment, authorizing user, regional Accounts origin, and token API domain: page one with at most twenty-five redacted \
                    Account summaries, page one with at most twenty-five redacted Deal summaries, and one exact positive numeric Deal ID. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never \
                    expose OAuth tokens, call another organization, environment, product, region, scope, origin, module, path, field set, method, page, limit, sort, filter, search, COQL, GraphQL, custom view, or raw request, access leads, \
                    contacts, personal details, other users, activities, notes, files, participants, followers, campaigns, cases, products, quotes, orders, invoices, forecasts, territories, metadata, custom modules, or related lists, mutate \
                    records, paginate, use bulk APIs or notifications, synchronize, download, import, or export.
                    """
        case "copper":
            return
                """
                    Use only the three mounted approval-gated Relay Copper wrappers for the exact token-bound account and at most 25 Opportunities. Preserve Copper Account/Opportunity IDs, names, company name, monetary value/unit, status, \
                    priority, pipeline/stage IDs, close date, win probability, and timestamps without inferring forecast or revenue. Copper's only OAuth scope grants full read/modify access, but People, Leads, Users, contact data, \
                    activities, descriptions, custom fields, tags, files, relationships, tasks/projects, writes, webhooks, arbitrary search/path/body, API-key headers, and exports remain blocked.
                    """
        case "close":
            return
                """
                    Use only the three mounted approval-gated Relay Close wrappers for the exact Organization and at most 25 Opportunities. In Close, Organizations are team environments and prospect companies are Leads. Preserve \
                    Opportunity/Lead/pipeline/status IDs and labels, value/currency/period, confidence, expected values, and dates without exposing Contacts, Users, memberships, notes, email/phone, activities, attachments, custom fields, \
                    writes, arbitrary queries/reports, or exports. Close's broad full-access OAuth scopes remain confined by Relay.
                    """
        case "zendesk":
            return
                """
                    Use only the three mounted approval-gated Relay Zendesk Support wrappers for the exact connected subdomain: ticket count, at most 25 updated-recent privacy-redacted ticket summaries, and one exact ticket summary. \
                    Preserve ticket subject, status, priority, type, opaque organization/group/brand/form IDs, due/created/updated times, and satisfaction score. Never expose requester/submitter/assignee identity, email/phone, descriptions, \
                    comments/audits, attachments, collaborators/followers, tags/custom fields, writes, users/organizations, admin automation, impersonation, raw search/export, or other Zendesk products.
                    """
        case "intercom":
            return
                """
                    Use only the three mounted approval-gated Relay Intercom wrappers for the exact connected workspace and documented region: conversation count, at most 25 privacy-redacted conversation metadata summaries, and one exact \
                    conversation metadata summary. Preserve title, state, priority, operational timestamps/flags, opaque routing IDs, and bounded operational counts. Never expose message bodies, contacts, teammate identity, conversation \
                    parts, attachments, URLs, tags, custom attributes, linked tickets/objects, ratings, writes, People/Companies/Admin lists, broader products, raw search, pagination, or export.
                    """
        case "help-scout":
            return
                """
                    Use only the three mounted approval-gated Relay Help Scout Inbox wrappers for the exact connected company: active Conversation count, at most 25 newest active privacy-redacted Conversation metadata summaries, and one \
                    exact Conversation metadata summary. Preserve subject, status/state/type, opaque mailbox/routing IDs, operational timestamps, waiting/source/snooze semantics, and published-thread count. Never expose previews or thread \
                    bodies, customer/user identity, email/phone/cc/bcc, links, tags/custom fields, attachments, writes, broader account/Docs/Beacon surfaces, raw search/filter/embed, pagination, or export.
                    """
        case "front":
            return
                """
                    Use only the two mounted approval-gated Relay Front Core API wrappers for the exact connected company and approved shared-resource grant: at most 25 newest company-visible privacy-redacted Conversation metadata summaries \
                    and one exact cnv_ Conversation summary. Preserve subject, Front status/ticket/type, created/waiting times, and privacy flag. Never expose messages, comments, drafts, bodies, recipients, teammate/contact identity or \
                    handles, tags/custom fields, links, attachments, private resources, writes, broader company resources, raw search/query/page tokens, MCP tools, pagination, or export.
                    """
        case "teamwork":
            return
                """
                    Use only the three mounted approval-gated Relay Teamwork V3 wrappers for the exact connected installation: at most 25 accessible Project summaries, at most 25 accessible Task summaries, and one exact positive-ID Task \
                    summary. Preserve Teamwork names, native status/type, Tasklist/parent relationships, privacy/star flags, and dates without inventing completion or priority semantics. Never expose descriptions, comments, \
                    people/assignees, identity, files, links, tags/custom fields, notebooks/messages, time/billing/budgets, included objects, writes, arbitrary origins/paths/fields/filters/search, pagination, raw tools, or export.
                    """
        case "basecamp":
            return
                """
                    Use only the three mounted approval-gated Relay Basecamp wrappers for the exact connected bc3 account: first-page bounded Project summaries, one exact positive-ID Project, and one exact positive-ID To-do. Preserve \
                    Basecamp Project/Bucket, recording status, independent To-do completion, client visibility, dates, and opaque hierarchy semantics. Never expose descriptions, dock contents, people/assignees/identity, comments/boosts, \
                    URLs, attachments, messages/docs/chat/forwards, schedules/timesheets/reports, writes, arbitrary query/search/path, Link pagination, raw tools, or export.
                    """
        case "wrike":
            return
                """
                    Use only the three mounted approval-gated Relay Wrike API v4 wrappers for the exact account and provider-returned regional host: at most 25 Project summaries, at most 25 updated-recent Task summaries, and one exact \
                    opaque-ID Task. Preserve Wrike title, status, importance, type, Project status, and dates. Never expose descriptions, people/assignees/identity, custom fields/status metadata, sharing/followers, attachments, comments, \
                    timelogs/effort/billing, dependencies, links, writes, arbitrary fields/filters/search/path/host, page tokens, raw MCP/API tools, or export.
                    """
        case "smartsheet":
            return
                """
                    Use the mounted Relay Smartsheet wrappers for the exact connected account. Bounded sheet and row reads may run directly; use the full API action for other documented Smartsheet API 2.0 operations, requiring approval in \
                    Safe and running directly only under Dangerously skip permissions. Preserve Smartsheet account roles, sheet sharing permissions, request bounds, audits, and provider limits; never expose OAuth credentials or send \
                    requests to an unbound origin.
                    """
        case "todoist":
            return
                """
                    Use the mounted Relay Todoist wrappers for the exact connected user. Bounded project and active-task reads may run directly; use the full API action for other documented Todoist API v1 operations, requiring approval in \
                    Safe and running directly only under Dangerously skip permissions. Preserve exact-user binding, request bounds, audits, and Todoist's own account permissions; never expose OAuth credentials or send requests to an unbound \
                    origin.
                    """
        case "ticktick":
            return
                """
                    Use the mounted Relay TickTick wrappers for the connected OAuth grant. Bounded project and exact task reads may run directly; use the full API action for other documented TickTick Open API v1 operations, requiring \
                    approval in Safe and running directly only under Dangerously skip permissions. Preserve fixed-origin routing, request bounds, audits, and TickTick's own permissions; never expose OAuth credentials, claim an undocumented \
                    user identity or refresh/revocation lifecycle, or send requests to an unbound origin.
                    """
        case "harvest":
            return
                """
                    Use only the three mounted approval-gated Relay Harvest API v2 wrappers for the exact Harvest account and API user: at most 25 active Project Assignment summaries, at most 25 current-user Time Entries from a fixed \
                    rolling fourteen-day window, and one exact positive-ID Time Entry. Preserve project/task names and IDs, entry date/hours/start/end/running state, and timestamps. Never expose descriptions, clients, people/identity, \
                    billable/billed/invoice/expense/rate/cost/budget/approval/external-reference data, reports/admin, writes/timers, arbitrary accounts/users/dates/filters/paths/page links/page sizes, automatic pagination, raw APIs, or \
                    export.
                    """
        case "calendly":
            return
                """
                    Use only the three mounted approval-gated Relay Calendly API v2 wrappers for the exact OAuth user/current organization: at most 25 active Event Type summaries, at most 25 active Scheduled Events in the next fourteen \
                    days, and one exact UUID Scheduled Event. Preserve type/event identity, name, status, duration, slug/safe scheduling URL, start/end, bounded counts, and timestamps. Never expose invitee/contact identity or email, \
                    questions/answers, descriptions/notes, locations/conferencing, tracking/UTM, cancellation/reschedule links, broader organization/membership/routing/availability/webhook data, writes, arbitrary \
                    users/organizations/dates/status/paths/cursors/page sizes, automatic pagination, hosted MCP/raw APIs, or export.
                    """
        case "ontraport":
            return
                """
                    Use the mounted Relay Ontraport wrappers only for the exact customer-owned App ID and API key. Documented bounded reads may run directly; CRM, automation, task, deletion, messaging, invoice, payment, refund, \
                    subscription, and commerce mutations require approval in Safe and run directly only under Dangerously skip permissions. Never expose credentials, mount raw MCP, change the fixed hosted-MCP origin, bypass Ontraport role \
                    or key permissions, or run unbounded transfers.
                    """
        case "bitrix24":
            return
                """
                    Use only the three mounted Relay Bitrix24 reads for the exact cloud portal and incoming-webhook owner: bounded basic profile, at most twenty-five first-page Deal summaries, and one exact Deal. Every read requires \
                    approval in Safe and runs directly only under Dangerously skip permissions. Never expose the webhook URL, call another host or REST method, access contacts or communications, mutate records, add filters or fields, \
                    paginate, batch, synchronize, or export.
                    """
        case "agile-crm":
            return
                """
                    Use only the two mounted Relay Agile CRM reads for the exact validated tenant and account email: at most twenty-five first-page Deal summaries and one exact positive-ID Deal. Every read requires approval in Safe and runs \
                    directly only under Dangerously skip permissions. Never expose the API key, call another host or REST endpoint, access contacts, owners, emails, phones, addresses, descriptions, notes, custom data, tags, files, or \
                    relationships, mutate records, add cursors or filters, paginate, synchronize, or export.
                    """
        case "streak":
            return
                """
                    Use only the four mounted Relay Streak reads for the exact API-key-bound user and explicit resource keys: current-user identity, one exact Pipeline, page zero of at most twenty-five Boxes in one Pipeline, and one exact \
                    Box. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose the API key, call another path or raw MCP tool, enumerate all Pipelines, access contacts, collaborators, \
                    communications, notes, custom fields, tasks, files, threads, comments, meetings, timelines, or activity, mutate records, select other pages or filters, synchronize, or export.
                    """
        case "less-annoying-crm":
            return
                """
                    Use only the three mounted Relay Less Annoying CRM reads for the exact API-key-bound user and explicit Contact resources: bounded current-user identity, non-empty-term search on fixed page one for at most twenty-five \
                    summaries, and one exact numeric-ID Contact or Company. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose the API key, call another origin or function, omit \
                    search terms, access emails, phones, addresses, websites, background information, birthdays, custom fields, notes, files, relationships, history, broader CRM data, mutate records, add filters or pages, crawl, \
                    synchronize, or export.
                    """
        case "nutshell":
            return
                """
                    Use only the two mounted Relay Nutshell reads for the exact API-key-bound user and explicit Lead resources: required-text search on fixed page zero for at most twenty-five summaries and one exact canonical n-leads API \
                    ID. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose the user email or API key, call another origin, path, API style, filter, sort, or page, omit search text, \
                    access contacts, companies, owners, watchers, communications, descriptions, notes, custom fields, products, competitors, files, activities, or relationships, mutate records, crawl, synchronize, or export.
                    """
        case "teamleader":
            return
                """
                    Use only the three mounted Relay Teamleader reads for the exact OAuth-bound user and explicit Deal resources: bounded user identity, fixed page one with at most twenty-five Deal summaries, and one exact Deal UUID. Every \
                    read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose OAuth tokens, call another origin, method, RPC action, filter, sort, page, include, or payload, access customers, \
                    contacts, companies, owners, broader users, emails, phones, addresses, descriptions, custom fields, notes, activities, files, relationships, pipelines, phases, quotations, invoices, projects, tasks, time tracking, \
                    tickets, calendars, reports, administration, or webhooks, mutate records, crawl, synchronize, download, or export.
                    """
        case "scoro":
            return
                """
                    Use only the three mounted Relay Scoro reads for the exact API-key-bound tenant and business entity: bounded entity metadata, fixed page one with at most twenty-five Project summaries, and one exact positive numeric \
                    Project ID. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose the tenant credential, API key, or AppId, call another origin, entity, method, module, action, \
                    path, filter, bookmark, page, detailed response, or payload, access customers, contacts, companies, users, managers, communication, addresses, descriptions, phases, permissions, relationships, custom fields, tags, \
                    financial documents, calendar, tasks, time, bookings, administration, or webhooks, mutate records, generate PDFs, crawl, synchronize, download, or export.
                    """
        case "odoo":
            return
                """
                    Use only the three mounted Relay Odoo reads for the exact API-key-bound Odoo Online database and user: bounded current-user context, fixed offset zero with at most twenty-five Project summaries, and one exact positive \
                    numeric Project ID. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose the database credential or API key, call another origin, database, model, method, field \
                    set, domain, context, order, offset, limit, payload, legacy RPC, raw JSON-2, or dynamic documentation, access contacts, customers, vendors, employees, other users, emails, phones, addresses, descriptions, tasks, \
                    messages, attachments, followers, activities, timesheets, finance, CRM, sales, inventory, manufacturing, HR, marketing, websites, helpdesk, documents, administration, or installed apps, mutate records, crawl, \
                    synchronize, generate reports, download, import, or export.
                    """
        case "netsuite":
            return
                """
                    Use only the two mounted Relay NetSuite reads for the exact TBA-bound account, SuiteTalk origin, integration user, and role: fixed offset zero with at most twenty-five accounting-period status summaries and one exact \
                    positive internal-ID accounting period. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose the account credentials, consumer or token secrets, call another \
                    origin, REST record, field, filter, query, offset, limit, request option, SuiteQL, RESTlet, SOAP, SuiteScript, metadata, action, or transformation, access customers, contacts, vendors, employees, users, communications, \
                    transactions, balances, journals, invoices, payments, banking, tax, payroll, expenses, orders, inventory, projects, CRM, commerce, analytics, reports, administration, or SuiteApps, mutate records, paginate, crawl, \
                    synchronize, run reports, download, import, or export.
                    """
        case "sage-accounting":
            return
                """
                    Use only the three mounted Relay Sage Accounting reads for the exact customer-app-, subscription-key-, OAuth-token-, and X-Business-bound business: bounded business summary, fixed page one with at most twenty-five \
                    ledger-account classifications, and one exact classification ID. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose OAuth or APIM credentials, call another \
                    origin, business, path, API version, method, field, filter, expand, page, limit, or raw request, access contacts, people, addresses, customers, suppliers, products, services, accounts, balances, journals, transactions, \
                    invoices, credit notes, payments, banking, tax, payroll, expenses, reports, financial settings, or administration, mutate records, paginate, poll, crawl, synchronize, download, import, or export.
                    """
        case "sage-intacct":
            return
                """
                    Use only the two mounted Relay Sage Intacct reads for the exact authorized client application, dedicated Web Services user, and company or entity: the first provider collection response capped at twenty-five \
                    reporting-period summaries and one exact opaque-key reporting period. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose client credentials or bearer tokens, call \
                    another origin, token grant, username, company, entity, REST object, path, field, filter, query service, XML Web Services, DDS, method, request option, or raw API, access people, customers, vendors, accounts, balances, \
                    budgets, journals, transactions, invoices, payments, banking, tax, payroll, expenses, purchasing, inventory, projects, reports, or administration, mutate records, paginate, poll, crawl, synchronize, download, import, or \
                    export.
                    """
        case "myob":
            return
                """
                    Use only the two mounted Relay MYOB reads for the exact customer app, OAuth grant, company-file credential, and consent-selected businessId: the bounded company-file product and availability summary, plus API build and \
                    at most twenty-five resource-version summaries. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose OAuth, API-key, refresh, or company-file credentials, call \
                    another origin, company file, API version, resource, path, field, method, query, or raw request, access people, addresses, contacts, customers, suppliers, accounts, balances, journals, transactions, sales, purchases, \
                    payments, banking, tax, payroll, inventory, reports, files, attachments, or administration, mutate records, paginate, poll, crawl, synchronize, download, import, or export.
                    """
        case "kashflow":
            return
                """
                    Use only the two mounted Relay KashFlow reads for the exact API-enabled account, dedicated user, separate API password, fixed HTTPS SOAP endpoint, and exact SOAP actions: at most twenty-five currency-code, name, symbol, \
                    and display-position summaries, plus the VAT-registration boolean. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose the username or API password, use the normal \
                    web-login password, call another origin, SOAP action, method, field, parameter, XML body, WSDL operation, REST v2 path, or raw request, access exchange rates, company details, users, people, contacts, customers, \
                    suppliers, accounts, balances, ledgers, journals, invoices, quotes, purchases, payments, banking, tax rates or reports, payroll, inventory, products, projects, files, PDFs, CSVs, or administration, mutate records, \
                    paginate, poll, crawl, synchronize, download, import, or export.
                    """
        case "zoho-books":
            return
                """
                    Use only the mounted Relay Zoho Books organization-settings read for the exact customer OAuth app, offline grant, regional Accounts/API authority, and preselected organization ID. The read returns only bounded \
                    organization identity, plan, locale, time-zone, active, currency, and precision fields. It requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose OAuth credentials or tokens, \
                    call another product, region, organization, scope, origin, path, method, field, query, version, or raw request, access people, contact details, addresses, tax identifiers, files, accounts, balances, journals, sales, \
                    purchases, banking, projects, time, inventory, tax, reports, automation, or administration, mutate records, paginate, poll, crawl, synchronize, download, import, or export.
                    """
        case "zoho-invoice":
            return
                """
                    Use only the mounted Relay Zoho Invoice organization-settings read for the exact customer OAuth app, offline grant, regional Accounts/API authority, and preselected organization ID. The read returns only bounded \
                    organization identity, plan, locale, time-zone, active, currency, and precision fields. It requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose OAuth credentials or tokens, \
                    call another product, region, organization, scope, origin, path, method, field, query, version, or raw request, access people, contact details, addresses, tax identifiers, items, expenses, estimates, invoices, recurring \
                    invoices, payments, time, projects, reports, automation, or administration, mutate records, paginate, poll, crawl, synchronize, generate PDFs, download, import, or export.
                    """
        case "zoho-expense":
            return
                """
                    Use only the mounted Relay Zoho Expense organization-settings read for the exact customer OAuth app, offline grant, regional Accounts/API authority, and preselected organization ID. The read returns only bounded \
                    organization identity, plan, locale, time-zone, active, currency, and precision fields. It requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose OAuth credentials or tokens, \
                    call another product, region, organization, scope, origin, path, method, field, query, version, or raw request, access people, contact details, addresses, tax identifiers, expenses, reports, approvals, reimbursements, \
                    trips, cards, receipts, budgets, mileage, users, taxes, currencies, or administration, mutate records, paginate, poll, crawl, synchronize, download, import, or export.
                    """
        case "zoho-desk":
            return
                """
                    Use only the two mounted Relay Zoho Desk reads for the exact Relay OAuth app, offline grant, consent-bound organization, regional Accounts authority, and token api_domain: first-page at most twenty-five recently modified \
                    privacy-redacted ticket summaries, and one exact positive-numeric-ID ticket summary. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose OAuth credentials or \
                    tokens, call another product, region, organization, scope, origin, endpoint, method, field, include, filter, query, version, or raw request, access contacts, accounts, agents, email, phone, descriptions, threads, \
                    comments, attachments, tasks, time entries, followers, tags, custom fields, departments, products, teams, contracts, calls, events, knowledge bases, community, settings, analytics, or administration, mutate records, \
                    paginate, use deep offsets, poll, crawl, synchronize, notify, bulk-process, download, import, or export.
                    """
        case "zoho-projects":
            return
                """
                    Use only the three mounted Relay Zoho Projects reads for the exact Relay OAuth app, offline grant, preselected portal, regional Accounts authority, and token api_domain: first-page at most twenty-five privacy-redacted \
                    projects, first-page at most twenty-five privacy-redacted tasks for one exact project, and one exact task. Every read requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose \
                    OAuth credentials or tokens, call another product, region, portal, scope, origin, endpoint, method, field, include, filter, query, version, or raw request, access people, owners, assignees, descriptions, comments, \
                    attachments, custom fields, tags, followers, dependencies, checklists, time, billing, milestones, forums, events, documents, analytics, settings, or administration, mutate records, paginate, poll, crawl, synchronize, \
                    bulk-process, download, import, or export.
                    """
        case "yodlee-fastlink":
            return
                """
                    Use the mounted Relay Yodlee wrappers only for the exact customer-owned partner environment and partner-defined user. Bounded reads may run directly; mutations, consent, verification, refresh, deletion, and \
                    administration require approval in Safe and run directly only under Dangerously skip permissions. Never expose partner credentials or short-lived user tokens, change the configured Yodlee origin, bypass customer dataset \
                    entitlements, or run unbounded transfers.
                    """
        case "mx":
            return
                """
                    Use the mounted Relay MX wrappers only for the customer-owned MX client and official environment. Bounded reads may run directly; mutations and administration require approval in Safe and run directly only under \
                    Dangerously skip permissions. Never expose the client ID or API key, change the configured MX origin, bypass product entitlements, or run unbounded transfers.
                    """
        case "finicity":
            return
                """
                    Use the mounted Relay Finicity wrappers only for the customer-owned Mastercard Open Finance partner and fixed API origin. Bounded reads may run directly; Connect launches, refreshes, mutations, payments, and \
                    administration require approval in Safe and run directly only under Dangerously skip permissions. Never expose partner credentials or app tokens, bypass product entitlements, or run unbounded transfers.
                    """
        case "plaid-link":
            return
                """
                    Use the mounted Relay Plaid wrappers only for the customer-owned environment and exact encrypted Item access token. Bounded reads may run directly; mutations, removal, payments, transfers, and administration require \
                    approval in Safe and run directly only under Dangerously skip permissions. Never expose client, environment, or Item credentials, switch origins, bypass product consent, or run unbounded transfers.
                    """
       case "etoro":
            return
                """
                    Use the mounted Relay eToro wrappers only for the exact user-owned Demo or Real key and its Read or Write permissions. Bounded reads may run directly; trades, transfers, withdrawals, posts, alerts, watchlists, and other \
                    mutations require approval in Safe and run directly only under Dangerously skip permissions. Never expose keys, switch the fixed API origin, bypass market or regional rules, or claim execution without provider evidence.
                    """
        case "clay":
            return
                """
                    Use only the mounted Relay Clay workspace-binding read for the exact customer-owned Public API key and fixed GET /public/v0/me endpoint. The read returns only opaque workspace and user identifiers plus workspace name. It \
                    requires approval in Safe and runs directly only under Dangerously skip permissions. Never expose the API key or personal identity, call Searches, filter discovery, Routines, functions, Claygents, Workflows, Enterprise \
                    Tables, GTM records, credit-consuming actions, MCP, CLI, plugins, another origin, path, method, header, parameter, cursor, payload, alpha surface, or raw API, mutate Clay state, paginate, poll, upload, synchronize, \
                    webhook, download, or export.
                    """
        case "claygent":
            return
                """
                    Use only the mounted Relay Claygent workspace-binding read for the exact customer-owned Clay Public API key and fixed GET /public/v0/me endpoint. The read returns only opaque workspace and user identifiers plus workspace \
                    name. Claygent execution is disabled in every policy because no stable Claygent-specific direct API contract is documented. Never expose the key or personal identity, access or run agents, prompts, models, browsing, \
                    research, sources, documents, connections, production data, outputs, citations, tests, deployments, Functions, Routines, Workflows Alpha, Searches, Tables, credit-consuming actions, MCP, CLI, raw APIs, mutations, \
                    polling, batches, uploads, webhooks, downloads, or exports.
                    """
        case "phantombuster":
            return
                """
                    Use only the mounted Relay PhantomBuster status read for the exact encrypted Workspace API key, permanent Agent ID, and fixed v2 Agent fetch endpoint. Return only bounded name, status, lifecycle timestamps, duration, \
                    queued, and running fields. Never expose the key, arguments, cookies, credentials, people/contact data, console output, messages, runtime events, result objects, files, S3 paths, or URLs; launch, schedule, retry, chain, \
                    abort, create, update, share, or delete agents; call another Agent, container, origin, version, endpoint, method, header, query, payload, script, or raw API; poll, stream, paginate, crawl, synchronize, bulk-launch, \
                    upload, webhook, download, or export.
                    """
        case "texau":
            return
                """
                    Use only the mounted Relay TexAu email-type classifier for the exact encrypted action-scoped API key and fixed POST /api/v1/texau-identify-email-type endpoint. Each call may consume customer credits and requires approval \
                    in Safe. Send one exact validated email but return only category and public-provider flags; never expose the address, username, guessed identity, raw response, provider trace, key, another action, origin, path, method, \
                    header, payload, REST/MCP/CLI surface, enrichment, scraping, search, AI, tables, workflows, CRM writes, outbound automation, bulk or async jobs, polling, webhooks, downloads, or exports.
                    """
        case "evaboot":
            return
                """
                    Use only the mounted Relay Evaboot quota read for the exact encrypted Bearer token and fixed GET /v1/quota/ endpoint. Return only daily limit, used, remaining, credit balance, and aggregate valid/invalid Sales Navigator \
                    connection counts. Never expose the token, account IDs, user identity, prospect/contact data, LinkedIn profiles or searches, emails, job history or results, provider traces, raw responses, extraction, enrichment, \
                    finding, verification, Search Builder, another endpoint, method, header, payload, REST/MCP/CLI surface, bulk work, polling, pagination, webhooks, downloads, or exports.
                    """
        case "lemlist":
            return
                """
                    Use only the mounted Relay lemlist campaign-status read for the exact encrypted API key, configured cam_ campaign ID, HTTP Basic authentication, and fixed GET /api/campaigns/{campaignId} endpoint. Return only campaign \
                    ID, bounded name, status, creation time, and an error-presence flag. Never expose the API key, creator or sender identity, mailboxes, leads, contacts, email addresses, messages, replies, inboxes, unsubscribes, detailed \
                    errors, teams, users, labels, variables, CRM fields, statistics, raw responses, enrichment, phone or LinkedIn data, credits, AI, MCP, CLI, another origin, endpoint, method, header, parameter, payload, campaign mutation, \
                    list/search/filter queries, pagination, polling, imports, webhooks, downloads, exports, or bulk work.
                    """
        case "mailshake":
            return
                """
                    Use only the mounted Relay Mailshake campaign-status read for the exact encrypted team API key, configured positive numeric campaign ID, API-key-as-Basic-username authentication, and fixed POST /2017-04-01/campaigns/get \
                    endpoint. Return only campaign ID, bounded title, creation time, archive/pause flags, and aggregate message count. Never expose the API key, sender identity, connected mailboxes, campaign URLs, message subjects or \
                    bodies, sequence details, recipients, leads, contacts, email addresses, sent mail, opens, clicks, replies, unsubscribes, text replacements, problems, team members, webhooks, OAuth administration, raw responses, another \
                    origin, endpoint, method, header, parameter, payload, campaign mutation, list/search/filter queries, pagination, polling, imports, async jobs, bulk work, CSV downloads, exports, or crawling.
                    """
        case "woodpecker":
            return
                """
                    Use only the mounted Relay Woodpecker campaign-status read for the exact encrypted non-agency API key, configured positive numeric campaign ID, x-api-key header, and fixed GET /rest/v2/campaigns/{campaignId} endpoint. \
                    Return only campaign ID, bounded name, native status, and whether Bounce Shield auto-paused it. Never expose the key, mailbox or LinkedIn account IDs, delivery schedules, subjects, message bodies, variants, snippets, \
                    tracking or campaign settings, prospects, leads, contacts, email addresses, profiles, inboxes, replies, manual tasks, sent activity, users, domains, agency/client impersonation, master keys, webhooks, reports, Lead \
                    Finder, MCP, CLI, raw responses, another origin, endpoint, method, header, parameter, payload, campaign mutation, list/search/filter queries, pagination, polling, imports, bulk work, downloads, exports, or crawling.
                    """
        case "reply-io":
            return
                """
                    Use only the mounted Relay Reply.io sequence-status read for the exact encrypted read-scoped V3 API key, configured positive numeric sequence ID, X-API-Key header, and fixed GET /v3/sequences/{sequenceId} endpoint. \
                    Return only sequence ID, bounded name, creation time, native status, and archive flag. Never expose the key, team or owner IDs, sending-account IDs or addresses, schedules, steps, subjects, bodies, templates, variants, \
                    attachments or settings, contacts, lists, email addresses, LinkedIn profiles, inboxes, replies, calls, SMS, WhatsApp, tasks, sends, AI SDR, enrichment, validation, custom fields, blacklists, accounts, users, calendars, \
                    reports, webhooks, background jobs, MCP, CLI, raw responses, another origin, endpoint, method, header, parameter, payload, sequence mutation, list/search/filter queries, pagination, polling, imports, bulk work, \
                    downloads, exports, or crawling.
                    """
        case "mixmax":
            return
                """
                    Use only the mounted Relay Mixmax sequence-summary read for the exact encrypted developer token, configured 24-character hexadecimal sequence ID, X-API-Token header, and fixed GET /v1/sequences/{sequenceId} endpoint. \
                    Return only sequence ID, bounded name, creation time, and update time. Never expose the token, owner or team IDs, stages, subjects, bodies, variables, CC/BCC recipients, tracking, connected CRMs, schedules, recipients, \
                    contacts, email addresses, drafts, templates, snippets, inboxes, live-feed events, sends, replies, calls, users, teams, calendars, appointment links, Salesforce, Google or Microsoft integrations, webhooks, reports, \
                    billing, administration, SDK, CLI, raw responses, another origin, endpoint, method, header, parameter, payload, sequence mutation, list/search/filter queries, pagination, polling, imports, bulk work, downloads, exports, \
                    or crawling.
                    """
        case "cirrus-insight":
            return
                """
                    Use only the mounted Relay Cirrus Insight scheduling-link read for the exact encrypted organization UUID and encrypted user email, no undocumented request credential, and fixed GET \
                    /api/organizations/{organizationId}/calendarviews?emails={userEmail} endpoint. Return at most ten bounded scheduling-link names, HTTPS URLs, and primary flags. Never expose the organization ID, user email, other emails, \
                    availability, calendar events, internal calendar, meeting or conferencing IDs, owners, attendees, invitees, questions or answers, contacts, leads, messages, subjects, bodies, attachments, engagement, Salesforce data, \
                    organization settings or profiles, users, teams, service accounts, domains, webhook events, endpoints, logs or signing keys, administration, raw responses, another origin, endpoint, method, header, parameter, payload, \
                    multi-user lookup, meeting mutation, polling, event streams, imports, bulk work, downloads, exports, or crawling.
                    """
        case "spotio":
            return
                """
                    Use only the mounted Relay SPOTIO data-object summary read for the exact encrypted Admin-generated Client ID and Secret, server-side 30-day bearer exchange, configured 24-character hexadecimal data-object ID, and fixed \
                    GET /api/DataObjects/{dataObjectId} endpoint. Return only the bound ID, bounded type ID, stage ID, source, creation/update times, stage-update time, and bounded visit/call counts. Never expose credentials or bearer \
                    tokens, names, phones, emails, addresses, GPS coordinates, place IDs, owners, collaborators, territories, fields, notes, attachments, related records, activities, appointments, documents, calls, email, text, templates, \
                    campaigns, autoplays, signatures, notifications, users, teams, business cards, workflows, layouts, SSO, connectors, webhooks, reports, calendars, routes, trips, tracking, billing, administration, raw responses, another \
                    origin, endpoint, method, header, parameter, payload, record mutation, list/search/filter queries, pagination, polling, exports, imports, bulk jobs, downloads, crawling, or provider MCP.
                    """
       case "cal-com":
            return
                """
                    Use only the three mounted approval-gated Relay Cal.com cloud API v2 wrappers for the exact OAuth user: at most 25 upcoming Booking summaries, one exact safe-UID Booking, and one exact positive-ID Event Type. Preserve \
                    booking/event-type identity, title/slug, status, start/end/duration, absent-host and configuration flags. Never expose descriptions, hosts/attendees/guests or contact identity, locations/conferencing/recordings, private \
                    links, booking-field answers, cancellation/reschedule details, metadata/ratings/ICS, calendars/schedules/routing/webhooks, team/organization/self-hosted surfaces, writes, arbitrary filters/paths/cursors/page sizes, \
                    automatic pagination, raw APIs, or export.
                    """
        case "ironclad-clickwrap":
            return
                """
                    Use only the three mounted approval-gated Relay Ironclad Clickwrap REST API v1.1 wrappers for the exact configured numeric Site: one privacy-reduced Site summary, page one of at most 25 Contract summaries, or page one of \
                    at most 25 Group summaries. Preserve only bounded IDs, names, safe keys, statuses and lifecycle timestamps. Never expose signers, people, memberships, acceptance activity, agreement/version bodies, dynamic data, \
                    records/PDFs, snapshots, exports, webhooks, credentials, broader accounts/Sites, arbitrary paths/pages/filters, automatic pagination or writes.
                    """
        case "docusign-identify":
            return
                """
                    Use only the mounted approval-gated Relay Docusign eSignature API v2.1 wrapper for the exact OAuth user and provider-selected account: list at most 100 privacy-reduced identity-verification workflow definitions. Preserve \
                    only workflow ID, default name, resource key, type and default flag. Never expose signers, envelopes, identity evidence, documents, biometrics, liveness results, PII, broader account data, writes, arbitrary \
                    paths/accounts/base URIs, automatic pagination, raw APIs, downloads or export.
                    """
        case "docusign":
            return
                """
                    Use only the three mounted approval-gated Relay Docusign eSignature API v2.1 wrappers for the exact OAuth user and explicitly selected account: at most 25 Envelopes changed in a fixed fourteen-day window, at most 25 \
                    Envelopes awaiting the user’s signature, and one exact UUID Envelope subject/status summary with a fifteen-minute polling guard. Preserve Envelope ID, email subject, status and lifecycle timestamps. Never expose \
                    sender/recipient identity, documents/content/certificates, tabs/form/payment/authentication data, delivery/IP/geolocation, custom fields, messages/reasons/audits, templates/Connect/admin, writes/signing/sending/voiding, \
                    arbitrary account/base URI/date/status/folder/include/path/start-position, automatic pagination, downloads, raw APIs, or export.
                    """
        case "dropbox-sign":
            return
                """
                    Use only the three mounted approval-gated Relay Dropbox Sign API v3 wrappers for the exact OAuth account and Signature Requests created through Relay's API App: first-page at most 25 request summaries, first-page at most \
                    25 requests awaiting the connected user's signature, and one exact hexadecimal-ID request. Preserve request ID, title/subject, created/expiry epochs, complete/declined/error/test flags and aggregate signature-status \
                    counts. Never expose requester/signer/CC identity, emails/signature IDs, messages/original titles, URLs, metadata/custom fields/form responses, documents/files/downloads, signer order/reminder/view/PIN/SMS/auth data, \
                    callbacks/events, templates/teams/API Apps/faxes/admin, writes, arbitrary queries/pages/paths, automatic pagination, raw APIs, or export.
                    """
        case "pandadoc":
            return
                """
                    Use only the three mounted approval-gated Relay PandaDoc public API v1 wrappers for the exact OAuth membership and selected token-bound workspace: at most 25 Documents created in the fixed previous fourteen days, one \
                    exact safe-ID lightweight Document status, and at most 25 root Document Folders. Preserve only Document ID/name/status/lifecycle dates and Folder UUID/name. Never use the details endpoint or expose \
                    owners/senders/recipients/approvers, identity/contact data, fields/tokens/values, pricing/quotes/products/totals/payments, content/files/downloads, metadata/tags/linked objects, approvals/locks, \
                    templates/forms/members/workspaces/webhooks, writes, arbitrary filters/paths/pages, automatic pagination, raw APIs, or export.
                    """
        case "typeform":
            return
                """
                    Use only the three mounted approval-gated Relay Typeform wrappers for the exact OAuth account, selected token-visible workspace and validated global/EU API origin: first-page at most 25 Forms ordered by last update, one \
                    exact safe-ID Form summary, and at most 25 completed response lifecycle summaries from the fixed previous fourteen days. Preserve only Form ID/title/language/public flag/timestamps/workspace and Response \
                    ID/type/landed/submitted timestamps. Never expose questions, fields, answers, choices, logic, respondent/contact identity, hidden/calculated values, metadata/network/referrer/browser/platform, tokens/landing IDs, \
                    files/media/audio/video, payment, variables/tracking, webhooks, members, writes, arbitrary filters/dates/origins/workspaces/pages, automatic pagination, raw APIs, or export. Respect two requests per second per account \
                    and the provider's response freshness caveat.
                    """
        case "sendfox":
            return
                """
                    Use only the three mounted approval-gated Relay SendFox wrappers for one exact paid OAuth account at the fixed API origin: redacted Account ID/contact-count/contact-limit/creation date, first-page at most 25 contact-list \
                    aggregate summaries, and first-page at most 25 content-free Campaign lifecycle summaries. Never expose contacts, emails, names, IP addresses, custom fields, unsubscribe or person-level activity, Campaign \
                    title/subject/preview/HTML/sender/recipient/engagement, forms, automations, domains, writes, sends, arbitrary queries/pages/paths, automatic pagination, raw APIs, bulk, or export. Respect sixty requests per minute per \
                    account and reauthorize after token expiry or revocation.
                    """
        case "beehiiv":
            return
                """
                    Use only the three mounted approval-gated Relay beehiiv wrappers for one exact OAuth organization with identify:read, publications:read and posts:read: redacted organization/token metadata, first-page at most 25 \
                    content-free publication lifecycle summaries, and first-page at most 25 content-free post lifecycle summaries for one exact pub_ identifier. Never expose subscribers, emails, names, custom fields, tags, tiers, referrals, \
                    publication or organization names, titles, subjects, previews, authors, slugs, URLs, HTML, premium content, engagement, automations, segments, polls, webhooks, writes, sends, arbitrary expansions/filters/pages/paths, \
                    automatic pagination, raw APIs, bulk, or export. Respect 180 requests per minute per organization and revoke upstream on disconnect.
                    """
        case "substack":
            return
                """
                    Use only the single mounted Relay Substack public-profile wrapper: at most ten authenticity-thresholded public creator profiles for one exact LinkedIn handle. Treat matches as non-guaranteed, self-reported, potentially \
                    missing or multiple, and at least daily rather than real-time. Never expose private profiles, subscribers, membership or payment data, posts, Notes, Chat, media, comments, publication settings, writes, browser sessions, \
                    private APIs, RSS scraping, arbitrary paths or headers, raw APIs, pagination, bulk, or export. Use only https://substack.com, reject redirects, cap responses at 1 MB, and conservatively limit lookups to one request per \
                    second. Keep production blocked until Substack confirms the token transport omitted by its public guide.
                    """
        case "hootsuite":
            return
                """
                    Use only the three mounted approval-gated Relay Hootsuite wrappers for one OAuth member: identity-redacted member status, at most 25 accessible social profile IDs, and one exact profile status. Never expose email, names, \
                    company, biography, usernames, network IDs, avatars, owner IDs, content, URLs, messages, publishing, organizations, teams, Inbox, SCIM, ads, analytics, writes, arbitrary paths, pagination, raw APIs or export. Use only \
                    https://platform.hootsuite.com, reject redirects, cap responses at 1 MB, and preserve provider permissions and 429 responses.
                    """
        case "buffer":
            return
                """
                    Use only the three mounted approval-gated Relay Buffer wrappers for one OAuth account with account:read and offline_access: identity-redacted account status, at most 25 organization IDs and channel counts, and at most 25 \
                    identity- and content-free channel lifecycle summaries for one exact organization. Never expose names, email, owner identity, members, limits, channel usernames or network IDs, posts, ideas, messages, schedules, drafts, \
                    analytics, publishing, engagement, administration, writes, arbitrary GraphQL, pagination, raw APIs, bulk or export. Use only static GraphQL documents at https://api.buffer.com, reject redirects, cap responses at 1 MB, \
                    preserve plan rate limits, and atomically store every single-use refresh-token replacement.
                    """
        case "sprout-social":
            return
                """
                    Use only the three mounted approval-gated Relay Sprout Social wrappers using customer-owned machine-to-machine OAuth and organization_id: at most 25 accessible customer IDs without names, at most 25 identity-redacted \
                    profile structure summaries for one exact positive-decimal customer ID, and at most 25 group IDs without names. Never expose customer, profile, group, user, team, queue, topic or network-native names, IDs, descriptions, \
                    addresses or membership; posts, messages, cases, listening, analytics, demographics, tags, reports, publishing, media, writes, arbitrary paths/bodies/filters, pagination, raw APIs, X data, bulk or export. Use only the \
                    documented fixed identity token URL and https://api.sproutsocial.com, reject redirects, cap responses at 1 MB, and respect 60 requests per minute and 250,000 per month.
                    """
        case "later":
            return
                """
                    Use only the three mounted approval-gated Relay Later Influence Reporting API wrappers with customer-owned server-side client credentials: at most 25 token-bound instance IDs without names, fixed aggregate \
                    engagements/impressions/reach for an exact date window of at most 31 inclusive days, and at most 25 campaign IDs with those same fixed metrics for one exact instance and bounded window. Never expose creator identity, \
                    handles, audience data, campaign names, post text, URLs, media, financial/paid/ROI/tracking/affiliate/sales/conversion data, Later Social scheduling/publishing/media/Inbox/Link in Bio/profile/team/account operations, \
                    writes, arbitrary paths/metrics/filters/sorting/cursors, pagination, raw APIs, broad sync or export. Use only https://reporting.api.later.com server-side, reject redirects, cap responses at 1 MB, label previous-day \
                    eventual-consistency freshness, and respect 120 requests per minute per IP.
                    """
        case "agorapulse":
            return
                """
                    Use only the four mounted approval-gated Relay Agorapulse Open API wrappers with a customer-generated bearer API key bound to one exact organization and workspace: at most 25 identity-redacted profile references plus \
                    audience, community-management, and content-performance analytics for one exact profile and an explicit window no longer than 31 days. Recursively remove names, handles, emails, messages, text, titles, descriptions, \
                    URLs, media, authors, owners, profile identity and post content. Never use listening, custom or ROI reports, drafts, calendar notes, scheduling, publishing, media, inboxes, replies, labels, user notes, writes, arbitrary \
                    paths/methods/queries/bodies, pagination, raw APIs, bulk or export. Use only fixed GET routes at https://api.agorapulse.com, reject redirects, cap responses at 2 MB, and respect 500 requests per 30 minutes.
                    """
        case "metricool":
            return
                """
                    Use only the two mounted approval-gated Relay Metricool wrappers with a customer-owned API token bound to one exact numeric userId and blogId: at most 25 identity-redacted numeric brand references and at most 25 \
                    connected network types/booleans for the exact bound brand. Never expose brand names or URLs, owners, collaborators, profile IDs, handles, messages, posts, media, comments, analytics, reports, ads, competitors, \
                    SmartLinks, inbox, scheduling, publishing, connections, users, teams, billing or webhooks. Never use writes, arbitrary paths/methods/queries/bodies, pagination, raw APIs, browser sessions, bulk or export. Use only the \
                    fixed GET routes /api/admin/simpleProfiles and /api/admin/blog/profiles at https://app.metricool.com, reject redirects, cap responses at 1 MB, and conservatively limit requests to 60 per minute.
                    """
        case "publer":
            return
                """
                    Use only the two mounted approval-gated Relay Publer wrappers with a customer-created API key restricted to workspaces and accounts scopes and bound to one exact workspace: at most 25 identity-redacted workspace IDs and \
                    at most 25 account ID/provider/type summaries. Never expose workspace or account names and pictures, owners, members, emails, roles, plans, social IDs, handles, profile identity, posts, drafts, schedules, media, \
                    analytics, competitors, publishing, uploads, connections, administration or keys. Never use writes, arbitrary paths/methods/queries/bodies, job polling, pagination, raw APIs, browser sessions, bulk or export. Use only \
                    the fixed GET routes /api/v1/workspaces and /api/v1/accounts at https://app.publer.com, reject redirects, cap responses at 1 MB, and respect 100 requests per two minutes per user.
                    """
        case "brandwatch":
            return
                """
                    Use only the two mounted approval-gated Relay Brandwatch Consumer Research wrappers with a customer-generated bearer token bound to one exact positive-decimal project: at most 25 project ID/time-zone references and at \
                    most 25 query ID/type references. Never expose project, client, company, user or query names, descriptions, usernames, billing identity, search expressions, filters, mentions, authors, posts, URLs, media, content, \
                    analytics, uploads, query/rule changes, publishing, engagement, administration or credentials. Never use writes, arbitrary paths/methods/queries/bodies, Analysis API jobs, streams, pagination, raw APIs, browser sessions, \
                    bulk or export. Use only GET /projects/summary and GET /projects/{boundProjectId}/queries/summary at https://api.brandwatch.com, reject redirects, cap responses at 1 MB, and respect 30 requests per rolling 10 minutes per \
                    API Client.
                    """
        case "mention":
            return
                """
                    Use only the two mounted approval-gated Relay Mention wrappers with a customer-created app token bound to one exact account: identity-redacted account language/time-zone status and at most 25 alert \
                    ID/query-type/index-version references. Never expose names, emails, avatars, social profiles, alert names, keywords, queries, descriptions, shares, users, Mention Content, authors, URLs, analytics, streams, tasks, tags, \
                    publishing, writes, administration or credentials. Never use arbitrary paths/methods/queries/bodies, cursors, pagination, raw APIs, stream hosts, browser sessions, bulk or export. Pin Accept-Version 1.19, use only GET \
                    /api/accounts/{boundAccountId} and GET /api/accounts/{boundAccountId}/alerts?limit=25 at https://api.mention.net, reject redirects, cap responses at 1 MB, and preserve provider 429 responses.
                    """
        case "meltwater":
            return
                """
                    Use only the two mounted approval-gated Relay Meltwater wrappers with a customer-generated API token for its default company: aggregate last-24-hours request count/units and at most 25 saved-search ID/update references. \
                    Never expose companies, workspaces, users, token IDs, search names, descriptions, queries, keywords, filters, folders, sources, mentions, articles, posts, URLs, media, authors, profiles, endpoint-level usage, analytics, \
                    reports, Mira responses, exports, streams, imports, writes, administration or credentials. Never use company_id, token_id, include_query, arbitrary paths/methods/queries/bodies, pagination, polling, MCP, raw APIs, \
                    browser sessions or bulk. Use only GET /v3/usage/me/requests?period=24hours and GET /v3/searches at https://api.meltwater.com, reject redirects, cap responses at 1 MB, return at most 25 references, and preserve provider \
                    429 responses.
                    """
        case "sprinklr":
            return
                """
                    Use only the mounted approval-gated Relay Sprinklr governance wrapper with customer-owned API/OAuth credentials bound to one exact production/prodN environment and primary workspace. Return only safe user type, \
                    primaryWorkspaceConfirmed and customerBound. Never expose names, emails, user/customer/workspace IDs beyond verifying the bound workspace, properties, roles, permissions, teams, clients, profiles, social accounts, \
                    messages, cases, comments, assets, campaigns, dashboards, listening, reporting, research, care data, content, authors, URLs, media, analytics, publishing, engagement, imports, exports, webhooks, credentials, writes or \
                    administration. Never use arbitrary environments/paths/methods/queries/bodies, workspace overrides, pagination, polling, raw APIs, browser sessions or bulk. Use only GET /api/v2/me at the fixed https://api3.sprinklr.com \
                    host, reject redirects, cap responses at 1 MB, and fail closed on workspace mismatch.
                    """
        case "khoros":
            return
                """
                    Use only the mounted approval-gated Relay Khoros Marketing wrapper with a customer-generated bearer token bound to one exact positive-decimal company. Return only the bound company ID and safe environment from GET \
                    /v2/me. Never expose email, user IDs, company names, other companies, memberships, roles, permissions, teams, credentials, profiles, posts, messages, conversations, authors, cases, queues, tags, assets, listening, \
                    analytics, reports, communities, Flow, bots, GDPR data, URLs, media, content, publishing, engagement, moderation, imports, exports, webhooks, writes or administration. Never use Khoros Care/Community/Flow/Bot/Analytics \
                    APIs, Basic auth, JWT, arbitrary products/origins/paths/methods/queries/bodies, company overrides, pagination, polling, raw APIs, browser sessions or bulk. Use only GET https://api.spredfast.com/v2/me, reject redirects, \
                    cap responses at 1 MB, and fail closed if the bound company is absent.
                    """
        case "clevertap":
            return
                """
                    Use only the mounted approval-gated Relay CleverTap wrapper with customer-owned Account ID/passcode credentials bound to one exact eu1/in1/sg1/us1/aps3/mec1 regional origin and one exact profile identity. Return only \
                    bounded name/email, at most 25 event name/count/time summaries, at most 10 platform names, and at most 50 custom-property keys. Never expose the lookup identity, custom-property values, device tokens, object IDs, raw \
                    platform records, other profiles, event-based exports, cursors, analytics, catalogs, recommendations, segments, journeys, campaigns, messages, triggers, uploads, deletes, settings, passcodes, webhooks, writes or \
                    administration. Never accept runtime identifiers, arbitrary regions/origins/paths/methods/headers/queries/bodies, pagination, retries, raw APIs, browser sessions, SDK surfaces or bulk. Use only GET /1/profile.json with \
                    the URL-encoded bound identity at the allowlisted origin, reject redirects, wait at most 60 seconds, and cap responses at 1 MB.
                    """
        case "onesignal":
            return
                """
                    Use only the mounted approval-gated Relay OneSignal wrapper with a customer-owned App API Key bound to one exact UUID v4 App ID. Return page 0 of at most 25 message IDs, lifecycle timestamps, cancellation state and \
                    aggregate successful/received/failed/errored/converted/remaining counts. Never expose message names, headings, contents, custom data, segments, filters, aliases, recipients, templates, URLs, media, platform delivery \
                    detail, outcomes, cursors, users, subscriptions, devices, tags, properties, events, exports, sends, cancellation, segments, templates, apps, API keys, webhooks, journeys, live activities, writes or administration. Never \
                    accept runtime apps, origins, paths, methods, headers, queries, bodies, kinds, templates, offsets or cursors; never paginate, retry, mount raw APIs/SDKs, use browser sessions or bulk/export. Use only GET \
                    https://api.onesignal.com/notifications with the bound app_id, limit=25 and offset=0, reject redirects, wait at most 30 seconds, cap responses at 1 MB, and respect one view request per second per app.
                    """
        case "airship":
            return
                """
                    Use only the mounted approval-gated Relay Airship wrapper with a customer-generated role-limited bearer token bound to one exact NA or EU HTTP cloud site. Return page 1 of at most 25 segment UUID and \
                    creation/modification epoch-millisecond references plus only a next-page-present boolean. Never expose display names, criteria, selectors, tags, attributes, locations, events, audience membership/counts, next-page URLs, \
                    channels, addresses, named users, subscriptions, lists, message content, schedules, templates, reports, outcomes, experiments, journeys, streams, sends, writes, deletes, tokens, OAuth clients, webhooks or administration. \
                    Never use App/Master secrets, arbitrary cloud sites/origins/paths/methods/headers/queries/bodies/starts/limits, pagination, raw APIs, browser sessions, SDKs, streams, bulk or export. Use only GET /api/segments?limit=25 \
                    at https://go.urbanairship.com or https://go.airship.eu with Accept version=3, reject redirects, wait at most 30 seconds, cap responses at 1 MB, and never follow next_page.
                    """
        case "pushwoosh":
            return
                """
                    Use only the mounted approval-gated Relay Pushwoosh wrapper with a customer-generated Server API token bound to one exact XXXXX-XXXXX application code. Return at most 100 timestamp/platform push-enabled and push-disabled \
                    aggregates for the last 24 completed UTC hours. Never expose device tokens, HWIDs, users, aliases, emails, phone numbers, tags, attributes, locations, events, subscriptions, individual histories, message or campaign \
                    content, targeting, segments, filters, templates, journeys, experiments, recipients, outcomes, reports, detailed analytics, sends, writes, application/project changes, tokens, webhooks or administration. Never accept \
                    runtime applications, origins, paths, methods, headers, queries, bodies, time windows, pagination or retries; never mount raw APIs/SDKs, use device tokens, browser sessions, bulk or export. Use only POST \
                    https://api.pushwoosh.com/api/v2/statistics/application/getSubscribersStatistics with the bound application and last 24 completed hours, reject redirects, wait at most 30 seconds, cap responses at 1 MB, and return at \
                    most 100 aggregate rows.
                    """
        case "pusher-beams":
            return
                """
                    Use only the mounted Relay Pusher Beams wrapper with a customer-owned UUID instance ID/secret key and one exact anonymous Device Interest bound at connection time. Send exactly one title/body notification, title at most \
                    100 characters and body at most 1000, rendered identically for APNs, FCM and web. Require approval in Safe mode. Never accept runtime or multiple interests, authenticated users, device IDs/tokens, Beams auth tokens, \
                    subscriptions, webhook URLs, custom data, deep links, media, platform overrides, arbitrary payloads, deletions, credential/instance/platform configuration, webhooks or administration. Never use arbitrary \
                    instances/origins/paths/methods/headers/bodies, SDK surfaces, retries, browser sessions, bulk or export. Use only POST \
                    https://{bound-instance}.pushnotifications.pusher.com/publish_api/v1/instances/{same-instance}/publishes/interests, enforce 10 KiB request and 1 MB response caps, reject redirects, wait at most 30 seconds, never retry, \
                    and preserve provider 402/429 errors.
                    """
        case "firebase-cloud-messaging":
            return
                """
                    Use only the Railway-brokered Relay FCM wrapper with a dedicated customer service-account JSON bound to its own Firebase project and one exact public-information topic. Mint only one-hour OAuth tokens with \
                    https://www.googleapis.com/auth/firebase.messaging and publish exactly one notification title/body, title at most 100 and body at most 1000. Require approval in Safe mode because accepted topic fanouts cannot be \
                    canceled. Never accept device tokens, users, conditions, subscriptions, runtime topics, data payloads, images, links, analytics labels, platform overrides, TTL, priority, collapse keys, custom options, \
                    project/app/IAM/service-account configuration or cross-project authority. Never use arbitrary origins/paths/methods/headers/bodies, Admin SDK/raw APIs, retries, browser sessions, bulk or export. Use only POST \
                    https://oauth2.googleapis.com/token then POST https://fcm.googleapis.com/v1/projects/{credential-project}/messages:send, reject redirects, wait at most 30 seconds, cap responses at 1 MB, and never retry.
                    """
        case "appsflyer":
            return
                """
                    Use only the mounted approval-gated canonical Relay AppsFlyer wrapper with one current customer API V2 bearer token. Return page 1 of at most 25 validated app IDs plus total/next-page presence, or return only whether \
                    premium AppsFlyer Audiences partner connections exist and their count capped at 115. Never expose app names, account/user identity, partner or audience names/IDs, connection fields, credentials, audience members, \
                    device/customer/advertising identifiers, rules, attributes, splits, destinations, uploads, imports, attribution, events, campaigns, analytics, reports, raw data, exports, writes or administration. Never accept audience \
                    IDs, connection IDs, runtime paths or query values; never paginate, retry, mount import/management/SDK/raw APIs, use browser sessions, bulk or export. Use only GET https://hq1.appsflyer.com/api/mng/apps?limit=25&offset=0 \
                    and GET https://hq1.appsflyer.com/api/audiences-external-api/connections, reject redirects, wait 30 seconds, cap responses at 1 MB, and preserve provider limits.
                    """
        case "adjust":
            return
                """
                    Use only the mounted approval-gated Relay Adjust wrapper with a current customer API bearer token. Return at most 25 validated app IDs plus total count and truncation state. Never expose app names, account/user identity, \
                    store IDs, app settings, partner configuration, token detail, device or advertising IDs, installs, events, campaigns, partners, media, revenue, cost, fraud, audiences, cohorts, reports, raw data, exports, writes or \
                    administration. Never accept dates, dimensions, metrics, sections, filters, arbitrary origins/paths/methods/headers/queries/bodies; never paginate, retry, mount SDK/raw APIs, use browser sessions, bulk or export. Use \
                    only GET https://automate.adjust.com/reports-service/filters_data?required_filters=apps, reject redirects, wait 30 seconds, and cap responses at 1 MB.
                    """
        case "branch":
            return
                """
                    Use only the mounted approval-gated Relay Branch wrapper with a connection-bound live/test Branch Key and one exact HTTPS Branch link. Return only linkVerified, oneTimeUse, creationSource, matchDurationSeconds, bounded \
                    tag count/truncation and channel/feature/campaign/stage presence booleans. Never expose the Branch Key, bound link URL, aliases, destinations, routes, custom data, tag/channel/feature/campaign/stage values, link IDs, \
                    identities, sessions, clicks, installs, events, users, devices, advertising IDs, IPs, locations, revenue, cost, fraud, analytics, exports, writes or administration. Never accept runtime keys/links, Branch Secret, Access \
                    Token, arbitrary apps/origins/paths/methods/headers/queries/bodies; never paginate, poll, retry, mount SDK/raw APIs, use browser sessions, bulk or export. Use only GET https://api2.branch.io/v1/url with the bound \
                    branch_key and url, require approval in Safe mode because reads can extend link expiration, reject redirects, wait 30 seconds, cap responses at 1 MB, and preserve provider rate limits.
                    """
        case "singular":
            return
                """
                    Use only the mounted approval-gated Relay Singular wrapper with a customer-owned Reporting API key. Return at most 25 validated internal app ID, app-site ID and platform references plus total count and truncation state. \
                    Never expose app names, bundle IDs, public/store IDs, store URLs, sites, websites, domains, destinations, deep/tracking links, aliases, routing content, partners, users, devices, advertising IDs, IPs, locations, clicks, \
                    installs, events, campaigns, creatives, revenue, cost, fraud, cohorts, reports, raw data, exports, writes or administration. Never accept SDK keys, runtime apps/sites, dates, dimensions, metrics, filters, arbitrary \
                    origins/paths/methods/headers/queries/bodies; never paginate, poll, retry, mount S2S/SDK/raw APIs, use browser sessions, bulk or export. Use only GET https://api.singular.net/api/v1/singular_links/apps, reject redirects, \
                    wait 30 seconds, cap responses at 1 MB, and respect four GETs per minute.
                    """
        case "kochava":
            return
                """
                    Use only the mounted approval-gated Relay Kochava wrapper with a customer-owned API key. Return at most 25 validated internal app ID, platform and deleted-state references plus returned count and next-page presence \
                    without its token. Never expose names, GUIDs, package/path/store/account IDs, icons, SDK/integration/session/traffic/consent/configuration fields, events, embedded credentials, identities, devices, attribution, \
                    campaigns, links, reports, raw data, exports, writes or administration. Never accept runtime selectors, page tokens, arbitrary origins/paths/methods/headers/queries/bodies; never paginate, poll, retry, mount \
                    SDK/reporting/links/raw APIs, use browser sessions, bulk or export. Use only GET https://apps.api.kochava.com/apps?app_selector=true&pageToken=1, reject redirects, wait 30 seconds, and cap responses at 1 MB.
                    """
        case "segment-personas":
            return
                """
                    Use only the mounted approval-gated Relay Segment Personas wrapper with a customer-owned workspace-scoped Public API token and exact Space plus us/eu1 region bound at connection time. Return only first-page \
                    returned/total/next-page presence and enabled/live, Users/Accounts/Linked, Realtime/Batch counts for at most 25 audiences. Never expose Workspace, Space, audience or user IDs, names, keys, descriptions, FQL definitions, \
                    sizes, profiles, members, identifiers, traits, events, historical options, creators, timestamps, schedules, consumers, destinations, sources, warehouses, journeys, delivery state, cursors, raw data, writes or \
                    administration. Never accept runtime Spaces/regions, searches, includes, cursors or arbitrary origins/paths/methods/headers/queries/bodies; never paginate, poll, retry, mount Profile/SDK/raw APIs, use browser sessions, \
                    bulk or export. Use only GET https://{api|eu1.api}.segmentapis.com/spaces/{bound-space}/audiences?pagination.count=25, reject redirects, wait 30 seconds, cap responses at 1 MB, and respect 60 requests per minute.
                    """
        case "mparticle":
            return
                """
                    Use only the mounted approval-gated Relay mParticle wrapper with customer-owned Platform API client credentials and exact account plus workspace IDs bound at connection time. Exchange credentials only at \
                    https://sso.auth.mparticle.com/oauth/token with the fixed client_credentials grant and https://api.mparticle.com audience, then return only returned, active, calculated and connected counts from the exact bound workspace \
                    Real-time Audience response. Never expose credentials, bearer tokens, audience IDs/names/external names, sizes, membership changes, definitions, creators, modifiers, timestamps, workspace metadata, output details, \
                    profiles, MPIDs, identities, devices, events, attributes, consent, inputs, outputs, services, data plans, keys, integrations, writes or administration. Never accept runtime accounts/workspaces or arbitrary \
                    origins/paths/methods/headers/queries/bodies; never paginate, poll, retry, mount Events/Profile/Identity/SDK/raw APIs, use browser sessions, bulk or export. Use only GET \
                    https://api.mparticle.com/v1/workspace/{bound-workspace}/audiences?accountId={bound-account}, reject redirects, wait 30 seconds per request, and cap each response at 1 MB.
                    """
        case "tealium":
            return
                """
                    Use only the mounted approval-gated Relay Tealium wrapper with one exact account and profile bound at connection time and no API credential. Return only audience-definition and badge-definition counts. Never expose the \
                    account/profile values, audience or badge IDs/names, definitions, rules, conditions, enrichments, visitors, visitor IDs, identities, devices, events, sessions, attributes, consent, configuration, tags, templates, \
                    extensions, load rules, versions, connectors, data sources, destinations, hosted data layers, credentials, writes, publishing, Collect ingestion or administration. Never accept runtime accounts/profiles/regions or \
                    arbitrary origins/paths/methods/headers/queries/bodies; never authenticate to V3 APIs, paginate, poll, retry, mount Visitor Profile/Privacy/DataAccess/Collect/SDK/raw APIs, use browser sessions, bulk or export. Use only \
                    GET https://visitor-service.tealiumiq.com/datacloudprofiledefinitions/{bound-account}/{bound-profile}/, reject redirects, wait 30 seconds, and cap responses at 1 MB.
                    """
        case "lytics":
            return
                """
                    Use only the mounted approval-gated Relay Lytics wrapper with a customer-owned account-scoped API token restricted to v2_segment_view and without PII View. Return only returned, user-table, content-table and public \
                    segment counts. Never expose the token, account identity, segment IDs/names/slugs/descriptions, SegmentQL/AST, membership sizes, metadata, groups, ancestry, jobs, profiles, identities, devices, events, fields, content, \
                    PII, consent, connections, destinations, journeys, campaigns, experiences, reports, flows, templates, writes, reevaluation or administration. Never accept runtime account selectors, filters or arbitrary \
                    origins/paths/methods/headers/queries/bodies; never scan entities, paginate, poll, retry, mount profile/content/Collect/CLI/SDK/raw APIs, use browser sessions, bulk or export. Use only GET \
                    https://api.lytics.io/v2/segment, reject redirects, wait 30 seconds, and cap responses at 1 MB.
                    """
        case "blueconic":
            return
                """
                    Use only the mounted approval-gated Relay BlueConic wrapper with customer-owned OAuth 2.0 client credentials and one exact tenant DNS label bound at connection time. Exchange credentials only at \
                    https://www.{bound-tenant}.blueconic.net/rest/v2/oauth/token with the fixed client_credentials grant, then return only the aggregate segment count from GET /rest/v2/segments. Never expose the tenant label, client \
                    credentials, bearer token, segment IDs/names/descriptions/rules/definitions/status/sizes/membership/creators/timestamps, profiles, visitors, identifiers, properties, PII, consent, interactions, events, channels, audit \
                    records, users, destinations, connections, campaigns, journeys, dialogues, content, recommendations, exports, imports, data feeds, writes or administration. Never accept runtime \
                    tenants/origins/paths/methods/headers/queries/bodies; never paginate, poll, retry, mount profile/interaction/audit/SDK/raw APIs, use browser sessions, bulk or export. Construct only the official blueconic.net tenant \
                    host, reject redirects, wait 30 seconds per request, and cap each response at 1 MB.
                    """
        case "treasure-data":
            return
                """
                    Use only the mounted approval-gated Relay Treasure Data wrapper with a customer-owned Master-type API key belonging to a dedicated restricted user and one exact us/tokyo/ap02/eu01 region bound at connection time. Return \
                    only database and delete-protected counts. Never expose the key, database IDs/names/organizations/record counts/permission details/owners/timestamps, tables, schemas, columns, rows, profiles, identities, events, \
                    audiences, segments, PII, consent, queries, results, jobs, schedules, workflows, connectors, authentications, sources, destinations, imports, exports, activations, users, policies, audit data, writes or administration. \
                    Never accept runtime regions/origins/paths/methods/headers/queries/bodies; never paginate, poll, retry, mount SDK/CLI/raw APIs, use browser sessions, bulk or export. Use only GET \
                    /v3/database/list?require_permissions=true at the selected official TD API origin with Authorization: TD1, reject redirects, wait 30 seconds, and cap responses at 1 MB.
                    """
        case "hightouch":
            return
                """
                    Use only the mounted approval-gated Relay Hightouch wrapper with an Admin-created workspace API key. Return only the aggregate model count. Never expose the key, model IDs/names/descriptions/types, definitions, SQL, \
                    queries, columns, customer data, sources, destinations, syncs, runs, triggers, users, permissions, writes or administration. Never accept runtime input or arbitrary origins/paths/methods/headers/queries/bodies; never \
                    paginate, poll, retry, mount CLI/MCP/SDK/raw APIs, use browser sessions, bulk or export. Use only GET https://api.hightouch.com/api/v1/models with Authorization: Bearer, reject redirects, wait 30 seconds, cap responses \
                    at 1 MB, and preserve 200 requests per 10 seconds per workspace.
                    """
        case "census":
            return
                """
                    Use only the mounted approval-gated Relay Census wrapper with a customer-owned workspace API key. Return only pagination.total_records as the aggregate dataset count. Never expose the key, dataset \
                    IDs/names/descriptions/types/resource identifiers, SQL, schemas, columns, cached record counts, customer data, sources, destinations, syncs, mappings, schedules, modes, runs, errors, logs, triggers, users, workspaces, \
                    writes or administration. Never accept runtime input or arbitrary origins/paths/methods/headers/queries/bodies; never paginate, poll, retry, mount Terraform/SDK/raw APIs, use browser sessions, bulk or export. Use only \
                    GET https://app.getcensus.com/api/v1/datasets?page=1&per_page=1&order=desc with Authorization: Bearer, reject redirects, wait 30 seconds, and cap responses at 1 MB.
                    """
        case "clio-manage":
            return
                """
                    Use only the mounted approval-gated Relay Clio Manage US-region wrapper backed by a Relay-owned confidential OAuth app configured with only read-only Users permission. Call only GET \
                    https://app.clio.com/api/v4/users/who_am_i?fields=id,enabled with X-API-VERSION 4.0.13, validate the positive user ID transiently, discard it, and return only authorized/enabled state, fixed US region, API version, and \
                    redaction status. Never expose tokens, user ID/name/email/roles, firm identity, contacts, clients, matters, relationships, notes, custom fields, documents, folders, communications, calendars, tasks, activities, time, \
                    expenses, billing, payments, bank/trust accounts, webhooks, custom actions, writes or administration. Never accept runtime fields, associations, filters, regions, origins, paths, methods, headers, queries or bodies; \
                    never paginate, poll, retry, mount raw APIs, use browser sessions, bulk or export. Reject redirects, wait 20 seconds, cap responses at 1 MB, and preserve provider 401/403/429/unavailable outcomes.
                    """
        case "clio-grow":
            return
                """
                    Use only the mounted approval-gated Relay Clio Grow US-region wrapper backed by a separate Relay-owned Clio Platform confidential OAuth app with PKCE and exactly grow_user_read. Call only GET \
                    https://api.clio.com/grow/users/who_am_i, validate positive current-user and account IDs transiently, discard the complete response, and return only authorization state, fixed US region, API version, and redaction \
                    status. Never expose tokens, user or account IDs, names, email, firm identity, leads, contacts, intake answers, matters, contact or matter notes, sources, custom actions, contextual nonces, users lists, writes or \
                    administration. Never accept runtime identifiers, filters, regions, origins, paths, methods, headers, queries or bodies; never paginate, poll, retry, mount raw APIs, use browser sessions, bulk or export. Reject \
                    redirects, wait 20 seconds, cap responses at 1 MB, respect the shared three-requests-per-second application limit, and preserve provider 401/403/429/unavailable outcomes.
                    """
        case "mycase":
            return
                """
                    Use only the mounted approval-gated Relay MyCase wrapper with a customer-issued bearer token for one Advanced-tier, support-enabled firm. Call only GET https://external-integrations.mycase.com/v1/firm, validate a firm \
                    identifier transiently, discard the complete response, and return only authorization state, API version, and redaction status. Never expose the token, firm or user identity, contacts, companies, clients, cases, stages, \
                    relationships, documents, folders, events, calendars, tasks, notes, communications, intake, time, expenses, billing, invoices, payments, trust data, writes, webhooks or administration. Never accept runtime identifiers, \
                    origins, paths, methods, headers, queries or bodies; never paginate, poll, retry, mount raw APIs, use browser sessions, bulk or export. Reject redirects, wait 20 seconds, cap responses at 1 MB, and preserve provider \
                    401/403/404/429/unavailable outcomes.
                    """
        case "practicepanther":
            return
                """
                    Use only the mounted approval-gated Relay PracticePanther wrapper backed by a provider-approved confidential OAuth app with no invented scopes and a rotating refresh token. Call only GET \
                    https://app.practicepanther.com/api/TimeEntry/$count, validate the non-negative integer transiently, discard it, and return only authorization state, API version, and redaction status. Never expose tokens, the count, \
                    user or firm identity, contacts, companies, clients, matters, relationships, custom fields, tags, time or expense entries, documents, folders, tasks, events, calendars, notes, emails, messages, intake, workflows, \
                    invoices, billing, payments, trust or accounting data, writes or administration. Never accept runtime identifiers, OData filters/order/select/expand, origins, paths, methods, headers, queries or bodies; never paginate, \
                    poll, retry, mount raw APIs, use browser sessions, bulk or export. Reject redirects, wait 20 seconds, cap responses at 64 KB, and preserve provider 401/403/404/429/unavailable outcomes.
                    """
        case "smokeball":
            return
                """
                    Use only the mounted approval-gated Relay Smokeball US wrapper backed by a provider-approved public partner app using confidential OAuth authorization code with PKCE S256, only provider-configured firm-read authority, \
                    and the provider-issued API key. Call only GET https://api.smokeball.com/firm, validate the firm UUID transiently, discard the complete response, and return only authorization state, US region, API version, and redaction \
                    status. Never expose the API key, tokens, firm or staff identity, contacts, clients, matters, relationships, custom fields, documents, folders, calendars, tasks, notes, communications, intake, workflows, time, expenses, \
                    rates, invoices, billing, payments, trust or bank data, accounting, reports, writes, webhooks, apps, users, or administration. Never accept runtime identifiers, origins, regions, paths, methods, headers, queries, or \
                    bodies; never use AU/UK or staging origins, paginate, poll, retry, mount raw APIs, use SDK or browser sessions, bulk, or export. Reject redirects, wait 20 seconds, cap responses at 64 KB, and preserve provider \
                    401/403/404/429/unavailable outcomes.
                    """
        case "lawpay":
            return
                """
                    Use only the mounted approval-gated Relay LawPay wrapper backed by an 8am-approved Relay-owned partner OAuth app with the payments scope. Call only GET https://api.8am.com/gateway-credentials, validate the response shape \
                    transiently, discard the complete response, and return only authorization state, 8am/LawPay platform, API version, and redaction status. Never expose tokens, client secrets, merchant or user identity, abilities, account \
                    IDs, public keys, secret keys, trust-account flags, live or test account details, payment pages, hosted fields, cards, eCheck data, saved payment methods, charges, refunds, voids, invoices, receipts, reconciliation, \
                    transaction search, reports, webhooks, IP allowlists, users, or administration. Never accept runtime identifiers, origins, paths, methods, headers, queries, or bodies; never paginate, poll, retry, mount raw 8am/Payment \
                    Gateway/Payment Portal/Hosted Fields APIs, use SDK or browser sessions, bulk, or export. Reject redirects, wait 20 seconds, cap responses at 64 KB, and preserve provider 401/403/404/429/unavailable outcomes.
                    """
        case "filevine":
            return
                """
                    Use only the mounted approval-gated Relay Filevine US wrapper backed by a Filevine-provisioned confidential OAuth/OIDC client with gateway access scopes. Call only GET https://api.filevine.io/v2/projects?limit=1, \
                    validate response shape transiently, discard the complete response, and return only authorization state, US region, API version, and redaction status. Never expose tokens, client secrets, user identity, tenant, firm, \
                    team, project, matter, contact, client, custom section, document, task, deadline, note, communication, financial, report, webhook, service account, access-token, user, template, or administration data. Never accept \
                    runtime identifiers, origins, regions, paths, methods, headers, queries, or bodies; never use Canada or non-production origins, paginate, poll, retry, mount raw APIs, use SDK or browser sessions, bulk, or export. Reject \
                    redirects, wait 20 seconds, cap responses at 64 KB, and preserve provider 401/403/404/429/unavailable outcomes.
                    """
        case "surveymonkey":
            return
                """
                    Use only the three mounted approval-gated Relay SurveyMonkey API v3 wrappers for the exact OAuth user and provider-returned US/EU/Canada access URL: page 1 of 25 recently modified Survey summaries, page 1 of 25 response \
                    references for one exact positive-decimal Survey ID, and one exact positive-decimal response metadata resource. Never call /details or /bulk and never expose answers, pages/questions, IP/contact/recipient identity, \
                    custom variables, collectors, device/location metadata, hrefs, survey design, contacts, teams/workgroups, webhooks, analysis, writes, arbitrary filters/includes/pages/origins, automatic pagination, raw APIs, or export. \
                    Respect provider rate-limit headers and reauthorize after revocation.
                    """
        case "fillout":
            return
                """
                    Use only the three mounted approval-gated Relay Fillout REST API wrappers for one OAuth authorization grant and provider-returned global/EU base URL: at most 25 Form ID/name summaries, one exact bounded Form metadata \
                    count summary, and offset 0 of at most 25 finished Submission lifecycle summaries ordered newest first. Never expose field/question/calculation/URL-parameter names or values, answers, respondent/login/scheduling/payment \
                    identity, money, files, edit links/previews, schema/design, webhooks, Zite/database content, writes, arbitrary filters/dates/status/pages/origins, automatic pagination, raw APIs, or export. Respect five requests per \
                    second and reauthorize after token invalidation.
                    """
        case "mailchimp":
            return
                """
                    Use only the three mounted approval-gated Relay Mailchimp Marketing API v3.0 wrappers for one exact OAuth metadata data-center and API-root account: account ID/name/role/member-since, offset 0 of at most 25 Audience \
                    aggregate summaries, and offset 0 of at most 25 sent Campaign lifecycle summaries ordered newest first. Never expose contacts/members/subscriber hashes, emails/addresses/names/usernames/avatars, \
                    merge/GDPR/tag/segment/activity data, campaign subject/content/recipients/reports/links, automations, commerce, transactional email, exports/batches/webhooks/admin, writes/sends, arbitrary fields/filters/data \
                    centers/pages, automatic pagination, raw APIs, or export. Respect 10 simultaneous requests per user and reauthorize after revocation.
                    """
        case "klaviyo":
            return
                """
                    Use only the three mounted approval-gated Relay Klaviyo API wrappers for one exact account and scopes accounts:read lists:read campaigns:read at fixed revision 2026-04-15: exact Account ID/name/timezone/currency, first \
                    page of 10 recently updated sparse Lists, and first page of 25 recent email Campaign lifecycle summaries. Never expose Profiles/contact/consent/identity, events/metrics, List profiles/tags/counts, Campaign \
                    names/messages/content/audiences/recipients/reports, flows/templates/catalogs/commerce, writes/sends/ingestion, arbitrary filters/includes/additional fields/revisions/cursors, automatic pagination, raw APIs, or export. \
                    Respect endpoint rate headers and serialized rotating-token refresh.
                    """
        case "convertkit":
            return
                """
                    Use only the three mounted approval-gated Relay Kit API v4 wrappers for one exact Creator Account under the public scope: Account ID/name/plan/created/timezone without emails, the first 20 active Form summaries without \
                    embed URLs or subscribers, and the first 20 Broadcast lifecycle summaries without subjects/content/identity/audiences/templates/stats. Never expose subscribers, emails, custom fields, tags, segments, Form membership, \
                    Broadcast content, sequences, purchases, automations, webhooks, writes/sends, arbitrary statuses/cursors/queries, automatic pagination, raw APIs, bulk, or export. Respect 600 OAuth requests per rolling minute and \
                    serialized complete-pair refresh.
                    """
        case "campaign-monitor":
            return
                """
                    Use only the three mounted approval-gated Relay Campaign Monitor v3.3 wrappers for one exact selected Client under ViewReports: Client ID/name, page 1 of 20 recent sent Campaign IDs/dates descending, and one aggregate \
                    delivery/open/click/bounce/unsubscribe/spam summary for a safe Campaign ID from that list. Never expose subscribers, emails, names, IP/location, lists/segments/tags, subjects/content/sender/reply/recipient data, \
                    web/report URLs, person-level opens/clicks, transactional/journeys/templates, writes/sends/imports/admin, arbitrary Clients/dates/pages, automatic pagination, raw APIs, or export. Serialize complete rotating-pair \
                    refresh.
                    """
        case "constant-contact":
            return
                """
                    Use only the three mounted approval-gated Relay Constant Contact V3 wrappers for one exact encoded Account under account_read campaign_data offline_access and verified account/report privileges: Account ID/organization \
                    name, the fixed first 25 Email Campaign lifecycle summaries, and the fixed first 25 aggregate Email Campaign Summary Reports. Never expose contacts, emails, phones, addresses, lists/segments, contact_data, person-level \
                    tracking, Campaign names/subjects/content/activities/sender/recipient/permalink data, SMS/events/social/landing pages, writes/sends/admin, arbitrary dates/pages/cursors, automatic pagination, raw APIs, or export. Refresh \
                    only near expiry and serialize complete provider-returned pair replacement.
                    """
        case "notion":
            return
                """
                    Use brokered Relay wrappers for Notion workspace search, page fetches, data-source queries, page drafts, page create/update, and comments according to the selected approval or Direct writes policy. Notion API tokens stay \
                    in Relay Keychain references; keep workspace content task-scoped and never invoke raw Notion MCP tools.
                    """
        case "microsoft-clarity":
            return
                """
                    Use only the brokered Microsoft Clarity live-insights wrapper. It reads recent project-live-insights for 1-3 days with up to three dimensions. Credentials stay in Relay Keychain references. Do not request tokens, scrape \
                    dashboards, export recordings or heatmaps, change instrumentation, or perform project administration. Each live read may consume Clarity's 10 requests/project/day quota.
                    """
        case "posthog":
            return
                """
                    Use only brokered Relay PostHog wrappers for read-only product analytics context: projects, dashboards, insights, bounded approved queries, and event/property schema. OAuth token pairs stay in separate Relay Keychain \
                    references. Do not capture events, modify dashboards or insights, change feature flags or experiments, export broad data, access persons/sessions/replays/logs/tickets, run arbitrary SQL/HogQL, invoke raw MCP tools, or \
                    perform organization/project administration.
                    """
        case "datadog":
            return
                """
                    Use only the three brokered Relay Datadog read wrappers for bounded monitor, incident, and service-definition summaries on the exact connected Datadog site. Preserve human-readable status, severity, ownership, lifecycle, \
                    tags, and timestamps. OAuth token pairs stay in separate Relay Keychain references. Never read logs, traces, raw events or metrics; export observability data; ingest telemetry; create keys; mutate monitors, incidents, or \
                    services; administer Datadog; use arbitrary hosts; or expose raw provider tools.
                    """
        case "pagerduty":
            return
                """
                    Use only the three brokered Relay PagerDuty read wrappers for bounded incident lists, incident details, and service summaries in the exact connected account and region. Preserve incident status, urgency, ownership, \
                    escalation, and timestamps. OAuth token pairs stay in separate Relay Keychain references. Never acknowledge, resolve, reassign, add notes or responders, access contacts, schedules, on-calls, alert bodies or logs, ingest \
                    Events, administer PagerDuty, paginate automatically, use arbitrary hosts, or expose raw REST/provider tools.
                    """
        case "cloudflare":
            return
                """
                    Use only the three brokered Relay Cloudflare read wrappers for a bounded exact-account zone list, the selected zone summary, and a static aggregate traffic overview for that zone over at most 24 hours. Preserve zone \
                    status/type/account/lifecycle and aggregate requests, data transfer, visits, and time window. OAuth token pairs stay in separate Relay Keychain references. Never read raw logs or request-level dimensions; inspect DNS \
                    records, tokens, users, memberships, billing, certificates, Workers, Access or detailed rules; mutate configuration; purge cache; run arbitrary GraphQL/REST; paginate automatically; or use arbitrary hosts.
                    """
        case "vercel":
            return
                """
                    Use only the three brokered Relay Vercel read wrappers for a bounded project list, the exact selected project, and bounded deployments for that project in the installed Hobby/team scope. Preserve project \
                    framework/lifecycle and deployment URL/state/target/project/creator/Git/timestamps. The non-refreshable integration access token stays in a Relay Keychain reference. Never read environment values, logs/events, \
                    files/source, members, billing, certificates, or detailed domain configuration; create/cancel/delete/promote deployments; mutate projects/domains/checks/Edge Config/log drains; call arbitrary REST; paginate \
                    automatically; or cross team/project boundaries.
                    """
        case "heroku":
            return
                """
                    Use only the three brokered Relay Heroku read wrappers for a bounded App list in the exact connected Team and bounded Release and Dyno summaries for the selected App. Preserve App maintenance/region/stack/lifecycle, \
                    Release version/status/current state, and Dyno type/size/state/release. OAuth token pairs stay in separate Relay Keychain references. Never access config vars, log drains/sessions, commands, attach/output URLs, add-ons, \
                    source/slugs/files, pipelines, members, billing, domains, webhooks or tokens; mutate apps/releases/dynos; call arbitrary Platform API paths; paginate automatically; or cross Team/App boundaries.
                    """
        case "digitalocean":
            return
                """
                    Use only the four brokered Relay DigitalOcean read wrappers for bounded Projects, the exact selected Project, its first bounded resource page, and one selected Droplet or App after Project-membership verification. \
                    Preserve Project purpose/environment/lifecycle and safe Droplet or App deployment/runtime fields. OAuth token pairs stay in separate Relay Keychain references. Never use expanding API aliases; access environment values, \
                    logs, console, credentials, user-data, databases, Kubernetes, registry, Spaces secrets, networking, members or billing; mutate resources; call arbitrary API paths; paginate automatically; or cross Team/Project/resource \
                    boundaries.
                    """
        case "firebase":
            return
                """
                    Use only the three brokered Relay Firebase read wrappers for a bounded active Project list, the exact selected Firebase Project, and its first bounded registered App page. Preserve Project identity, state, resources \
                    location, hosting site, lifecycle, App platform, App ID, namespace, state, and expiry. OAuth access and refresh tokens stay in separate Relay Keychain references. Never access API key IDs, Admin SDK/config artifacts, \
                    Firestore, Realtime Database, Auth, Hosting content, Storage, Functions, Messaging, Crashlytics, Performance, Remote Config, App Distribution, Data Connect, product data, writes, arbitrary Google/Firebase APIs, raw \
                    tools, automatic pagination, or another Project.
                    """
        case "supabase":
            return
                """
                    Use only the three brokered Relay Supabase read wrappers for the exact selected Organization, its first bounded Project page at offset zero, and the exact selected Project. Preserve Organization identity, name, plan and \
                    safe Project identity, provider, region, branch flag, lifecycle, and creation time. OAuth access and refresh tokens stay in separate Relay Keychain references. Never access database details or data, project API keys, \
                    passwords, connection strings, secrets, configuration, Auth users, Storage objects, Functions, logs, members, billing, writes, arbitrary Management API paths, raw tools, automatic pagination, another Organization, or \
                    another Project.
                    """
        case "okta":
            return
                """
                    Use only the three brokered Relay Okta read wrappers for the first bounded Application page in the exact connected org, the exact selected Application, and its first bounded assigned-Group page. Preserve safe Application \
                    identity, label, lifecycle, sign-on mode, timestamps, accessibility/visibility flags, feature names, and assigned Group identity/type/name/description. The customer-specific OIN client secret stays in Relay Keychain and \
                    one-hour access tokens are never persisted. Never access client credentials or tokens, settings/profile blobs, certificates/keys, sign-on credentials, usernames, user assignments, group members, users, identities, logs, \
                    policies, factors, devices, sessions, hooks, workflows, schemas, brands/templates, writes, arbitrary endpoints, raw tools, automatic pagination, another org, or another Application.
                    """
        case "bamboohr":
            return
                """
                    Use only the three brokered Relay BambooHR read wrappers for the first bounded job-Location page in the exact company, the exact selected Location, and bounded country options. Preserve only safe Location identity, \
                    label, lifecycle/manageability, timezone, remote flag and timestamps plus country option identity. OAuth tokens stay in separate Relay Keychain references. Never access employee records or scopes, address \
                    lines/city/postcode, fields, reports/datasets, custom fields, directories/photos, contacts, compensation, demographics, dependents, benefits, leave, payroll, recruiting, time, files, writes, arbitrary APIs, raw tools, \
                    automatic pagination, another company, or another Location.
                    """
        case "greenhouse":
            return
                """
                    Use only the three brokered Relay Greenhouse Harvest v3 read wrappers for first bounded pages of Jobs, Offices, and Departments in the exact connected organization. Preserve safe requisition lifecycle and organizational \
                    hierarchy only. OAuth access and refresh tokens stay in separate Relay Keychain references. Never access candidates, applications, interviews, offers, users, EEOC/demographic data, hiring-team identities, \
                    notes/descriptions, custom fields, attachments, email, approvals, physical office locations, contact users, writes/destructive actions, arbitrary endpoints, raw tools, automatic cursor following, or another organization.
                    """
        case "lever":
            return
                """
                    Use only the two brokered Relay Lever read wrappers for a first bounded page of non-confidential Job Postings and customer-defined Stage labels in the exact connected account. OAuth access and rotating refresh tokens \
                    stay in separate Relay Keychain references. Never access Opportunities, Candidates, Contacts, Applications, interviews, offers, feedback, notes, files, forms, users, confidential postings, content or HTML, salary, \
                    owners, hiring managers, followers, application questions, writes, apply endpoints, raw tools, automatic offset following, or another account.
                    """
        case "google-calendar":
            return
                """
                    Use only the five brokered Relay Google Calendar wrappers for bounded Calendar/Event reads, explicit FreeBusy checks, and exact Event create/update through the compiled authority policy. Preserve Calendar IDs, Event \
                    IDs/ETags, summaries, bounded descriptions/locations, date or dateTime/timeZone semantics, recurrence, organizer/attendee response status, and explicit time ranges. Create/update is approval-required by default or Direct \
                    writes only when explicitly selected, and guest notifications stay disabled. Never delete/import/move/watch Events, manage Calendars/ACL/settings, create Meet conferences, access attachments/private extended properties, \
                    use arbitrary endpoints/raw tools, auto-follow page or sync tokens, or access another account.
                    """
        case "google-drive":
            return
                """
                    Use only the six brokered Relay Google Drive wrappers with exact drive.file scope. Search, metadata, and bounded content reads are limited to files Relay created or the user explicitly selected/opened for Relay; never \
                    claim whole-Drive visibility. Preserve bounded File identity, name, MIME type, timestamps, size, parents, web link and safe copy/download capabilities. Create/copy is approval-required by default or Direct writes only \
                    when explicitly selected. Never access arbitrary file IDs, permissions/sharing, comments, revisions, activity, update/delete, broad export, raw endpoints/tools, automatic pagination, domain-wide delegation, or another \
                    account.
                    """
        case "google-sheets":
            return
                """
                    Use only the five brokered Relay Google Sheets wrappers with exact drive.file scope. Operate only on a spreadsheet Relay created or the user explicitly selected/opened, using an explicit spreadsheet ID and bounded A1 \
                    range. Metadata and value reads are bounded to 200 rows, 26 columns, 5,000 cells, and 100,000 characters; never claim whole-Drive visibility. Update/append is approval-required by default or Direct writes only when \
                    explicitly selected. Never list Drive spreadsheets, clear cells, mutate sheet structure or formatting, access protected/named ranges, charts, pivots, filters, metadata or external data, share/export, run macros or Apps \
                    Script, invoke raw endpoints/tools, paginate automatically, use domain-wide delegation, or access another account.
                    """
        case "google-slides":
            return
                """
                    Use only the five brokered Relay Google Slides wrappers with exact drive.file scope. Operate only on a presentation Relay created or the user explicitly selected/opened, using explicit presentation, page, and element \
                    identities. Reads return at most 50 slides, 100 elements per page, and 10,000 semantic text characters with no thumbnails or media bytes. Text replacement or one allowlisted slide creation is approval-required by default \
                    or Direct writes, atomic, and limited to 20 subrequests and 20,000 write characters. Never list Drive presentations, delete/reorder/duplicate objects, invoke arbitrary batch requests, add media/charts/tables, change \
                    formatting/themes/masters/layouts, write speaker notes, share/export/publish, invoke raw endpoints/tools, paginate automatically, use domain-wide delegation, or access another account.
                    """
        case "google-forms":
            return
                """
                    Use only the four brokered Relay Google Forms wrappers with exact drive.file scope. Operate only on a Form Relay created or the user explicitly selected/opened. Read bounded Form/Item/question structure; prepare locally; \
                    create Forms unpublished; and create only typed text or choice questions through approval or Direct writes with revision control. Never read Form responses, respondent emails, answers, grades, feedback or uploaded-file \
                    metadata; list responses; create watches; publish or change accepting-response state; manage responders; change quiz/settings/grading; create file-upload questions; access linked Sheets; delete/move/update items; invoke \
                    arbitrary batch requests; add media; share/export; invoke raw endpoints/tools; paginate automatically; use domain-wide delegation; or access another account.
                    """
        case "google-tasks":
            return
                """
                    Use only the five brokered Relay Google Tasks wrappers with exact tasks scope. List at most 20 TaskLists and 100 Tasks from an explicit TaskList, prepare locally, create top-level tasks, and patch only title, notes, \
                    date-only due, or status through approval or Direct writes. Patch performs an assigned-task preflight and requires an ETag. Never expose links or assignment context, Drive IDs/resource keys or Chat spaces; mutate \
                    assigned tasks; delete Tasks or TaskLists; clear completed tasks; move/reorder/change parents; administer TaskLists; call raw endpoints; paginate automatically; use service accounts/domain delegation; or access another \
                    account.
                    """
        case "google-contacts":
            return
                """
                    Use only the five brokered Relay Google Contacts wrappers with exact contacts scope. List at most 50 contact-source People, get one explicit people/* contact, prepare locally, and create or safely update only names, \
                    email addresses, phone numbers, and organizations through approval or Direct writes. Updates fetch the latest contact source and ETag first. Never access directory people, other contacts, search, contact groups or \
                    memberships, photos, addresses, birthdays, biographies, relations, events, external IDs, user-defined or other broad Person fields; delete or batch contacts; follow page or sync tokens; call raw endpoints; use service \
                    accounts/domain delegation; or access another account.
                    """
        case "google-photos":
            return
                """
                    Use only the four brokered Relay Google Photos Picker wrappers with exact photospicker.mediaitems.readonly scope. Create at most one 25-item user-controlled selection session through approval or Direct writes, check one \
                    explicit session without polling, list the first 25 selected metadata summaries once, and clean up the session without deleting user media. Never request removed Library scopes; access the whole library, uploads, \
                    app-created data, albums or sharing; return base URLs, raw bytes, thumbnails, camera/EXIF or faces; train ML, advertise or broker data; follow page tokens or poll automatically; call raw endpoints; use service \
                    accounts/domain delegation; or access another account.
                    """
        case "google-meet":
            return
                """
                    Use only the four brokered Relay Google Meet wrappers with exact meetings.space.created scope. Get one explicit Space created by Relay's Google Cloud app, prepare locally, and create or patch only RESTRICTED/TRUSTED \
                    moderated Spaces through approval or Direct writes. Every write forces host-only chat/reactions/presentation, viewer default, no attendance report, and no automatic recording/transcription/smart notes. Never use OPEN \
                    access or moderation off; end an active conference; expose conference record IDs, participants/sessions, recordings, transcripts, smart notes, Drive artifacts, phone/PIN or SIP details; use events, \
                    Media/eCDN/hardware/add-on APIs; request broad Meet or Drive scopes; call raw endpoints; paginate automatically; use service accounts/domain delegation; or access another account.
                    """
        case "google-chat":
            return
                """
                    Use only the four brokered Relay Google Chat wrappers with exact user-auth read-only Space/Message and message-create scopes. Get one explicit Space, list only its newest first page of at most 25 privacy-bounded \
                    plain-text messages, prepare locally, and send one 4,000-character plain-text message or fail-closed same-space thread reply through approval or Direct writes. Never discover Spaces; access sender identity, memberships, \
                    formatted/annotated/rich/private content, attachments/media, reactions, or quoted/deleted data; modify/delete existing messages; administer/import Spaces; use app/bot/admin auth, mass/user markup mentions, raw endpoints, \
                    automatic retries/pagination, service accounts/domain delegation; or access another account.
                    """
        case "google-ads":
            return
                """
                    Use only the two read-only brokered Relay Google Ads wrappers with the explicit configured ten-digit customer ID. Get bounded customer metadata or compare at most 50 non-removed campaigns over LAST_30_DAYS using Relay's \
                    fixed GAQL queries. Treat costMicros and conversion metrics as reporting data only. Never discover accounts or traverse hierarchies; supply raw GAQL; use SearchStream, exports, schedules, page tokens, or automatic \
                    retries; access users, audiences, Customer Match, search terms, click/GCLID/IP/location detail, offline conversions, billing or links; mutate campaigns, ads, keywords, assets, budgets, bids, recommendations or any \
                    provider object; use planning, raw tools, service accounts/delegation; or access another customer.
                    """
        case "google-analytics":
            return
                """
                    Use only the two read-only brokered Relay Google Analytics wrappers with the explicit configured numeric GA4 property ID and exact analytics.readonly scope. Read safe property metadata or the fixed aggregate overview for \
                    30daysAgo through yesterday with at most 25 sessionDefaultChannelGroup rows. Never discover accounts, properties, streams, or hierarchy; supply dimensions, metrics, dates, filters, offsets, or raw report bodies; use \
                    realtime, batch, pivot, funnel, access, metadata, compatibility, audience export/list, recurring export, or report-task APIs; access users, demographics, interests, pages, searches, geography, custom dimensions, or event \
                    parameters; mutate admin resources, send Measurement Protocol events, import/delete/export; use raw tools, retries, polling, pagination, service accounts/delegation; or access another property.
                    """
        case "google-merchant-center":
            return
                """
                    Use only the four read-only brokered Relay Google Merchant Center wrappers with the explicit connection-bound accounts/{id} resource and exact content scope. List the first 50 accessible accounts, list the first 50 \
                    processed products for the selected account, get one explicit product, or run Relay's fixed 50-row product-issues report. Preserve useful offer identity, product attributes, destination status, and item issue \
                    code/severity/resolution/description/documentation. Never mutate products, product inputs, inventory, data sources, promotions, reviews, conversions, accounts, users, shipping, returns, registration, or quotas; supply \
                    Merchant Query Language, fields, filters, tables or page tokens; auto-paginate, export, batch, stream, use service accounts, raw tools, v1beta or Content API; or access another Merchant account.
                    """
        case "youtube":
            return
                """
                    Use only the four read-only brokered Relay YouTube wrappers with exact youtube.readonly scope and the connected creator channel. Get the channel and uploads playlist, list at most 25 owned playlists or explicit playlist \
                    items, and inspect at most 25 explicit video IDs from prior results. Preserve titles, bounded descriptions, dates, duration, privacy/caption/live status, and returned statistics; identify YouTube as the source. Never \
                    search, access history or Watch Later, auto-paginate, export broadly, upload or mutate videos/playlists/comments/captions/ratings/subscriptions, use \
                    live/analytics/reporting/membership/partner/content-owner/raw/undocumented services, service accounts, or another account.
                    """
        case "google-classroom":
            return
                """
                    Use only the four read-only brokered Relay Google Classroom wrappers with the exact courses.readonly, coursework.me.readonly, and courseworkmaterials.readonly scopes for the connected requesting user. List at most 25 \
                    permitted courses, get one explicit prior-result course, and list at most 25 newest coursework or material posts for that course. Preserve useful titles, bounded descriptions, states, dates, due information, and safe \
                    attachment link metadata. Never access rosters, profiles, emails/photos, invitations, guardians, enrollment codes, student submissions/responses/attachments, grades/rubrics/gradebook, individual student IDs, Drive \
                    contents, or announcements; mutate, grade, turn in, delegate, impersonate, administer, preview, export, paginate, call raw tools, or access another user.
                    """
        case "outlook":
            return
                """
                    Use only the four read-only brokered Relay Outlook wrappers with delegated Mail.Read for the signed-in user's own mailbox. List visible root folders, the newest 25 Inbox messages, the newest 25 unread Inbox messages, or \
                    get one explicit prior-result message with at most 8,000 plain-text body characters. Preserve useful subject, sender/recipient, timestamps, read/importance/attachment flags, categories and preview. Never access \
                    shared/other-user/application mail, attachments or MIME/headers/extensions, hidden-folder recursion, search, arbitrary OData, delta, subscriptions, pagination or exports; draft, reply, forward, send, mark, move, delete, \
                    flag or categorize; access calendar, contacts, files, Teams or directory; call raw tools or expose HTML/tokens.
                    """
        case "microsoft-teams":
            return
                """
                    Use only the four read-only brokered Relay Microsoft Teams wrappers with exact delegated Team.ReadBasic.All and Channel.ReadBasic.All for the signed-in work account. List at most 25 directly joined teams, get one \
                    explicit team, and list or get visible channel metadata for an explicit team. Preserve names, bounded descriptions, visibility or membership type, archive state and safe web URLs. Never read channel messages, replies, \
                    chats, bodies, sender identities, reactions, members, owners, directory data, files, tabs, apps, meetings, calls, recordings or transcripts; enumerate the tenant; create/update/archive/delete teams or channels; \
                    send/edit/delete messages; search, subscribe, export, paginate, use application/admin-consent/RSC or metered APIs, or call raw Graph tools.
                    """
        case "onedrive":
            return
                """
                    Use only the four read-only brokered Relay OneDrive wrappers with exact delegated Files.Read for the signed-in user's own /me/drive. Get bounded drive/quota metadata, list the first 25 root or explicit-folder items, or \
                    inspect one explicit prior-result file/folder. Preserve names, file/folder type, size, timestamps, safe web URL, MIME/hash or child count where returned. Never return file bytes, download URLs, previews, thumbnails, \
                    workbook/document content, identities or sharing metadata; access shared/remote items, search/recent/share tokens, versions, permissions, subscriptions, delta or exports; \
                    upload/create/rename/edit/move/copy/delete/restore/share/comment/lock; access other users/sites/groups/drives, application/selected/admin permissions, raw Graph tools, or pagination.
                    """
        case "sharepoint":
            return
                """
                    Use only the four read-only brokered Relay SharePoint wrappers with exact delegated Sites.Selected and the connection-bound administrator-granted site. Get site metadata, list at most 25 named lists or document \
                    libraries, or list at most 25 metadata-only root files/folders in the default library. Preserve useful names, descriptions, templates/types, URLs and timestamps. Never search/enumerate the tenant, sites or subsites; \
                    access list items/fields/columns/pages/webparts, file bytes/downloads/previews, people/groups/permissions/sharing/analytics, versions/delta/subscriptions; create/update/delete/upload/share/move/copy/publish/administer or \
                    change grants; access other sites/drives, broad/application scopes, raw Graph tools, exports or pagination.
                    """
        case "microsoft-planner":
            return
                """
                    Use only the four read-only brokered Relay Microsoft Planner wrappers with exact delegated Tasks.Read for the signed-in work or school account. List at most 25 assigned tasks, get one explicit prior-result task or plan, \
                    or list at most 25 tasks for one explicit prior-result plan. Preserve useful titles, plan/bucket IDs, progress, priority and dates while excluding assignment identities and task details. Never discover groups, members, \
                    users, plans, buckets, rosters or containers; resolve assignees; access descriptions, checklists, references or attachments; create/update/assign/complete/reorder/move/delete; use application/all-user/admin access, \
                    another account, raw Graph, exports, page tokens, retries, polling or automatic pagination.
                    """
        case "microsoft-to-do":
            return
                """
                    Use only the four read-only brokered Relay Microsoft To Do wrappers with exact delegated Tasks.Read for the signed-in Microsoft account. List at most 25 task lists, get one explicit prior-result list, list at most 25 \
                    tasks in an explicit list, or get one explicit prior-result task. Preserve useful list names/ownership/shared flags and task titles/status/importance/reminders/dates while excluding bodies, categories and related \
                    content. Never read notes/bodies/categories, checklists, linked resources, attachments, extensions or collaborator identities; expand shared tasks; use delta or local mirroring; \
                    create/update/complete/move/reorder/delete; use application/all-user/admin access, another user, OData customization, raw Graph, exports, page tokens, retries, polling or automatic pagination.
                    """
        case "microsoft-lists":
            return
                """
                    Use only the four read-only brokered Relay Microsoft Lists wrappers with exact delegated Lists.SelectedOperations.Selected, one administrator-granted connection-bound list, and its fixed approved field-name allowlist. \
                    Get selected-list metadata, list approved column metadata, or read at most 25 items / one explicit item with only approved fields. Never discover or access other lists/sites; return unapproved, hidden, system, person, \
                    lookup or location fields; read created-by/modified-by identities, attachments, drive content, permissions, sharing, analytics, versions or content types; create/update/delete/move/share/approve/administer; use delta, \
                    search, subscriptions, exports, pagination, application/all-site scopes, beta/raw endpoints, arbitrary OData, retries or polling.
                    """
        case "onenote":
            return
                """
                    Use only the four read-only brokered Relay OneNote wrappers with exact delegated Notes.Read and the signed-in user's /me/onenote metadata. List at most 25 notebooks, list at most 25 sections for an explicit prior-result \
                    notebook, list at most 25 page metadata records for an explicit prior-result section, or inspect one explicit page's title/order/timestamps. Never fetch page HTML/content URLs/previews/body/tags; images, files, \
                    audio/video, resources, OCR or captures; other users, shared/group/site notebooks; search, class/staff notebooks; create/update/delete/copy/move/share/append; permissions, subscriptions, webhooks or operations; \
                    application/Notes.Read.All scopes, raw/beta endpoints, OData customization, exports, retries, polling or automatic pagination.
                    """
        case "microsoft-bookings":
            return
                """
                    Use only the four read-only brokered Relay Microsoft Bookings wrappers with exact delegated Bookings.Read.All and the connection-bound selected work-account booking business. Read business metadata, at most 25 services, \
                    one explicit prior-result service, or a privacy-scrubbed calendar view for an explicit range of at most seven days. Never return customers, names, emails, phones, time zones, notes, answers, staff identities, additional \
                    information, join URLs, reminders, locations, custom questions or raw appointment details; discover other businesses; create/update/cancel/delete/publish; use application or write scopes, beta/raw endpoints, arbitrary \
                    OData, exports, retries, polling or automatic pagination.
                    """
        case "microsoft-power-bi":
            return
                """
                    Use only the four read-only brokered Relay Microsoft Power BI wrappers with exact delegated Workspace.Read.All, Report.Read.All and Dataset.Read.All for the connection-bound selected work-account workspace. Read \
                    workspace metadata, at most 25 named reports, at most 25 named semantic models, or one explicit prior-result semantic model. Never read report pages, visuals, content or data; expose embed/web URLs or tokens; query \
                    semantic models, DAX, rows, tables, schema, datasources or credentials; expose configured-by owners, users, principals or access rights; access dashboards, tiles, apps, dataflows, refreshes, gateways, capacities, \
                    admin/scanner APIs or subscriptions; export/download/create/update/delete/rebind/clone/takeover/share; use service principals, application/write scopes, other workspaces, beta/raw endpoints, arbitrary OData, retries, \
                    polling or automatic pagination.
                    """
        case "microsoft-dynamics-365":
            return
                """
                    Use only the four GET-only brokered Relay Microsoft Dynamics 365 wrappers for the connection-bound verified Dataverse Sales environment and its exact environment user_impersonation scope. Read organization metadata, at \
                    most 25 fixed-field business accounts, one explicit prior-result account, or at most 25 fixed-field opportunity summaries. Never read contacts, leads, addresses, emails, phones, activities, notes, attachments, owners, \
                    users, teams, customer lookups, free text, custom tables/columns, formatted identity annotations, expansions, FetchXML/search, alternate keys, aggregates, change tracking, schema/metadata, actions/functions/batch; \
                    create/update/delete/upsert/assign/share/merge; access other environments, application users, exports, raw endpoints, arbitrary OData, retries, polling or automatic pagination.
                    """
        case "microsoft-viva-engage":
            return
                """
                    Use only the four GET-only brokered Relay Microsoft Viva Engage wrappers with exact delegated access_as_user and the connection-bound work-account network, current user, and selected community. Read safe \
                    network/current-user metadata, at most 25 joined community summaries, or at most 25 bounded recent selected-community conversation summaries. Never access private/direct messages, global/following/algo feeds, emails, \
                    contacts, profiles, member or user directories, sender/mention/reaction identities, attachments/files/downloads, topics/search, bulk/data exports; post/reply/like/delete, change memberships/subscriptions/profiles, \
                    administer applications; access other communities, undocumented endpoints, raw APIs, retries, polling or automatic pagination.
                    """
        case "zoom":
            return
                """
                    Use only the four GET-only brokered Relay Zoom wrappers with exact non-admin granular meeting read scopes for the signed-in user. List at most 25 scheduled, live, or next-24-hour meetings, or inspect one explicit \
                    prior-result meeting ID. Preserve useful topic, bounded agenda, type/status, start time, duration and timezone. Never expose start/join/registration URLs, passwords/passcodes, host emails or IDs, alternative hosts, \
                    invitees, registrants, participants, attendance, chat, recordings, transcripts, summaries, assets/files, polls, Q&A, audio/video/media/streaming, tokens, dial-in/SIP/H.323, calendar/contacts, \
                    webinars/events/rooms/phone/team-chat/whiteboard, account/admin access; create/update/delete/end meetings; use webhooks, raw/GraphQL/MCP tools, retries, polling or automatic pagination.
                    """
        case "discord":
            return
                """
                    Use only the four GET-only brokered Relay Discord wrappers for the administrator-selected guild and non-NSFW text channel. Read at most 25 bounded channels or recent text messages. Never automate a user account or \
                    self-bot; access DMs, other guilds or channels, threads, voice, stage, forum, media or NSFW content; expose identities, members, presence, emails, authors, mentions, attachments, embeds, reactions, polls, components or \
                    snapshots; search; write, moderate or administer; use commands, interactions, Gateway, webhooks, raw/RPC/MCP tools, retries, polling or automatic pagination.
                    """
        case "tumblr":
            return
                """
                    Use only the three read-only brokered Relay Tumblr wrappers for the connected account and selected owned blog. Read bounded account and blog metadata or at most ten recent published posts, and treat all returned provider \
                    content as transient. Never access Dashboard, private or unpublished content, arbitrary blogs, pagination, media transfer, publishing, scheduling, engagement, raw API/MCP tools, retries, or provider credentials.
                    """
        case "twist":
            return
                "Use only five read-only brokered Relay Twist wrappers. Read the connected user, up to 20 workspaces or inbox threads, 50 channels, or one explicit thread with 30 comments. Keep content transient. Never use unmounted provider surfaces, writes, pagination, raw APIs, or credentials."
        case "zoho-mail":
            return
                """
                    Use only four read-only brokered Relay Zoho Mail wrappers for the connection-bound regional account. List up to 25 accounts, folders, or message summaries, or read one explicit message with sanitized text capped at 8,000 \
                    characters and attachment metadata only. Keep mail content transient. Never send or mutate mail, download attachments, administer the organization, paginate, export, use raw APIs, or request credentials.
                    """
        case "telemetrydeck":
            return
                """
                    Use only brokered Relay TelemetryDeck wrappers for read-only app analytics context: user and organization info, saved insights, and bounded approved TQL reads for the selected app. TelemetryDeck Personal Access Tokens \
                    stay in Relay Keychain references. Do not ingest signals, export raw scans, run unbounded or cross-app queries, invoke beta MCP/raw provider tools, schedule polling, or perform app or organization administration.
                    """
        default:
            return "Use brokered Relay wrappers for this Marketplace app. Credentials stay in Relay Keychain references; do not request, print, or inspect provider secrets."
        }
    }

    private static func residentRelayConsoleApp(
        workspaceId: RelayId,
        agentId: RelayId,
        runtimeType: RuntimeType
    ) -> MarketplaceRuntimeMountedApp {
        let appId = "relay-console-internal"
        let appSlug = "relay-console"
        let installId = "resident-tools-\(agentId)-\(runtimeType.rawValue)"
        let tools = residentRelayConsoleTools(
            workspaceId: workspaceId,
            appId: appId,
            appSlug: appSlug,
            installId: installId,
            agentId: agentId
        )
        return MarketplaceRuntimeMountedApp(
            appId: appId,
            appSlug: appSlug,
            appName: "Relay Console",
            installId: installId,
            connectionId: nil,
            permissionMapId: nil,
            policyPreset: .allowDirectWrites,
            connected: true,
            assignedAgentReady: true,
            instructions: "Use these internal Relay Console tools to inspect and help complete app connections. Prefer app-native Connect actions when available; use manual setup tools only for fallback or diagnostics. Never echo secret values back to chat.",
            tools: tools,
            diagnostics: RelayProviderWrapperToolDiagnostics(
                availableToolCount: tools.count,
                approvalRequiredCount: 0,
                autoExecuteCount: 0,
                blockedActionCount: 0,
                unavailableActionCount: 0,
                suppressedRawProviderToolCount: 0,
                connected: true,
                assignedAgentReady: true,
                rawProviderToolExposure: false,
                executionAuthority: .deviceLocal,
                executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
                authorityReady: true,
                message: "Resident Relay Console internal tools are mounted.",
                redactionStatus: "private-state-excluded"
            ),
            redactionStatus: "private-state-excluded"
        )
    }

    private static func residentRelayConsoleTools(
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        installId: RelayId,
        agentId: RelayId
    ) -> [RelayProviderWrapperTool] {
        [
            residentTool(
                workspaceId: workspaceId,
                appId: appId,
                appSlug: appSlug,
                installId: installId,
                agentId: agentId,
                toolName: "relay_console_google_docs_status",
                displayName: "Google Docs Connection Status",
                summary: "Inspect whether Google Docs is connected and return Relay's current connection state.",
                kind: .read,
                riskLevel: .low,
                readOnly: true,
                inputSchema: objectSchema(properties: [:], required: []),
                resultSchema: objectSchema(properties: [:], required: [])
            ),
            residentTool(
                workspaceId: workspaceId,
                appId: appId,
                appSlug: appSlug,
                installId: installId,
                agentId: agentId,
                toolName: "relay_console_google_docs_open_setup",
                displayName: "Open Google Docs Setup",
                summary: "Open Google Cloud pages for Google Docs OAuth troubleshooting or manual fallback setup.",
                kind: .admin,
                riskLevel: .medium,
                readOnly: false,
                inputSchema: objectSchema(
                    properties: [
                        "targets": .object([
                            "type": .string("array"),
                            "items": .object([
                                "type": .string("string"),
                                "enum": .array([
                                    "cloudConsole",
                                    "oauthCredentials",
                                    "docsApi",
                                    "oauthConsent",
                                    "oauthPlayground"
                                ].map(JSONValue.string))
                            ]),
                            "description": .string("Optional setup pages to open. Omit to open the standard credential workflow pages.")
                        ])
                    ],
                    required: []
                ),
                resultSchema: objectSchema(properties: [:], required: [])
            ),
            residentTool(
                workspaceId: workspaceId,
                appId: appId,
                appSlug: appSlug,
                installId: installId,
                agentId: agentId,
                toolName: "relay_console_google_docs_oauth_authorization_url",
                displayName: "Create Google Docs OAuth Consent URL",
                summary: "Create and open a Google OAuth consent URL for the supplied Desktop OAuth client as a manual fallback.",
                kind: .admin,
                riskLevel: .medium,
                readOnly: false,
                inputSchema: objectSchema(
                    properties: [
                        "clientId": stringSchema("Google OAuth desktop client ID."),
                        "redirectUri": stringSchema("Optional loopback redirect URI. Defaults to Relay Console's local Google Docs OAuth callback path.")
                    ],
                    required: ["clientId"]
                ),
                resultSchema: objectSchema(properties: [:], required: [])
            ),
            residentTool(
                workspaceId: workspaceId,
                appId: appId,
                appSlug: appSlug,
                installId: installId,
                agentId: agentId,
                toolName: "relay_console_google_docs_exchange_auth_code",
                displayName: "Exchange Google Docs OAuth Code",
                summary: "Exchange a Google OAuth authorization code for a refresh token and save the Google Docs connection securely.",
                kind: .admin,
                riskLevel: .high,
                readOnly: false,
                inputSchema: objectSchema(
                    properties: [
                        "clientId": stringSchema("Google OAuth desktop client ID."),
                        "clientSecret": stringSchema("Google OAuth desktop client secret."),
                        "authorizationCode": stringSchema("Authorization code returned by Google after consent."),
                        "authorizationCallbackURL": stringSchema("Full browser address-bar URL after Google redirects. Relay will parse the code and redirect URI from it."),
                        "state": stringSchema("Optional Relay OAuth state returned by the authorization URL tool."),
                        "timeoutSeconds": stringSchema("Optional number of seconds to wait for Relay's local callback capture. Defaults to 90."),
                        "redirectUri": stringSchema("Optional redirect URI used to create the authorization URL."),
                        "accountEmail": stringSchema("Optional Google account email for the connection label."),
                        "projectId": stringSchema("Optional Google Cloud project ID."),
                        "displayName": stringSchema("Optional display name for the saved connection.")
                    ],
                    required: ["clientId", "clientSecret"]
                ),
                resultSchema: objectSchema(properties: [:], required: [])
            ),
            residentTool(
                workspaceId: workspaceId,
                appId: appId,
                appSlug: appSlug,
                installId: installId,
                agentId: agentId,
                toolName: "relay_console_google_docs_save_oauth_credentials",
                displayName: "Save Google Docs OAuth Credentials",
                summary: "Save a manually supplied Google Docs OAuth credential set into Relay's Keychain-backed connection store.",
                kind: .admin,
                riskLevel: .high,
                readOnly: false,
                inputSchema: objectSchema(
                    properties: [
                        "clientId": stringSchema("Google OAuth client ID."),
                        "clientSecret": stringSchema("Google OAuth client secret."),
                        "refreshToken": stringSchema("Google OAuth refresh token."),
                        "accessToken": stringSchema("Optional current Google OAuth access token."),
                        "accountEmail": stringSchema("Optional Google account email for the connection label."),
                        "projectId": stringSchema("Optional Google Cloud project ID."),
                        "displayName": stringSchema("Optional display name for the connection.")
                    ],
                    required: ["clientId", "clientSecret", "refreshToken"]
                ),
                resultSchema: objectSchema(properties: [:], required: [])
            )
        ].filter {
            ![
                "relay_console_google_docs_oauth_authorization_url",
                "relay_console_google_docs_exchange_auth_code",
                "relay_console_google_docs_save_oauth_credentials"
            ].contains($0.toolName)
        }
    }

    private static func residentTool(
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        installId: RelayId,
        agentId: RelayId,
        toolName: String,
        displayName: String,
        summary: String,
        kind: ProviderActionKind,
        riskLevel: ProviderActionRiskLevel,
        readOnly: Bool,
        inputSchema: JSONRecord,
        resultSchema: JSONRecord
    ) -> RelayProviderWrapperTool {
        RelayProviderWrapperTool(
            id: "\(installId)-\(toolName)",
            workspaceId: workspaceId,
            appId: appId,
            appSlug: appSlug,
            executionAuthority: .deviceLocal,
            executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
            installId: installId,
            agentId: agentId,
            toolName: toolName,
            displayName: displayName,
            summary: summary,
            kind: kind,
            riskLevel: riskLevel,
            permission: .allowed,
            executionMode: .allowed,
            requiresApproval: false,
            autoExecutes: false,
            readOnly: readOnly,
            inputSchema: inputSchema,
            resultSchema: resultSchema,
            metadata: [
                "brokeredBy": .string("resident-relay-console-tools"),
                "redactionStatus": .string("private-state-excluded")
            ],
            redactionStatus: "private-state-excluded"
        )
    }

    private static func objectSchema(properties: JSONRecord, required: [String]) -> JSONRecord {
        [
            "type": .string("object"),
            "properties": .object(properties),
            "required": .array(required.map(JSONValue.string)),
            "additionalProperties": .bool(false)
        ]
    }

    private static func stringSchema(_ description: String) -> JSONValue {
        .object([
            "type": .string("string"),
            "description": .string(description)
        ])
    }

    private static func fingerprintPayload(
        workspaceId: RelayId,
        agentId: RelayId,
        runtimeType: RuntimeType,
        apps: [MarketplaceRuntimeMountedApp]
    ) -> String {
        var record: JSONRecord = [
            "workspaceId": .string(workspaceId),
            "agentId": .string(agentId),
            "runtimeType": .string(runtimeType.rawValue),
            "apps": .array(apps.map { app in
                .object([
                    "appId": .string(app.appId),
                    "appSlug": .string(app.appSlug),
                    "installId": .string(app.installId),
                    "connectionId": app.connectionId.map(JSONValue.string) ?? .null,
                    "permissionMapId": app.permissionMapId.map(JSONValue.string) ?? .null,
                    "policyPreset": app.policyPreset.map { .string($0.rawValue) } ?? .null,
                    "connected": .bool(app.connected),
                    "assignedAgentReady": .bool(app.assignedAgentReady),
                    "tools": .array(app.tools.map { tool in
                        .object([
                            "toolName": .string(tool.toolName),
                            "displayName": .string(tool.displayName),
                            "permission": .string(tool.permission.rawValue),
                            "executionMode": .string(tool.executionMode.rawValue),
                            "readOnly": .bool(tool.readOnly),
                            "requiresApproval": .bool(tool.requiresApproval),
                            "autoExecutes": .bool(tool.autoExecutes)
                        ])
                    })
                ])
            })
        ]
        record["rawProviderToolExposure"] = .bool(false)
        return encodeJSONRecord(record)
    }

    private static func sha256(_ text: String) -> String {
        let digest = SHA256.hash(data: Data(text.utf8))
        return "sha256:" + digest.map { String(format: "%02x", $0) }.joined()
    }
}
