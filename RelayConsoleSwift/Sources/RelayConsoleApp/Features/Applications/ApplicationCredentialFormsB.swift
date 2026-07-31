import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsStrapiCloudCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField(
        "Project address (https://your-project.strapiapp.com)",
        text: $model.strapiCloudInstanceURLDraft
      )
      .textFieldStyle(.roundedBorder)
      TextField(
        "Allowed content types (articles,authors)", text: $model.strapiCloudAllowedAPIIDsDraft
      )
      .textFieldStyle(.roundedBorder)
      SecureField("Content API token", text: $model.strapiCloudAPITokenDraft)
        .textFieldStyle(.roundedBorder)
      Text(
        "Create a Custom API token with only the selected content types and actions you want agents to use. Enable Draft & Publish for content that should be reviewed before publication."
      )
      .font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Strapi Cloud") { model.saveStrapiCloudConnection(for: app) }
        .buttonStyle(PrimaryLightButtonStyle())
      if let status = model.strapiCloudConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Strapi Cloud", destination: URL(string: "https://cloud.strapi.io/")!)
    }
  }
}

struct ApplicationsGhostCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Publication address (https://news.example.com)", text: $model.ghostAdminURLDraft)
        .textFieldStyle(.roundedBorder)
      SecureField("Admin API key", text: $model.ghostAdminAPIKeyDraft)
        .textFieldStyle(.roundedBorder)
      Text(
        "Create a Custom Integration in Ghost Admin and paste its Admin API key here. Agents never see the key."
      )
      .font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Ghost") { model.saveGhostRailwayConnection(for: app) }
        .buttonStyle(PrimaryLightButtonStyle())
      if let status = model.ghostConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "How to create a Ghost Custom Integration",
        destination: URL(string: "https://ghost.org/integrations/custom-integrations/")!)
    }
  }
}

struct ApplicationsCodaCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Coda API token", text: $model.codaAPITokenDraft).textFieldStyle(.roundedBorder)
      Text(
        "Create a personal token in Coda account settings, choose the access you want, then paste it here. Relay encrypts it and agents never see it."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Coda") { model.saveCodaRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.codaConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Coda account settings", destination: URL(string: "https://coda.io/account")!)
    }
  }
}

struct ApplicationsVidyardCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Vidyard API token", text: $model.vidyardAPITokenDraft).textFieldStyle(
        .roundedBorder)
      Text("Find this in Vidyard under Admin → API Tokens.").font(.caption).foregroundStyle(
        RCTheme.muted)
      Button("Connect Vidyard") { model.saveVidyardRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.vidyardConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Vidyard", destination: URL(string: "https://secure.vidyard.com/")!)
    }
  }
}

struct ApplicationsPadletCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Padlet API key", text: $model.padletAPITokenDraft).textFieldStyle(.roundedBorder)
      Text(
        "Find this in Padlet under Settings → Personal account → Developer. A paid individual account is required."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Padlet") { model.savePadletRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.padletConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Padlet developer settings",
        destination: URL(string: "https://padlet.com/dashboard/settings/developers")!)
    }
  }
}

struct ApplicationsDescriptCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Descript API token", text: $model.descriptAPITokenDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "Create a dedicated token for the Drive you want to use in Descript Settings → API tokens. Imports and AI edits use that Drive's plan allowance."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Descript") { model.saveDescriptRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.descriptConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Descript API tokens",
        destination: URL(string: "https://web.descript.com/settings/api-tokens")!)
    }
  }
}

struct ApplicationsRevCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Client API key", text: $model.revClientAPIKeyDraft).textFieldStyle(
        .roundedBorder)
      SecureField("User API key", text: $model.revUserAPIKeyDraft).textFieldStyle(.roundedBorder)
      Text(
        "Use keys from your own API-enabled Rev account. Production orders are billed to that account; sandbox orders are available for testing."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Rev") { model.saveRevRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.revConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Rev API", destination: URL(string: "https://www.rev.com/api")!)
    }
  }
}

struct ApplicationsBuzzsproutCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API token", text: $model.buzzsproutAPITokenDraft).textFieldStyle(.roundedBorder)
      TextField("Podcast ID", text: $model.buzzsproutPodcastIDDraft).textFieldStyle(.roundedBorder)
      Text(
        "Use the token and exact numeric podcast ID from your own Buzzsprout account. Media imports consume that account's upload allowance."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Buzzsprout") { model.saveBuzzsproutRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.buzzsproutConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Buzzsprout API documentation",
        destination: URL(string: "https://www.buzzsprout.com/api")!)
    }
  }
}

struct ApplicationsCaptivateCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API key", text: $model.captivateAPIKeyDraft).textFieldStyle(.roundedBorder)
      TextField("User ID", text: $model.captivateUserIDDraft).textFieldStyle(.roundedBorder)
      TextField("Show ID", text: $model.captivateShowIDDraft).textFieldStyle(.roundedBorder)
      Text(
        "Copy the API key and user ID from your Captivate account and bind Relay to one exact show. V1 uses media already in that show."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Captivate") { model.saveCaptivateRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.captivateConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Captivate API documentation", destination: URL(string: "https://docs.captivate.fm/")!)
    }
  }
}

struct ApplicationsTransistorCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API key", text: $model.transistorAPIKeyDraft).textFieldStyle(.roundedBorder)
      TextField("Show ID or slug", text: $model.transistorShowIDDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "Use a key from your own Transistor account and bind Relay to one exact show. V1 is read-only and excludes private subscribers and feed URLs, publishing, uploads, and webhooks."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Transistor") { model.saveTransistorRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.transistorConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Transistor API documentation",
        destination: URL(string: "https://developers.transistor.fm/")!)
    }
  }
}

struct ApplicationsRiversideCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Business API key", text: $model.riversideAPIKeyDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "Riverside currently enables v3 API access for select Business accounts through the customer's success manager. Relay encrypts the key and sends it only to Riverside's fixed API origin."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Riverside") { model.saveRiversideRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.riversideConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Riverside Business API documentation",
        destination: URL(string: "https://docs.riverside.fm/quickstart")!)
    }
  }
}

struct ApplicationsTlDvCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("tl;dv API key", text: $model.tlDvAPIKeyDraft).textFieldStyle(.roundedBorder)
      Text(
        "Create a key in tl;dv Personal settings → API keys. API access depends on your tl;dv plan, and meeting exports depend on the organizer's plan."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect tl;dv") { model.saveTlDvRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.tlDvConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open tl;dv API keys",
        destination: URL(string: "https://tldv.io/app/settings/personal-settings/api-keys")!)
    }
  }
}

struct ApplicationsSlabCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Slab team API token", text: $model.slabAPITokenDraft).textFieldStyle(
        .roundedBorder)
      Text("Find this in Slab under Team settings → Developer.").font(.caption).foregroundStyle(
        RCTheme.muted)
      Button("Connect Slab") { model.saveSlabRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.slabConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Slab", destination: URL(string: "https://app.slab.com/")!)
    }
  }
}

struct ApplicationsRoadmunkCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API token", text: $model.roadmunkAPITokenDraft).textFieldStyle(.roundedBorder)
      Picker("Data region", selection: $model.roadmunkRegionDraft) {
        Text("North America").tag("na")
        Text("Europe").tag("eu")
        Text("Asia Pacific").tag("apac")
      }.pickerStyle(.segmented)
      Text(
        "An account administrator creates a token in Account settings → Integrations → API Tokens. API access depends on your Strategic Roadmaps plan."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Strategic Roadmaps") { model.saveRoadmunkRailwayConnection(for: app) }
        .buttonStyle(PrimaryLightButtonStyle())
      if let status = model.roadmunkConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Strategic Roadmaps", destination: URL(string: "https://app.roadmunk.com/")!)
    }
  }
}

struct ApplicationsShortcutCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API token", text: $model.shortcutAPITokenDraft).textFieldStyle(.roundedBorder)
      Text("Create a dedicated token in Shortcut under Settings → Your Account → API Tokens.").font(
        .caption
      ).foregroundStyle(RCTheme.muted)
      Button("Connect Shortcut") { model.saveShortcutRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.shortcutConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Shortcut API tokens",
        destination: URL(string: "https://app.shortcut.com/settings/account/api-tokens")!)
    }
  }
}

struct ApplicationsHiveCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API key", text: $model.hiveAPIKeyDraft).textFieldStyle(.roundedBorder)
      TextField("User ID", text: $model.hiveUserIDDraft).textFieldStyle(.roundedBorder)
      Text("In Hive, open My profile → API info to generate a key and copy your user ID.").font(
        .caption
      ).foregroundStyle(RCTheme.muted)
      Button("Connect Hive") { model.saveHiveRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.hiveConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Hive", destination: URL(string: "https://app.hive.com/")!)
    }
  }
}

struct ApplicationsPaymoCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API key", text: $model.paymoAPIKeyDraft).textFieldStyle(.roundedBorder)
      Text(
        "Generate a dedicated key in Paymo under My Settings → API Keys. API access requires an eligible Paymo plan."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Paymo") { model.savePaymoRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.paymoConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Paymo API keys",
        destination: URL(string: "https://app.paymoapp.com/#Paymo.module.myaccount/")!)
    }
  }
}

struct ApplicationsKrakenCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API key", text: $model.krakenAPIKeyDraft).textFieldStyle(.roundedBorder)
      SecureField("Private key", text: $model.krakenAPISecretDraft).textFieldStyle(.roundedBorder)
      Text(
        "Create a dedicated Spot API key with only the permissions required for selected capabilities. Do not enable funding, withdrawal, transfer, Earn, export, address-management, WebSocket, or Futures authority."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Kraken") { model.saveKrakenRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.krakenConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Kraken API settings",
        destination: URL(string: "https://pro.kraken.com/app/settings/api")!)
    }
  }
}

struct ApplicationsBinanceCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API key", text: $model.binanceAPIKeyDraft).textFieldStyle(.roundedBorder)
      SecureField("Secret key", text: $model.binanceAPISecretDraft).textFieldStyle(.roundedBorder)
      Text(
        "Create a dedicated Spot HMAC key with USER_DATA and only the selected Spot trading permission. Keep withdrawals and every broader product permission disabled; availability depends on jurisdiction and account status."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Binance") { model.saveBinanceRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.binanceConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Binance API management",
        destination: URL(string: "https://www.binance.com/en/my/settings/api-management")!)
    }
  }
}

struct ApplicationsGeminiCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API key", text: $model.geminiAPIKeyDraft).textFieldStyle(.roundedBorder)
      SecureField("API secret", text: $model.geminiAPISecretDraft).textFieldStyle(.roundedBorder)
      Text(
        "Create a dedicated account-scoped key with Auditor for reads or Trader only when Spot trading is selected. Do not assign Fund Manager, Administrator, Master-key, withdrawal, transfer, custody, or broader authority."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Gemini") { model.saveGeminiRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.geminiConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Gemini API settings",
        destination: URL(string: "https://exchange.gemini.com/settings/api")!)
    }
  }
}

struct ApplicationsNozbeCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("API token", text: $model.nozbeAPITokenDraft).textFieldStyle(.roundedBorder)
      Text(
        "Create a dedicated token in Nozbe under Settings → API tokens. Leave it limited to one space unless your agents genuinely need every space."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Nozbe") { model.saveNozbeRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.nozbeConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Nozbe", destination: URL(string: "https://nozbe.app/")!)
    }
  }
}

struct ApplicationsProofHubCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Account name (for example, acme)", text: $model.proofHubAccountDraft)
        .textFieldStyle(.roundedBorder)
      SecureField("API key", text: $model.proofHubAPIKeyDraft).textFieldStyle(.roundedBorder)
      Text(
        "Use the first part of your ProofHub URL, then copy the key from profile → API access. API access requires an eligible plan."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect ProofHub") { model.saveProofHubRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.proofHubConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "How to find the API key",
        destination: URL(
          string: "https://help.proofhub.com/swift/others/how-to-access-your-api-key")!)
    }
  }
}

struct ApplicationsQuipCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Client ID", text: $model.quipClientIDDraft).textFieldStyle(.roundedBorder)
      SecureField("Client secret", text: $model.quipClientSecretDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "A company admin creates an integration under Quip Admin Console → Settings → Integrations. Enter its client ID and secret here."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Quip") { model.connectQuipOAuth(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.quipConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Quip developer setup", destination: URL(string: "https://quip.com/dev/token")!)
    }
  }
}

struct ApplicationsBynderCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Portal hostname", text: $model.bynderPortalDraft).textFieldStyle(.roundedBorder)
      TextField("OAuth client ID", text: $model.bynderClientIDDraft).textFieldStyle(.roundedBorder)
      SecureField("OAuth client secret", text: $model.bynderClientSecretDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "A Bynder administrator creates an OAuth app for this portal and registers Relay Console's callback. The client secret is encrypted by Railway and cleared from this form when authorization opens."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Bynder") { model.connectBynderOAuth(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.bynderConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Bynder OAuth app setup",
        destination: URL(
          string:
            "https://support.bynder.com/hc/en-us/articles/360013875180-How-To-Create-And-Manage-OAuth-2-0-Apps-to-Provide-Access-to-Bynder-API"
        )!)
    }
  }
}

struct ApplicationsCantoCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Account hostname", text: $model.cantoAccountDraft).textFieldStyle(.roundedBorder)
      TextField("App ID", text: $model.cantoClientIDDraft).textFieldStyle(.roundedBorder)
      SecureField("App Secret", text: $model.cantoClientSecretDraft).textFieldStyle(.roundedBorder)
      Text(
        "Create an API key in Canto, add Relay Console's callback, then enter the three values above. Your secret is encrypted and cleared from this form when authorization opens."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Canto") { model.connectCantoOAuth(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.cantoConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Canto API key setup",
        destination: URL(
          string: "https://support.canto.com/hc/en-us/articles/23002535539601-Generating-API-Keys")!
      )
    }
  }
}

struct ApplicationsFrontifyCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Frontify hostname", text: $model.frontifyAccountDraft).textFieldStyle(
        .roundedBorder)
      TextField("Client ID", text: $model.frontifyClientIDDraft).textFieldStyle(.roundedBorder)
      SecureField("Client secret", text: $model.frontifyClientSecretDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "Create a confidential OAuth application in Frontify and add Relay Console's callback. Enter the hostname and client credentials to connect."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Frontify") { model.connectFrontifyOAuth(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.frontifyConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Frontify OAuth setup guide",
        destination: URL(
          string:
            "https://help.frontify.com/en/articles/13600605-adobe-workfront-installation-guide")!)
    }
  }
}

struct ApplicationsAssetBankCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Asset Bank site URL", text: $model.assetBankSiteDraft).textFieldStyle(
        .roundedBorder)
      TextField("Client ID", text: $model.assetBankClientIDDraft).textFieldStyle(.roundedBorder)
      SecureField("Client secret", text: $model.assetBankClientSecretDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "Create OAuth credentials in Asset Bank and add Relay Console's callback, then enter the complete site URL and client credentials."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Asset Bank") { model.connectAssetBankOAuth(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.assetBankConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Asset Bank OAuth setup guide",
        destination: URL(
          string:
            "https://support.assetbank.co.uk/hc/en-gb/articles/360015325197-Asset-Bank-API-OAuth2")!
      )
    }
  }
}

struct ApplicationsBrandfolderCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Brandfolder API key", text: $model.brandfolderAPIKeyDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "Copy your key from Brandfolder Profile → Integrations. This connection can access only the Brandfolder content and actions available to that user."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Brandfolder") { model.saveBrandfolderRailwayConnection(for: app) }
        .buttonStyle(PrimaryLightButtonStyle())
      if let status = model.brandfolderConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Brandfolder API keys",
        destination: URL(string: "https://brandfolder.com/profile#integrations")!)
    }
  }
}

struct ApplicationsWidenCollectiveCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Collective subdomain", text: $model.widenCollectiveSubdomainDraft).textFieldStyle(
        .roundedBorder)
      SecureField("Access token", text: $model.widenCollectiveAccessTokenDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "Enter the first part of your widencollective.com address and a dedicated token from Admin → Global Settings → API Setup."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Acquia DAM") { model.saveWidenCollectiveRailwayConnection(for: app) }
        .buttonStyle(PrimaryLightButtonStyle())
      if let status = model.widenCollectiveConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Acquia DAM API guide",
        destination: URL(string: "https://docs.acquia.com/acquia-dam/api-faqs")!)
    }
  }
}

struct ApplicationsKontainerCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Kontainer subdomain", text: $model.kontainerTenantDraft).textFieldStyle(
        .roundedBorder)
      SecureField("API token", text: $model.kontainerAccessTokenDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "Enter the first part of your kontainer.com address and an API token created in Settings → Configuration → API."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Kontainer") { model.saveKontainerRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.kontainerConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Kontainer API guide",
        destination: URL(
          string: "https://helpdesk.kontainer.com/article/kontainer-api-integration/")!)
    }
  }
}

struct ApplicationsJiraAlignCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Jira Align site URL", text: $model.jiraAlignSiteURLDraft).textFieldStyle(
        .roundedBorder)
      TextField("Atlassian account email", text: $model.jiraAlignEmailDraft).textFieldStyle(
        .roundedBorder)
      SecureField("Scoped Atlassian API token", text: $model.jiraAlignAPITokenDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "Use the HTTPS origin for your Jira Align tenant and an expiring Atlassian API token with read scope; add write scope only when needed."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Jira Align") { model.saveJiraAlignRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.jiraAlignConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Jira Align API 2.0 guide",
        destination: URL(
          string:
            "https://help.jiraalign.com/hc/en-us/articles/360045371954-Getting-started-with-the-REST-API-2-0"
        )!)
    }
  }
}

struct ApplicationsDaminionCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Daminion subdomain", text: $model.daminionTenantDraft).textFieldStyle(
        .roundedBorder)
      TextField("Username or email", text: $model.daminionUsernameDraft).textFieldStyle(
        .roundedBorder)
      SecureField("Password", text: $model.daminionPasswordDraft).textFieldStyle(.roundedBorder)
      Text(
        "Use a dedicated account on your hosted Daminion tenant, such as example from example.daminion.net."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Daminion") { model.saveDaminionRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.daminionConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Daminion API guide", destination: URL(string: "https://daminion.net/daminion-api/")!)
    }
  }
}

struct ApplicationsMsProjectCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Microsoft environment URL", text: $model.msProjectEnvironmentDraft).textFieldStyle(
        .roundedBorder)
      Text("Choose the environment that contains your Planner premium schedules.").font(.caption)
        .foregroundStyle(RCTheme.muted)
      Button("Connect Microsoft Project") { model.connectMsProjectOAuth(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.msProjectConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Microsoft scheduling API guide",
        destination: URL(
          string:
            "https://learn.microsoft.com/en-us/dynamics365/project-operations/project-management/scheduling-apis-powerautomate-v3"
        )!)
    }
  }
}

struct ApplicationsXCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection?
  let latestFlow: ProviderAuthorizationFlow?

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top, spacing: 12) {
        Image(systemName: "person.badge.key")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(RCTheme.accentBlue)
          .frame(width: 28, height: 28)
          .background(RCTheme.accentBlue.opacity(0.10))
          .clipShape(RoundedRectangle(cornerRadius: 6))
        VStack(alignment: .leading, spacing: 4) {
          Text("Relay-owned X OAuth")
            .font(.system(size: 14, weight: .bold))
          Text(
            "Connect through the authenticated Railway OAuth 2.0 PKCE broker. Client credentials, code exchange, refresh, revocation, billing, and account binding remain outside the desktop."
          )
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
          .fixedSize(horizontal: false, vertical: true)
        }
        Spacer()
        ApplicationsExaInfoPill(text: "tweet.read · users.read · tweet.write · offline.access")
      }

      VStack(alignment: .leading, spacing: 6) {
        Text("Callback URL")
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        Text(
          "https://relay.clawchat.app/api/v1/oauth/x/callback"
        )
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.text)
        .fixedSize(horizontal: false, vertical: true)
      }

      VStack(alignment: .leading, spacing: 8) {
        Text("X app permissions")
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 112), spacing: 8)], alignment: .leading, spacing: 8
        ) {
          ForEach(marketplaceRequiredScopes(for: app), id: \.self) { scope in
            ApplicationsScopeChip(scope: scope)
          }
        }
      }

      connectButton

      if let status = model.xConnectionStatus?.nilIfEmpty {
        ApplicationsConnectionHint(
          icon: "info.circle.fill", text: status, tone: RCTheme.accentAmber)
      } else if let connection {
        ApplicationsConnectionHint(
          icon: "lock.fill",
          text:
            "\(connection.secretReferenceIds.count) separate OAuth secret references saved behind the Railway callback boundary.",
          tone: RCTheme.muted
        )
      }
    }
    .padding(.top, 2)
  }

  private var connectButton: some View {
    Button {
      model.startXOAuthConnect(for: app)
    } label: {
      if model.busy == "connect-x-oauth" {
        HStack(spacing: 7) {
          ProgressView()
            .controlSize(.small)
            .scaleEffect(0.75)
          Text("Opening X...")
        }
      } else {
        Text(connection == nil ? "Connect X" : "Reconnect X")
      }
    }
    .buttonStyle(SecondaryLightButtonStyle())
    .frame(minWidth: 170)
    .disabled(
      model.busy == "connect-x-oauth" || model.providerConnectionSnapshot?.readOnly == true
        || app.availability != .available
    )
    .help("Connect X through the Railway OAuth broker")
    .accessibilityLabel("Connect X with OAuth")
  }
}

struct ApplicationsLinkedInCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection?
  let latestFlow: ProviderAuthorizationFlow?

  private var canSave: Bool {
    model.linkedinAccessTokenDraft.nilIfEmpty != nil
      && model.linkedinClientIdDraft.nilIfEmpty != nil
      && model.linkedinClientSecretDraft.nilIfEmpty != nil
      && model.busy != "save-linkedin-manual-token"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top, spacing: 12) {
        Image(systemName: "person.badge.key")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(RCTheme.accentBlue)
          .frame(width: 28, height: 28)
          .background(RCTheme.accentBlue.opacity(0.10))
          .clipShape(RoundedRectangle(cornerRadius: 6))
        VStack(alignment: .leading, spacing: 4) {
          Text("Manual LinkedIn access token")
            .font(.system(size: 14, weight: .bold))
          Text(
            "Paste a member access token and app credentials generated outside Relay Console from the user's own LinkedIn app. Relay uses them to verify token health and posting scope."
          )
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
          .fixedSize(horizontal: false, vertical: true)
        }
        Spacer()
        if let consoleURL = URL(string: "https://www.linkedin.com/developers/apps") {
          Link(destination: consoleURL) {
            Label("Open LinkedIn Developer", systemImage: "globe")
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .help("Open LinkedIn Developer apps")
          .accessibilityLabel("Open LinkedIn Developer apps")
        }
      }

      VStack(alignment: .leading, spacing: 6) {
        Text("Callback URL")
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        Text(
          "Not required for manual token mode. Do not add a Relay or Railway callback URL to the user's LinkedIn app for this connection."
        )
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.text)
        .fixedSize(horizontal: false, vertical: true)
      }

      VStack(alignment: .leading, spacing: 8) {
        Text("Token scopes")
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 112), spacing: 8)], alignment: .leading, spacing: 8
        ) {
          ForEach(marketplaceRequiredScopes(for: app), id: \.self) { scope in
            ApplicationsScopeChip(scope: scope)
          }
        }
      }

      VStack(alignment: .leading, spacing: 10) {
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 230), spacing: 10)], alignment: .leading,
          spacing: 10
        ) {
          ApplicationsCredentialInput(
            label: "LinkedIn Client ID", placeholder: "Client ID",
            text: $model.linkedinClientIdDraft, secure: true)
          ApplicationsCredentialInput(
            label: "LinkedIn Client Secret", placeholder: "Client secret",
            text: $model.linkedinClientSecretDraft, secure: true)
          ApplicationsCredentialInput(
            label: "LinkedIn Access Token", placeholder: "Bearer access token",
            text: $model.linkedinAccessTokenDraft, secure: true)
          ApplicationsCredentialInput(
            label: "Refresh Token optional", placeholder: "Refresh token",
            text: $model.linkedinRefreshTokenDraft, secure: true)
          ApplicationsCredentialInput(
            label: "Expires at optional", placeholder: "YYYY-MM-DD or token expiry note",
            text: $model.linkedinTokenExpiresAtDraft, secure: false)
        }
        saveButton
      }

      if let status = model.linkedinConnectionStatus?.nilIfEmpty {
        ApplicationsConnectionHint(
          icon: "checkmark.circle.fill", text: status, tone: RCTheme.accentGreen)
      } else if let connection {
        ApplicationsConnectionHint(
          icon: "lock.fill",
          text:
            "\(connection.secretReferenceIds.count) Keychain reference\(connection.secretReferenceIds.count == 1 ? "" : "s") saved. No Relay callback URL is used.",
          tone: RCTheme.muted
        )
      }
    }
    .padding(.top, 2)
  }

  private var saveButton: some View {
    Button {
      model.saveLinkedInManualAccessToken(for: app)
    } label: {
      if model.busy == "save-linkedin-manual-token" {
        HStack(spacing: 7) {
          ProgressView()
            .controlSize(.small)
            .scaleEffect(0.75)
          Text("Saving...")
        }
      } else {
        Text("Save credentials")
      }
    }
    .buttonStyle(PrimaryLightButtonStyle())
    .frame(minWidth: 170)
    .disabled(
      !canSave || model.providerConnectionSnapshot?.readOnly == true
        || app.availability != .available
    )
    .help("Save manual LinkedIn access token as a Keychain-backed reference")
    .accessibilityLabel("Save LinkedIn manual token")
  }
}

struct ApplicationsCredentialInput: View {
  let label: String
  let placeholder: String
  @Binding var text: String
  let secure: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(label)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      Group {
        if secure {
          SecureField(placeholder, text: $text)
        } else {
          TextField(placeholder, text: $text)
        }
      }
      .textFieldStyle(.plain)
      .font(.system(size: 13, weight: .semibold))
      .padding(.horizontal, 11)
      .frame(height: 36)
      .background(RCTheme.sidebarSurface)
      .clipShape(RoundedRectangle(cornerRadius: 7))
      .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
    }
    .frame(minWidth: 210)
  }
}

struct ApplicationsConnectionHint: View {
  let icon: String
  let text: String
  let tone: Color

  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: icon)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(tone)
        .padding(.top, 1)
      Text(text)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .fixedSize(horizontal: false, vertical: true)
    }
  }
}
