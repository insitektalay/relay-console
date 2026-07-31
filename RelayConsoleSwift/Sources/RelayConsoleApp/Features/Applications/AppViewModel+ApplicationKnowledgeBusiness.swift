import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func saveDocument360RailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-document360-api-token", refresh: .applications) {
      guard app.slug == "document360", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let token = self.document360APITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let origin = self.document360APIOriginDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      guard !token.isEmpty, let url = URL(string: origin), url.scheme == "https",
        let host = url.host,
        host == "apihub.document360.io"
          || (host.hasPrefix("apihub.") && host.hasSuffix(".document360.io"))
      else {
        throw RelayError(
          .invalidInput, "Enter a Document360 API token and an official HTTPS API Hub origin.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "document360", "displayName": "Document360 project API token",
          "authType": "api_key",
          "credentials": ["DOCUMENT360_API_TOKEN": token, "DOCUMENT360_API_ORIGIN": origin],
          "selectedCapabilities": ["knowledge_read", "knowledge_write", "administration"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Document360 connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/document360/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Document360 rejected the API token or origin.")
      }
      self.document360APITokenDraft = ""
      self.document360ConnectionStatus = "Document360 connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveArchbeeRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-archbee-api-key", refresh: .applications) {
      guard app.slug == "archbee", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let docSpaceId = self.archbeeDocSpaceIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let apiKey = self.archbeeAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !docSpaceId.isEmpty, !apiKey.isEmpty else {
        throw RelayError(.invalidInput, "Archbee DocSpace ID and API key are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "archbee", "displayName": "Archbee DocSpace API key", "authType": "api_key",
          "credentials": ["ARCHBEE_DOC_SPACE_ID": docSpaceId, "ARCHBEE_API_KEY": apiKey],
          "selectedCapabilities": ["knowledge_read", "knowledge_write", "organization_admin"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Archbee connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/archbee/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Archbee rejected the DocSpace credentials.")
      }
      self.archbeeAPIKeyDraft = ""
      self.archbeeConnectionStatus = "Archbee connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveTettraRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-tettra-api-key", refresh: .applications) {
      guard app.slug == "tettra", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let teamId = self.tettraTeamIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let apiKey = self.tettraAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !teamId.isEmpty, teamId.allSatisfy({ $0.isNumber }), !apiKey.isEmpty else {
        throw RelayError(.invalidInput, "Tettra numeric team ID and API key are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "tettra", "displayName": "Tettra team API key", "authType": "api_key",
          "credentials": ["TETTRA_TEAM_ID": teamId, "TETTRA_API_KEY": apiKey],
          "selectedCapabilities": [
            "knowledge_read", "knowledge_write", "questions", "category_admin",
          ],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Tettra connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/tettra/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Tettra rejected the team credentials.")
      }
      self.tettraAPIKeyDraft = ""
      self.tettraConnectionStatus = "Tettra connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveKnowledgeOwlRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-knowledgeowl-api-key", refresh: .applications) {
      guard app.slug == "knowledgeowl", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let projectId = self.knowledgeOwlProjectIDDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      let apiKey = self.knowledgeOwlAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !projectId.isEmpty, !apiKey.isEmpty else {
        throw RelayError(.invalidInput, "KnowledgeOwl knowledge base ID and API key are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "knowledgeowl", "displayName": "KnowledgeOwl knowledge base API key",
          "authType": "api_key",
          "credentials": ["KNOWLEDGEOWL_PROJECT_ID": projectId, "KNOWLEDGEOWL_API_KEY": apiKey],
          "selectedCapabilities": [
            "knowledge_read", "knowledge_write", "people_admin", "administration",
          ],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the KnowledgeOwl connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/knowledgeowl/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "KnowledgeOwl rejected the project credentials.")
      }
      self.knowledgeOwlAPIKeyDraft = ""
      self.knowledgeOwlConnectionStatus = "KnowledgeOwl connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveFreshdeskConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-freshdesk-api-key", refresh: .applications) {
      guard app.slug == "freshdesk", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let rawDomain = self.freshdeskDomainDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      let domain =
        rawDomain
        .replacingOccurrences(of: "https://", with: "")
        .replacingOccurrences(of: "http://", with: "")
        .replacingOccurrences(of: ".freshdesk.com/", with: "")
        .replacingOccurrences(of: ".freshdesk.com", with: "")
        .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
      let apiKey = self.freshdeskAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !domain.isEmpty, domain.count <= 63,
        domain.range(of: "^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$", options: .regularExpression) != nil,
        !apiKey.isEmpty
      else {
        throw RelayError(
          .invalidInput, "Enter the account name before .freshdesk.com and your Freshdesk API key.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "freshdesk",
          "displayName": "\(domain).freshdesk.com",
          "authType": "api_key",
          "credentials": ["FRESHDESK_DOMAIN": domain, "FRESHDESK_API_KEY": apiKey],
          "selectedCapabilities": ["ticket_read", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Freshdesk connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/freshdesk/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Freshdesk rejected the domain or API key.")
      }
      self.freshdeskDomainDraft = domain
      self.freshdeskAPIKeyDraft = ""
      self.freshdeskConnectionStatus = "Freshdesk connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveSanityRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-sanity-robot-token", refresh: .applications) {
      guard app.slug == "sanity", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let projectId = self.sanityProjectIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let dataset = self.sanityDatasetDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let token = self.sanityAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !projectId.isEmpty, !dataset.isEmpty, !token.isEmpty else {
        throw RelayError(.invalidInput, "Sanity project ID, dataset, and robot token are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "sanity",
          "displayName": "Sanity \(projectId)/\(dataset)",
          "authType": "api_key",
          "credentials": [
            "SANITY_PROJECT_ID": projectId, "SANITY_DATASET": dataset, "SANITY_API_TOKEN": token,
          ],
          "selectedCapabilities": [
            "document_read", "document_draft", "document_update", "document_publish",
          ],
        ]
      )
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Sanity connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/sanity/connections/\(connectionId)/health"
      )
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Sanity rejected these project credentials.")
      }
      self.sanityAPITokenDraft = ""
      self.sanityConnectionStatus = "Sanity connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveStrapiCloudConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-strapi-cloud-content-api-token", refresh: .applications) {
      guard app.slug == "strapi-cloud", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let instanceURL = self.strapiCloudInstanceURLDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      let allowedAPIIDs = self.strapiCloudAllowedAPIIDsDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      let token = self.strapiCloudAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard let parsedURL = URL(string: instanceURL), parsedURL.scheme?.lowercased() == "https",
        parsedURL.host?.lowercased().hasSuffix(".strapiapp.com") == true, parsedURL.user == nil,
        parsedURL.password == nil, parsedURL.port == nil,
        parsedURL.path.isEmpty || parsedURL.path == "/"
      else {
        throw RelayError(
          .invalidInput,
          "Enter the exact HTTPS address for your Strapi Cloud project ending in strapiapp.com.")
      }
      guard !allowedAPIIDs.isEmpty, !token.isEmpty else {
        throw RelayError(
          .invalidInput, "Allowed content types and a Content API token are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "strapi-cloud",
          "displayName": parsedURL.host ?? "Strapi Cloud",
          "authType": "api_key",
          "credentials": [
            "STRAPI_CLOUD_INSTANCE_URL": instanceURL, "STRAPI_CLOUD_ALLOWED_API_IDS": allowedAPIIDs,
            "STRAPI_CLOUD_API_TOKEN": token,
          ],
          "selectedCapabilities": [
            "document_read", "document_draft", "document_update", "document_publish",
          ],
        ]
      )
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Strapi Cloud connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/strapi-cloud/connections/\(connectionId)/health"
      )
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String)
            ?? "Strapi Cloud rejected this address, content-type list, or token.")
      }
      self.strapiCloudAPITokenDraft = ""
      self.strapiCloudConnectionStatus = "Strapi Cloud connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveGhostRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-ghost-custom-integration", refresh: .applications) {
      guard app.slug == "ghost", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let adminURL = self.ghostAdminURLDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let adminAPIKey = self.ghostAdminAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard let parsedURL = URL(string: adminURL), parsedURL.scheme?.lowercased() == "https",
        parsedURL.host?.isEmpty == false
      else {
        throw RelayError(.invalidInput, "Enter the public HTTPS address of your Ghost publication.")
      }
      guard !adminAPIKey.isEmpty else {
        throw RelayError(.invalidInput, "Ghost Admin API key is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "ghost",
          "displayName": parsedURL.host ?? "Ghost publication",
          "authType": "api_key",
          "credentials": ["GHOST_ADMIN_URL": adminURL, "GHOST_ADMIN_API_KEY": adminAPIKey],
          "selectedCapabilities": [
            "site_read", "post_read", "post_draft", "post_update", "post_publish",
          ],
        ]
      )
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Ghost connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/ghost/connections/\(connectionId)/health"
      )
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String)
            ?? "Ghost rejected the publication URL or Custom Integration key.")
      }
      self.ghostAdminAPIKeyDraft = ""
      self.ghostConnectionStatus = "Ghost connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveCodaRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-coda-api-token", refresh: .applications) {
      guard app.slug == "coda", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let apiToken = self.codaAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiToken.isEmpty else {
        throw RelayError(.invalidInput, "Coda API token is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "coda",
          "displayName": "Coda personal API token",
          "authType": "api_key",
          "credentials": ["CODA_API_TOKEN": apiToken],
          "selectedCapabilities": ["doc_read", "table_read", "row_draft", "row_write"],
        ]
      )
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Coda connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/coda/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Coda rejected the API token.")
      }
      self.codaAPITokenDraft = ""
      self.codaConnectionStatus = "Coda connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveVidyardRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-vidyard-api-token", refresh: .applications) {
      guard app.slug == "vidyard", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiToken = self.vidyardAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiToken.isEmpty else {
        throw RelayError(.invalidInput, "Vidyard API token is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "vidyard", "displayName": "Vidyard folder API token", "authType": "api_key",
          "credentials": ["VIDYARD_API_TOKEN": apiToken],
          "selectedCapabilities": ["video_read", "video_write", "analytics", "administration"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Vidyard connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/vidyard/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Vidyard rejected the API token.")
      }
      self.vidyardAPITokenDraft = ""
      self.vidyardConnectionStatus = "Vidyard connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func savePadletRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-padlet-api-token", refresh: .applications) {
      guard app.slug == "padlet", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiToken = self.padletAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiToken.isEmpty else {
        throw RelayError(.invalidInput, "Padlet API key is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "padlet", "displayName": "Padlet personal API key", "authType": "api_key",
          "credentials": ["PADLET_API_KEY": apiToken],
          "selectedCapabilities": [
            "account_read", "board_read", "content_write", "ai_board_create",
          ],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay Console did not return the Padlet connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/padlet/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Padlet rejected the API key.")
      }
      self.padletAPITokenDraft = ""
      self.padletConnectionStatus = "Padlet connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveDescriptRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-descript-api-token", refresh: .applications) {
      guard app.slug == "descript", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiToken = self.descriptAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiToken.isEmpty else {
        throw RelayError(.invalidInput, "Descript API token is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "descript", "displayName": "Descript Drive API token", "authType": "api_key",
          "credentials": ["DESCRIPT_API_TOKEN": apiToken],
          "selectedCapabilities": [
            "projects_read", "transcripts", "production", "publishing", "administration",
          ],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay Console did not return the Descript connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/descript/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Descript rejected the API token.")
      }
      self.descriptAPITokenDraft = ""
      self.descriptConnectionStatus = "Descript connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveTlDvRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-tl-dv-api-key", refresh: .applications) {
      guard app.slug == "tl-dv", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let apiKey = self.tlDvAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty else { throw RelayError(.invalidInput, "tl;dv API key is required.") }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "tl-dv", "displayName": "tl;dv API key", "authType": "api_key",
          "credentials": ["TL_DV_API_KEY": apiKey],
          "selectedCapabilities": ["meeting_knowledge", "meeting_import", "administration"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay Console did not return the tl;dv connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/tl-dv/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String)
            ?? "tl;dv rejected the API key or the account plan does not permit API access.")
      }
      self.tlDvAPIKeyDraft = ""
      self.tlDvConnectionStatus = "tl;dv connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveRevRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-rev-api-keys", refresh: .applications) {
      guard app.slug == "rev", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let clientAPIKey = self.revClientAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let userAPIKey = self.revUserAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !clientAPIKey.isEmpty, !userAPIKey.isEmpty else {
        throw RelayError(.invalidInput, "Both Rev API keys are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "rev", "displayName": "Rev account API keys", "authType": "api_key",
          "credentials": ["REV_CLIENT_API_KEY": clientAPIKey, "REV_USER_API_KEY": userAPIKey],
          "selectedCapabilities": [
            "orders_read", "deliverables", "ordering", "sharing", "administration",
          ],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay Console did not return the Rev connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/rev/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Rev rejected the API keys.")
      }
      self.revClientAPIKeyDraft = ""
      self.revUserAPIKeyDraft = ""
      self.revConnectionStatus = "Rev connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveBuzzsproutRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-buzzsprout-api-token", refresh: .applications) {
      guard app.slug == "buzzsprout", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiToken = self.buzzsproutAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let podcastId = self.buzzsproutPodcastIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiToken.isEmpty,
        podcastId.range(of: "^[1-9][0-9]{0,15}$", options: .regularExpression) != nil
      else {
        throw RelayError(
          .invalidInput, "A Buzzsprout API token and valid numeric podcast ID are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "buzzsprout", "displayName": "Buzzsprout podcast \(podcastId)",
          "authType": "api_key",
          "credentials": ["BUZZSPROUT_API_TOKEN": apiToken, "BUZZSPROUT_PODCAST_ID": podcastId],
          "selectedCapabilities": ["podcast_read", "episode_read", "episode_publish"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(
          .internalError, "Relay Console did not return the Buzzsprout connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/buzzsprout/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String)
            ?? "Buzzsprout rejected the token or it does not authorize that podcast ID.")
      }
      self.buzzsproutAPITokenDraft = ""
      self.buzzsproutPodcastIDDraft = ""
      self.buzzsproutConnectionStatus = "Buzzsprout connected to podcast \(podcastId)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveCaptivateRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-captivate-api-key", refresh: .applications) {
      guard app.slug == "captivate-fm", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.captivateAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let userId = self.captivateUserIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let showId = self.captivateShowIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let uuidPattern =
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
      guard !apiKey.isEmpty, userId.range(of: uuidPattern, options: .regularExpression) != nil,
        showId.range(of: uuidPattern, options: .regularExpression) != nil
      else {
        throw RelayError(
          .invalidInput, "A Captivate API key plus valid user and show UUIDs are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "captivate-fm", "displayName": "Captivate show \(showId)",
          "authType": "api_key",
          "credentials": [
            "CAPTIVATE_API_KEY": apiKey, "CAPTIVATE_USER_ID": userId, "CAPTIVATE_SHOW_ID": showId,
          ], "selectedCapabilities": ["show_read", "episode_read", "analytics", "publishing"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(
          .internalError, "Relay Console did not return the Captivate connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/captivate-fm/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String)
            ?? "Captivate rejected the credentials or they do not authorize that show.")
      }
      self.captivateAPIKeyDraft = ""
      self.captivateUserIDDraft = ""
      self.captivateShowIDDraft = ""
      self.captivateConnectionStatus = "Captivate connected to show \(showId)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveTransistorRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-transistor-api-key", refresh: .applications) {
      guard app.slug == "transistor-fm", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.transistorAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let showId = self.transistorShowIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty,
        showId.range(of: "^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$", options: .regularExpression) != nil
      else {
        throw RelayError(
          .invalidInput, "A Transistor API key and valid show ID or slug are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "transistor-fm", "displayName": "Transistor show \(showId)",
          "authType": "api_key",
          "credentials": ["TRANSISTOR_API_KEY": apiKey, "TRANSISTOR_SHOW_ID": showId],
          "selectedCapabilities": ["show_read", "episode_read", "analytics"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(
          .internalError, "Relay Console did not return the Transistor connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/transistor-fm/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String)
            ?? "Transistor rejected the API key or it does not authorize that show.")
      }
      self.transistorAPIKeyDraft = ""
      self.transistorShowIDDraft = ""
      self.transistorConnectionStatus = "Transistor connected read-only to show \(showId)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveRiversideRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-riverside-api-key", refresh: .applications) {
      guard app.slug == "riverside-fm", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.riversideAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty else {
        throw RelayError(.invalidInput, "A Riverside Business API key is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "riverside-fm", "displayName": "Riverside Business account",
          "authType": "api_key", "credentials": ["RIVERSIDE_API_KEY": apiKey],
          "selectedCapabilities": ["workspace", "recordings", "exports", "webinars", "edits"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(
          .internalError, "Relay Console did not return the Riverside connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/riverside-fm/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String)
            ?? "Riverside rejected the API key or the Business API is not enabled for this account."
        )
      }
      self.riversideAPIKeyDraft = ""
      self.riversideConnectionStatus = "Riverside Business API connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectSharedMarketplaceConnection(_ connectionId: RelayId) {
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setSharedMarketplaceAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    marketplaceAgentAssignmentStatus = nil
    runAction("toggle-shared-marketplace-agent-\(app.slug)-\(agentId)", refresh: .applications) {
      guard app.roleManifest.roleDefinitions?.contains(where: \.installable) == true,
        let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.appSlug == app.slug,
        connection.status == .connected, connection.health.state == .ready
      else {
        throw RelayError(
          .invalidInput, "Select a ready \(app.name) connection before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      let agent = try services.data.getAgent(agentId)
      if connection.resolvedExecutionAuthority == .railway {
        let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
          localWorkspaceId: workspace.id,
          localConnectionId: connection.id
        )
        let remoteAgentId = try services.cloudSync.remoteMarketplaceAgentId(
          localWorkspaceId: workspace.id,
          localAgentId: agentId
        )
        if enabled {
          guard existing == nil || existing?.connectionId == connection.id else {
            throw RelayError(
              .invalidInput, "This agent already uses another \(app.name) connection.")
          }
          if existing == nil {
            let result = try await services.cloudSync.railwayMarketplaceRequest(
              localWorkspaceId: workspace.id,
              method: "POST",
              relativePath: "install",
              body: [
                "appSlug": app.slug,
                "connectionId": remoteConnectionId,
                "selectedCapabilities": app.capabilityIds ?? app.capabilities,
                "runtimeFormat": agent.binding.runtimeType.rawValue,
                "agentIds": [remoteAgentId],
                "role": app.roleManifest.primaryRole,
                "libraryTargetFolder": "marketplace/\(app.slug)",
                "targetMode": "existing_agents",
                "acknowledgeGeneratedDraftRisk": true,
              ]
            )
            guard (result["status"] as? String) == "installed" else {
              throw RelayError(
                .unsupported,
                (result["message"] as? String)
                  ?? "Railway could not install \(app.name) for this agent."
              )
            }
          }
        } else if let existing {
          _ = try await services.cloudSync.railwayMarketplaceRequest(
            localWorkspaceId: workspace.id,
            method: "DELETE",
            relativePath: "installs/\(existing.id)"
          )
        }
        let remoteInstalls = try await services.cloudSync.railwayMarketplaceArrayRequest(
          localWorkspaceId: workspace.id,
          relativePath: "installs"
        )
        _ = try services.cloudSync.mirrorRailwayMarketplaceInstalls(
          localWorkspaceId: workspace.id,
          app: app,
          installViews: remoteInstalls
        )
      } else if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(.invalidInput, "This agent already uses another \(app.name) connection.")
        }
        if existing == nil {
          _ = try services.marketplaceInstalls.createInstall(
            context: context,
            request: MarketplaceInstallRequest(
              id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
              appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
              roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
              approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
              targetMode: .existingAgent,
              riskAcknowledged: app.riskLevel == .high || app.riskLevel == .critical,
              metadata: [
                "source": .string("applications-shared-marketplace-agent-switch"),
                "selectedConnectionId": .string(connection.id),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
      }
      self.marketplaceAgentAssignmentStatus =
        enabled
        ? "\(agent.name) connected to \(app.name)."
        : "\(agent.name) disconnected from \(app.name)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveSlabRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-slab-api-token", refresh: .applications) {
      guard app.slug == "slab", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let token = self.slabAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !token.isEmpty else {
        throw RelayError(.invalidInput, "Slab team API token is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "slab", "displayName": "Slab team API token", "authType": "api_key",
          "credentials": ["SLAB_API_TOKEN": token],
          "selectedCapabilities": ["knowledge_read", "knowledge_write"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Railway did not return the Slab connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/slab/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Slab rejected the API token.")
      }
      self.slabAPITokenDraft = ""
      self.slabConnectionStatus =
        "Slab API token verified by Railway. Content access follows Slab Bot permissions."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveRoadmunkRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-roadmunk-api-token", refresh: .applications) {
      guard app.slug == "roadmunk", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let token = self.roadmunkAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let region = self.roadmunkRegionDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      guard !token.isEmpty else {
        throw RelayError(.invalidInput, "Strategic Roadmaps API token is required.")
      }
      guard ["na", "eu", "apac"].contains(region) else {
        throw RelayError(.invalidInput, "Choose North America, Europe, or Asia Pacific.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "roadmunk", "displayName": "Strategic Roadmaps account", "authType": "api_key",
          "credentials": ["ROADMUNK_API_TOKEN": token, "ROADMUNK_REGION": region],
          "selectedCapabilities": ["roadmaps_read", "roadmaps_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(
          .internalError, "Relay did not return the Strategic Roadmaps connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/roadmunk/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Strategic Roadmaps rejected the token or region.")
      }
      self.roadmunkAPITokenDraft = ""
      self.roadmunkConnectionStatus = "Strategic Roadmaps connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveShortcutRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-shortcut-api-token", refresh: .applications) {
      guard app.slug == "shortcut", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let token = self.shortcutAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !token.isEmpty else {
        throw RelayError(.invalidInput, "Shortcut API token is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "shortcut", "displayName": "Shortcut workspace", "authType": "api_key",
          "credentials": ["SHORTCUT_API_TOKEN": token],
          "selectedCapabilities": ["workspace_read", "workspace_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Shortcut connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/shortcut/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Shortcut rejected the API token.")
      }
      self.shortcutAPITokenDraft = ""
      self.shortcutConnectionStatus = "Shortcut connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveHiveRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-hive-api-key", refresh: .applications) {
      guard app.slug == "hive", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let apiKey = self.hiveAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let userId = self.hiveUserIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty, !userId.isEmpty else {
        throw RelayError(.invalidInput, "Hive API key and user ID are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "hive", "displayName": "Hive account", "authType": "api_key",
          "credentials": ["HIVE_API_KEY": apiKey, "HIVE_USER_ID": userId],
          "selectedCapabilities": ["workspace_read", "workspace_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Hive connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/hive/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Hive rejected the API key or user ID.")
      }
      self.hiveAPIKeyDraft = ""
      self.hiveUserIDDraft = ""
      self.hiveConnectionStatus = "Hive connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func savePaymoRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-paymo-api-key", refresh: .applications) {
      guard app.slug == "paymo", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let apiKey = self.paymoAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty else { throw RelayError(.invalidInput, "Paymo API key is required.") }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "paymo", "displayName": "Paymo account", "authType": "api_key",
          "credentials": ["PAYMO_API_KEY": apiKey],
          "selectedCapabilities": ["work_read", "work_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Paymo connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/paymo/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Paymo rejected the API key.")
      }
      self.paymoAPIKeyDraft = ""
      self.paymoConnectionStatus = "Paymo connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveKrakenRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-kraken-api-key", refresh: .applications) {
      guard app.slug == "kraken", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.krakenAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let apiSecret = self.krakenAPISecretDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty, !apiSecret.isEmpty else {
        throw RelayError(.invalidInput, "Kraken API key and private key are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "kraken", "displayName": "Kraken Spot account", "authType": "api_key",
          "credentials": ["KRAKEN_API_KEY": apiKey, "KRAKEN_API_SECRET": apiSecret],
          "selectedCapabilities": ["market_data", "account_read", "spot_trading"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Kraken connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/kraken/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Kraken rejected the API key pair.")
      }
      self.krakenAPIKeyDraft = ""
      self.krakenAPISecretDraft = ""
      self.krakenConnectionStatus = "Kraken connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveBinanceRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-binance-api-key", refresh: .applications) {
      guard app.slug == "binance", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.binanceAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let apiSecret = self.binanceAPISecretDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty, !apiSecret.isEmpty else {
        throw RelayError(.invalidInput, "Binance API key and secret key are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "binance", "displayName": "Binance Spot account", "authType": "api_key",
          "credentials": ["BINANCE_API_KEY": apiKey, "BINANCE_API_SECRET": apiSecret],
          "selectedCapabilities": ["market_data", "account_read", "spot_trading"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Binance connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/binance/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Binance rejected the API key pair.")
      }
      self.binanceAPIKeyDraft = ""
      self.binanceAPISecretDraft = ""
      self.binanceConnectionStatus = "Binance connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveGeminiRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-gemini-api-key", refresh: .applications) {
      guard app.slug == "gemini", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.geminiAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let apiSecret = self.geminiAPISecretDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty, !apiSecret.isEmpty else {
        throw RelayError(.invalidInput, "Gemini API key and secret are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "gemini", "displayName": "Gemini Exchange account", "authType": "api_key",
          "credentials": ["GEMINI_API_KEY": apiKey, "GEMINI_API_SECRET": apiSecret],
          "selectedCapabilities": ["market_data", "account_read", "spot_trading"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Gemini connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/gemini/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Gemini rejected the API key pair.")
      }
      self.geminiAPIKeyDraft = ""
      self.geminiAPISecretDraft = ""
      self.geminiConnectionStatus = "Gemini connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveNozbeRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-nozbe-api-token", refresh: .applications) {
      guard app.slug == "nozbe", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let apiToken = self.nozbeAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiToken.isEmpty else {
        throw RelayError(.invalidInput, "Nozbe API token is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "nozbe", "displayName": "Nozbe account", "authType": "api_key",
          "credentials": ["NOZBE_API_TOKEN": apiToken],
          "selectedCapabilities": ["work_read", "work_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Nozbe connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/nozbe/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Nozbe rejected the API token.")
      }
      self.nozbeAPITokenDraft = ""
      self.nozbeConnectionStatus = "Nozbe connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveProofHubRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-proofhub-api-key", refresh: .applications) {
      guard app.slug == "proofhub", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let account = self.proofHubAccountDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      let apiKey = self.proofHubAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !account.isEmpty, !apiKey.isEmpty else {
        throw RelayError(.invalidInput, "ProofHub account name and API key are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "proofhub", "displayName": "\(account).proofhub.com", "authType": "api_key",
          "credentials": ["PROOFHUB_ACCOUNT": account, "PROOFHUB_API_KEY": apiKey],
          "selectedCapabilities": ["work_read", "work_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the ProofHub connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/proofhub/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "ProofHub rejected the account name or API key.")
      }
      self.proofHubAPIKeyDraft = ""
      self.proofHubConnectionStatus = "ProofHub connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectQuipOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-quip-oauth", refresh: .applications) {
      guard app.slug == "quip", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let clientId = self.quipClientIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientSecret = self.quipClientSecretDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !clientId.isEmpty, !clientSecret.isEmpty else {
        throw RelayError(.invalidInput, "Quip client ID and client secret are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connectors/quip/oauth/start",
        body: [
          "displayName": "Quip company account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=quip",
          "selectedCapabilities": ["knowledge_read", "knowledge_write", "sharing_manage"],
          "clientId": clientId, "clientSecret": clientSecret,
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "platform.quip.com",
        authorizationURL.path == "/1/oauth/login"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Quip authorization URL.")
      }
      self.quipClientSecretDraft = ""
      NSWorkspace.shared.open(authorizationURL)
      self.quipConnectionStatus =
        "Quip OAuth opened. Approve the customer API key for this user; Railway will bind the returned user and company."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectXeroOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-xero-oauth", refresh: .applications) {
      guard app.slug == "xero", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let clientId = self.xeroClientIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientSecret = self.xeroClientSecretDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !clientId.isEmpty, !clientSecret.isEmpty else {
        throw RelayError(.invalidInput, "Xero client ID and client secret are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/xero/oauth/start",
        body: [
          "displayName": "Xero organisation",
          "returnTo": "https://relayconsole.work/app?marketplace_app=xero",
          "selectedCapabilities": ["organisation_read", "invoice_read"], "clientId": clientId,
          "clientSecret": clientSecret,
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "login.xero.com",
        authorizationURL.path == "/identity/connect/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Xero authorization URL.")
      }
      self.xeroClientSecretDraft = ""
      NSWorkspace.shared.open(authorizationURL)
      self.xeroConnectionStatus = "Xero opened. Choose one organisation to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectQuickBooksOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-quickbooks-oauth", refresh: .applications) {
      guard app.slug == "quickbooks", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/quickbooks/oauth/start",
        body: [
          "displayName": "QuickBooks company",
          "returnTo": "https://relayconsole.work/app?marketplace_app=quickbooks",
          "selectedCapabilities": ["company_read", "invoice_read"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "appcenter.intuit.com",
        authorizationURL.path == "/connect/oauth2"
      else {
        throw RelayError(.internalError, "Relay returned an invalid QuickBooks authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.quickBooksConnectionStatus = "QuickBooks opened. Choose the company you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectFreshBooksOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-freshbooks-oauth", refresh: .applications) {
      guard app.slug == "freshbooks", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/freshbooks/oauth/start",
        body: [
          "displayName": "FreshBooks business",
          "returnTo": "https://relayconsole.work/app?marketplace_app=freshbooks",
          "selectedCapabilities": ["business_membership_read", "invoice_read"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "auth.freshbooks.com",
        authorizationURL.path == "/oauth/authorize/"
      else {
        throw RelayError(.internalError, "Relay returned an invalid FreshBooks authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.freshBooksConnectionStatus =
        "FreshBooks opened. Approve access to connect your accounting business."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectWaveOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-wave-oauth", refresh: .applications) {
      guard app.slug == "wave", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/wave/oauth/start",
        body: [
          "displayName": "Wave business",
          "returnTo": "https://relayconsole.work/app?marketplace_app=wave",
          "selectedCapabilities": ["business_read", "invoice_read"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "api.waveapps.com",
        authorizationURL.path == "/oauth2/authorize/"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Wave authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.waveConnectionStatus = "Wave opened. Approve one eligible business to finish connecting."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectFreeAgentOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-freeagent-oauth", refresh: .applications) {
      guard app.slug == "freeagent", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/freeagent/oauth/start",
        body: [
          "displayName": "FreeAgent company",
          "returnTo": "https://relayconsole.work/app?marketplace_app=freeagent",
          "selectedCapabilities": ["company_read", "invoice_read"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "api.freeagent.com",
        authorizationURL.path == "/v2/approve_app"
      else {
        throw RelayError(.internalError, "Relay returned an invalid FreeAgent authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.freeAgentConnectionStatus =
        "FreeAgent opened. Sign in and approve the company you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectSalesforceOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-salesforce-oauth", refresh: .applications) {
      guard app.slug == "salesforce", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/salesforce/oauth/start",
        body: [
          "displayName": "Salesforce organization",
          "returnTo": "https://relayconsole.work/app?marketplace_app=salesforce",
          "selectedCapabilities": ["account_read", "opportunity_read"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        ["login.salesforce.com", "test.salesforce.com"].contains(
          authorizationURL.host?.lowercased() ?? ""),
        authorizationURL.path == "/services/oauth2/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Salesforce authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.salesforceConnectionStatus =
        "Salesforce opened. Sign in and approve the organization you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectHubSpotOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-hubspot-oauth", refresh: .applications) {
      guard app.slug == "hubspot", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/hubspot/oauth/start",
        body: [
          "displayName": "HubSpot account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=hubspot",
          "selectedCapabilities": ["company_read", "deal_read"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "app.hubspot.com",
        authorizationURL.path == "/oauth/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid HubSpot authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.hubSpotConnectionStatus =
        "HubSpot opened. Choose the account you want to connect and approve access."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectPipedriveOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-pipedrive-oauth", refresh: .applications) {
      guard app.slug == "pipedrive", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/pipedrive/oauth/start",
        body: [
          "displayName": "Pipedrive company",
          "returnTo": "https://relayconsole.work/app?marketplace_app=pipedrive",
          "selectedCapabilities": ["organization_read", "deal_read"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "oauth.pipedrive.com",
        authorizationURL.path == "/oauth/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Pipedrive authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.pipedriveConnectionStatus =
        "Pipedrive opened. Sign in and choose the company you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectCopperOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-copper-oauth", refresh: .applications) {
      guard app.slug == "copper", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/copper/oauth/start",
        body: [
          "displayName": "Copper account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=copper",
          "selectedCapabilities": ["account_read", "opportunity_read"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "app.copper.com",
        authorizationURL.path == "/oauth/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Copper authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.copperConnectionStatus =
        "Copper opened. Sign in and approve the account you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectCloseOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-close-oauth", refresh: .applications) {
      guard app.slug == "close", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/close/oauth/start",
        body: [
          "displayName": "Close organization",
          "returnTo": "https://relayconsole.work/app?marketplace_app=close",
          "selectedCapabilities": ["organization_read", "opportunity_read"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "app.close.com",
        authorizationURL.path == "/oauth2/authorize/"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Close authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.closeConnectionStatus =
        "Close opened. Sign in and approve the organization you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectZendeskOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-zendesk-oauth", refresh: .applications) {
      guard app.slug == "zendesk", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let subdomain = self.zendeskSubdomainDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      guard !subdomain.isEmpty,
        subdomain.range(of: "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", options: .regularExpression)
          != nil
      else {
        throw RelayError(
          .invalidInput, "Enter the account name from your Zendesk address, for example acme.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/zendesk/oauth/start",
        body: [
          "displayName": "Zendesk Support",
          "returnTo": "https://relayconsole.work/app?marketplace_app=zendesk",
          "selectedCapabilities": ["ticket_read"], "providerDomain": subdomain,
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "\(subdomain).zendesk.com",
        authorizationURL.path == "/oauth/authorizations/new"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Zendesk authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.zendeskConnectionStatus =
        "Zendesk opened. Sign in and approve access to this Support account."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectIntercomOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-intercom-oauth", refresh: .applications) {
      guard app.slug == "intercom", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/intercom/oauth/start",
        body: [
          "displayName": "Intercom workspace",
          "returnTo": "https://relayconsole.work/app?marketplace_app=intercom",
          "selectedCapabilities": ["conversation_read"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "app.intercom.com",
        authorizationURL.path == "/oauth"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Intercom authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.intercomConnectionStatus =
        "Intercom opened. Sign in and choose the workspace you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectHelpScoutOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-help-scout-oauth", refresh: .applications) {
      guard app.slug == "help-scout", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/help-scout/oauth/start",
        body: [
          "displayName": "Help Scout account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=help-scout",
          "selectedCapabilities": ["conversation_read", "full_api"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "secure.helpscout.net",
        authorizationURL.path == "/authentication/authorizeClientApplication"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Help Scout authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.helpScoutConnectionStatus =
        "Help Scout opened. Sign in and approve the account you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectFrontOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-front-oauth", refresh: .applications) {
      guard app.slug == "front", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/front/oauth/start",
        body: [
          "displayName": "Front company",
          "returnTo": "https://relayconsole.work/app?marketplace_app=front",
          "selectedCapabilities": ["conversation_read", "full_api"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "app.frontapp.com",
        authorizationURL.path == "/oauth/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Front authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.frontConnectionStatus =
        "Front opened. Sign in and approve the company you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectTeamworkOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-teamwork-oauth", refresh: .applications) {
      guard app.slug == "teamwork", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/teamwork/oauth/start",
        body: [
          "displayName": "Teamwork installation",
          "returnTo": "https://relayconsole.work/app?marketplace_app=teamwork",
          "selectedCapabilities": ["project_read", "task_read", "full_api"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "www.teamwork.com",
        authorizationURL.path == "/launchpad/login/"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Teamwork authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.teamworkConnectionStatus =
        "Teamwork opened. Sign in and choose the installation you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectBasecampOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-basecamp-oauth", refresh: .applications) {
      guard app.slug == "basecamp", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/basecamp/oauth/start",
        body: [
          "displayName": "Basecamp account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=basecamp",
          "selectedCapabilities": ["project_read", "todo_read", "full_api"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "launchpad.37signals.com",
        authorizationURL.path == "/authorization/new"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Basecamp authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.basecampConnectionStatus =
        "Basecamp opened. Sign in to connect an accessible Basecamp account."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectWrikeOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-wrike-oauth", refresh: .applications) {
      guard app.slug == "wrike", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/wrike/oauth/start",
        body: [
          "displayName": "Wrike account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=wrike",
          "selectedCapabilities": ["project_read", "task_read", "full_api"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "login.wrike.com",
        authorizationURL.path == "/oauth2/authorize/v4"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Wrike authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.wrikeConnectionStatus =
        "Wrike opened. Sign in and choose the account you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectSmartsheetOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-smartsheet-oauth", refresh: .applications) {
      guard app.slug == "smartsheet", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/smartsheet/oauth/start",
        body: [
          "displayName": "Smartsheet account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=smartsheet",
          "selectedCapabilities": ["sheet_read", "full_api"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "app.smartsheet.com",
        authorizationURL.path == "/b/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Smartsheet authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.smartsheetConnectionStatus =
        "Smartsheet opened. Sign in and choose the account you want to connect."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectTodoistOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-todoist-oauth", refresh: .applications) {
      guard app.slug == "todoist", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/todoist/oauth/start",
        body: [
          "displayName": "Todoist user",
          "returnTo": "https://relayconsole.work/app?marketplace_app=todoist",
          "selectedCapabilities": ["project_task_read", "full_api"],
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "app.todoist.com",
        authorizationURL.path == "/oauth/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Todoist authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.todoistConnectionStatus = "Todoist opened. Sign in to connect your account."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveGrooveConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-groove-api-token", refresh: .applications) {
      guard app.slug == "groove", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiToken = self.grooveAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiToken.isEmpty else {
        throw RelayError(.invalidInput, "Enter your Groove API token.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "groove",
          "displayName": "Groove account",
          "authType": "api_key",
          "credentials": ["GROOVE_API_TOKEN": apiToken],
          "selectedCapabilities": ["account_read", "channel_read", "full_api"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Groove connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/groove/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Groove rejected the API token.")
      }
      self.grooveAPITokenDraft = ""
      self.grooveConnectionStatus = "Groove connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectBynderOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-bynder-oauth", refresh: .applications) {
      guard app.slug == "bynder", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let portal = self.bynderPortalDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientId = self.bynderClientIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientSecret = self.bynderClientSecretDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      guard !portal.isEmpty, !clientId.isEmpty, !clientSecret.isEmpty else {
        throw RelayError(.invalidInput, "Bynder portal, client ID, and client secret are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/bynder/oauth/start",
        body: [
          "displayName": "Bynder portal",
          "returnTo": "https://relayconsole.work/app?marketplace_app=bynder",
          "selectedCapabilities": ["dam_read", "dam_manage"], "providerDomain": portal,
          "clientId": clientId, "clientSecret": clientSecret,
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.path == "/v6/authentication/oauth2/auth"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Bynder authorization URL.")
      }
      self.bynderClientSecretDraft = ""
      NSWorkspace.shared.open(authorizationURL)
      self.bynderConnectionStatus =
        "Bynder authorization opened for this portal. Railway will verify the connected user and retain refresh access after approval."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
}
