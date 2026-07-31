import Foundation

public protocol ProviderConnectionAdapter: Sendable {
  var id: String { get }
  var providerSlugs: Set<String> { get }
}

public enum ProviderConnectionAdapterRegistryError: Error, Equatable {
  case duplicateAdapterID(String)
  case duplicateProviderSlug(String)
}

public struct ProviderConnectionFamilyAdapter: ProviderConnectionAdapter, Equatable {
  public let id: String
  public let providerSlugs: Set<String>
  public let railwayManagedProviderSlugs: Set<String>

  public init(
    id: String,
    providerSlugs: Set<String>,
    railwayManagedProviderSlugs: Set<String> = []
  ) {
    self.id = id
    self.providerSlugs = providerSlugs.union(railwayManagedProviderSlugs)
    self.railwayManagedProviderSlugs = railwayManagedProviderSlugs
  }
}

public struct ProviderConnectionAdapterRegistry: Sendable {
  public let adapters: [ProviderConnectionFamilyAdapter]
  private let adapterByProviderSlug: [String: ProviderConnectionFamilyAdapter]

  public init(adapters: [ProviderConnectionFamilyAdapter]) throws {
    var adapterIDs = Set<String>()
    var byProviderSlug: [String: ProviderConnectionFamilyAdapter] = [:]
    for adapter in adapters {
      guard adapterIDs.insert(adapter.id).inserted else {
        throw ProviderConnectionAdapterRegistryError.duplicateAdapterID(adapter.id)
      }
      for slug in adapter.providerSlugs {
        guard byProviderSlug[slug] == nil else {
          throw ProviderConnectionAdapterRegistryError.duplicateProviderSlug(slug)
        }
        byProviderSlug[slug] = adapter
      }
    }
    self.adapters = adapters
    adapterByProviderSlug = byProviderSlug
  }

  public func adapter(for providerSlug: String) -> ProviderConnectionFamilyAdapter? {
    adapterByProviderSlug[providerSlug]
  }

  public static let production: ProviderConnectionAdapterRegistry = {
    do {
      return try ProviderConnectionAdapterRegistry(adapters: productionAdapters)
    } catch {
      preconditionFailure("Invalid provider connection adapter registry: \(error)")
    }
  }()

  private static let productionAdapters = [
    ProviderConnectionFamilyAdapter(
      id: "social",
      providerSlugs: [
        "x", "facebook-pages", "instagram-business", "threads", "pinterest", "tumblr",
        "mastodon", "bluesky",
      ],
      railwayManagedProviderSlugs: ["nextdoor", "meetup", "eventbrite"]),
    ProviderConnectionFamilyAdapter(
      id: "google",
      providerSlugs: [
        "gmail", "google-ads", "google-analytics", "google-calendar", "google-chat",
        "google-classroom", "google-contacts", "google-docs", "google-drive", "google-forms",
        "google-meet", "google-merchant-center", "google-photos", "google-search-console",
        "google-sheets", "google-slides", "google-tasks", "youtube",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "microsoft",
      providerSlugs: [
        "outlook", "microsoft-teams", "onedrive", "sharepoint", "microsoft-planner",
        "microsoft-to-do", "microsoft-lists", "onenote", "microsoft-bookings",
        "microsoft-power-bi", "microsoft-viva-engage", "microsoft-dynamics-365",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "communications",
      providerSlugs: ["discord", "zoom", "linkedin"],
      railwayManagedProviderSlugs: [
        "dialpad", "goto-meeting", "line", "ringcentral", "twist", "webex", "zoho-mail",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "developer-collaboration",
      providerSlugs: ["slack", "github", "gitlab", "bitbucket", "telemetrydeck"]),
    ProviderConnectionFamilyAdapter(
      id: "work-management",
      providerSlugs: [
        "linear", "asana", "trello", "clickup", "monday-com", "airtable", "dropbox", "box",
        "figma", "miro", "canva",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "commerce-finance",
      providerSlugs: [
        "shopify", "woocommerce", "stripe", "xero", "quickbooks", "freshbooks", "wave",
        "freeagent", "salesforce",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "crm-support",
      providerSlugs: [
        "hubspot", "pipedrive", "copper", "close", "zendesk", "intercom", "help-scout",
        "front", "teamwork", "basecamp",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "work-signature",
      providerSlugs: [
        "wrike", "smartsheet", "todoist", "harvest", "calendly", "cal-com", "docusign",
        "dropbox-sign", "pandadoc",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "marketing",
      providerSlugs: [
        "typeform", "surveymonkey", "fillout", "mailchimp", "sendfox", "beehiiv",
        "substack", "hootsuite", "buffer", "sprout-social", "agorapulse", "metricool",
        "publer", "brandwatch", "mention", "meltwater", "sprinklr", "khoros", "clevertap",
        "klaviyo", "convertkit", "campaign-monitor", "constant-contact", "webflow",
        "wordpress-com", "contentful",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "push-data",
      providerSlugs: [
        "onesignal", "airship", "pushwoosh", "pusher-beams", "firebase-cloud-messaging",
        "appsflyer", "adjust", "branch", "singular", "kochava", "segment-personas",
        "mparticle", "tealium", "lytics", "blueconic", "treasure-data", "later",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "observability",
      providerSlugs: [
        "notion", "posthog", "microsoft-clarity", "sentry", "datadog", "pagerduty",
        "exa-search",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "infrastructure-hr",
      providerSlugs: [
        "cloudflare", "vercel", "heroku", "digitalocean", "firebase", "supabase", "okta",
        "bamboohr", "greenhouse", "lever",
      ]),
    ProviderConnectionFamilyAdapter(
      id: "legal",
      providerSlugs: [
        "hightouch", "census", "clio-manage", "clio-grow", "mycase", "practicepanther",
        "smokeball", "lawpay", "filevine",
      ]),
  ]
}
