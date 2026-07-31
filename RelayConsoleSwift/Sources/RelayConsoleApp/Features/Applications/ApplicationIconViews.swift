import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ProviderConnectionAdvancedDetails: View {
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection?
  let latestFlow: ProviderAuthorizationFlow?

  private var callbackURL: String {
    connection?.callbackURL
      ?? latestFlow?.callbackURL
      ?? ProviderConnectionService.defaultCallbackURL(for: app)
  }

  private var usesPersonalXTokens: Bool {
    app.slug == "x"
  }

  private var usesManualTokenMode: Bool {
    app.slug == "x" || app.slug == "linkedin" || app.slug == "gmail" || app.slug == "google-docs"
      || app.slug == "google-calendar" || app.slug == "google-drive"
      || app.slug == "google-analytics" || app.slug == "microsoft-clarity"
      || app.slug == "telemetrydeck" || app.slug == "notion"
  }

  var body: some View {
    DisclosureGroup("Setup details") {
      VStack(alignment: .leading, spacing: 10) {
        if usesManualTokenMode {
          ApplicationsDetailMetric(
            title: "Callback URL", value: "Not required for manual token mode")
        } else {
          HStack(alignment: .top, spacing: 10) {
            ApplicationsDetailMetric(title: "Callback URL", value: callbackURL)
            Button {
              NSPasteboard.general.clearContents()
              NSPasteboard.general.setString(callbackURL, forType: .string)
            } label: {
              Image(systemName: "doc.on.doc")
            }
            .buttonStyle(IconButtonStyle())
            .help("Callback URL copied")
            .accessibilityLabel("Copy callback URL")
          }
        }
        ApplicationsDetailMetric(
          title: "Status", value: connection?.status.rawValue ?? "Not connected")
        ApplicationsDetailMetric(
          title: "Account",
          value: connection?.connectedHandle ?? connection?.accountLabel ?? "Unavailable")
        ApplicationsDetailMetric(
          title: usesPersonalXTokens ? "Granted permissions" : "Granted scopes",
          value: scopesText(connection?.grantedScopes ?? []))
        ApplicationsDetailMetric(
          title: usesPersonalXTokens ? "Required permissions" : "Required scopes",
          value: scopesText(marketplaceRequiredScopes(for: app)))

        if let flow = latestFlow {
          ApplicationsDetailMetric(title: "Setup state", value: flow.state.rawValue)
          ApplicationsDetailMetric(
            title: "Setup note", value: flow.manualEvidenceNote ?? "No setup note")
        }
      }
      .padding(.top, 8)
    }
  }

  private func scopesText(_ scopes: [String]) -> String {
    scopes.isEmpty ? "none" : scopes.joined(separator: ", ")
  }
}

struct ApplicationsDetailMetric: View {
  let title: String
  let value: String

  var body: some View {
    HStack(alignment: .top) {
      Text(title)
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(RCTheme.muted)
        .frame(width: 120, alignment: .leading)
      Text(value.isEmpty ? "Unavailable" : value)
        .font(.system(size: 12, weight: .semibold))
        .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct ApplicationsAppIconView: View {
  let app: MarketplaceCatalogApp
  var size: CGFloat = 36

  var body: some View {
    if let entry = ApplicationsMarketplaceIconAtlas.entry(for: app.slug),
      let atlasImage = ApplicationsMarketplaceIconAtlas.image,
      let index = ApplicationsMarketplaceIconAtlas.index
    {
      ApplicationsMarketplaceAtlasIconView(
        image: atlasImage,
        entry: entry,
        columns: index.columns,
        rows: index.rows,
        name: app.name,
        size: size
      )
    } else if app.slug == "threads" {
      ApplicationsThreadsMark(size: size)
    } else if app.slug == "pinterest" {
      ApplicationsPinterestMark(size: size)
    } else if let logo = ApplicationsBrandLogo(app: app) {
      ApplicationsBrandedIconView(logo: logo, size: size)
    } else if let websiteURL = app.websiteURL, let url = providerFaviconURL(websiteURL) {
      AsyncImage(url: url) { phase in
        if case .success(let image) = phase {
          image.resizable().scaledToFit().padding(size * 0.16)
        } else {
          ApplicationsIconFallbackView(icon: app.iconFallback, size: size)
        }
      }
      .frame(width: size, height: size)
      .background(Color.white)
      .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
    } else {
      ApplicationsIconFallbackView(icon: app.iconFallback, size: size)
    }
  }

  private func providerFaviconURL(_ websiteURL: String) -> URL? {
    var components = URLComponents(string: "https://www.google.com/s2/favicons")
    components?.queryItems = [
      URLQueryItem(name: "domain_url", value: websiteURL), URLQueryItem(name: "sz", value: "128"),
    ]
    return components?.url
  }
}

struct ApplicationsMarketplaceIconAtlasEntry: Decodable {
  let column: Int
  let row: Int
}

struct ApplicationsMarketplaceIconAtlasIndex: Decodable {
  let appCount: Int
  let columns: Int
  let rows: Int
  let apps: [String: ApplicationsMarketplaceIconAtlasEntry]
}

enum ApplicationsMarketplaceIconAtlas {
  static let index: ApplicationsMarketplaceIconAtlasIndex? = {
    guard
      let url = Bundle.module.url(
        forResource: "marketplace-icon-atlas-index",
        withExtension: "json"
      ), let data = try? Data(contentsOf: url),
      let decoded = try? JSONDecoder().decode(
        ApplicationsMarketplaceIconAtlasIndex.self, from: data),
      decoded.appCount == 406,
      decoded.apps.count == 406
    else { return nil }
    return decoded
  }()

  static let image: NSImage? = {
    guard
      let url = Bundle.module.url(
        forResource: "marketplace-icon-atlas",
        withExtension: "png"
      )
    else { return nil }
    return NSImage(contentsOf: url)
  }()

  static func entry(for slug: String) -> ApplicationsMarketplaceIconAtlasEntry? {
    index?.apps[slug]
  }
}

struct ApplicationsMarketplaceAtlasIconView: View {
  let image: NSImage
  let entry: ApplicationsMarketplaceIconAtlasEntry
  let columns: Int
  let rows: Int
  let name: String
  let size: CGFloat

  var body: some View {
    Image(nsImage: image)
      .resizable()
      .frame(width: size * CGFloat(columns), height: size * CGFloat(rows))
      .offset(x: -size * CGFloat(entry.column), y: -size * CGFloat(entry.row))
      .frame(width: size, height: size, alignment: .topLeading)
      .clipped()
      .background(Color.white)
      .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
      .accessibilityLabel("\(name) logo")
  }
}

struct ApplicationsPinterestMark: View {
  let size: CGFloat
  var body: some View {
    ZStack {
      Circle().fill(Color(red: 0.90, green: 0.00, blue: 0.14))
      Text("P")
        .font(.system(size: size * 0.58, weight: .bold, design: .serif).italic())
        .foregroundStyle(Color.white)
    }
    .frame(width: size, height: size)
    .accessibilityLabel("Pinterest provider badge fallback")
  }
}

struct ApplicationsThreadsMark: View {
  let size: CGFloat
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).fill(Color.black)
      Image(systemName: "at").font(.system(size: size * 0.58, weight: .bold, design: .rounded))
        .foregroundStyle(Color.white)
    }.frame(width: size, height: size).accessibilityLabel("Threads")
  }
}

struct ApplicationsBrandedIconView: View {
  let logo: ApplicationsBrandLogo
  let size: CGFloat

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius)
        .fill(containerBackground)
      if logo.usesWhiteCanvas {
        RoundedRectangle(cornerRadius: logoCanvasSize * 0.075)
          .fill(Color.white)
          .frame(width: logoCanvasSize, height: logoCanvasSize)
      }
      if let assetImage = logo.assetImage {
        Image(nsImage: assetImage)
          .resizable()
          .renderingMode(.original)
          .aspectRatio(contentMode: logo == .relayConsole ? .fill : .fit)
          .frame(
            width: logoMarkSize, height: logoMarkSize,
            alignment: logo == .relayConsole ? .trailing : .center
          )
          .clipped()
      } else {
        ForEach(logo.pathSegments.indices, id: \.self) { index in
          let segment = logo.pathSegments[index]
          ApplicationsSVGPathShape(
            pathData: segment.pathData,
            viewBoxSize: logo.viewBoxSize,
            viewBoxOrigin: logo.viewBoxOrigin
          )
          .fill(segment.fill, style: FillStyle(eoFill: segment.usesEvenOddFill))
          .frame(width: logoMarkSize, height: logoMarkSize)
        }
      }
    }
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
    .overlay(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(borderColor))
    .help("\(logo.displayName) logo")
    .accessibilityLabel("\(logo.displayName) logo")
  }

  private var logoCanvasSize: CGFloat {
    switch logo {
    case .relayConsole:
      return size * 0.86
    case .x:
      return size * 0.58
    case .linkedIn:
      return size * 0.76
    case .exaSearch:
      return size * 0.72
    case .gmail:
      return size * 0.82
    case .postHog, .notion:
      return size * 0.82
    case .telemetryDeck:
      return size * 0.84
    default:
      return size * 0.80
    }
  }

  private var logoMarkSize: CGFloat {
    switch logo {
    case .relayConsole:
      return size * 0.82
    case .exaSearch:
      return size * 0.58
    case .gmail:
      return size * 0.66
    case .postHog:
      return size * 0.62
    case .notion:
      return size * 0.70
    case .microsoftClarity, .telemetryDeck:
      return size * 0.68
    case .googleDocs, .googleCalendar, .googleDrive, .googleSearchConsole, .googleAnalytics,
      .googleMerchantCenter:
      return size * 0.66
    case .sentry:
      return size * 0.64
    default:
      return logoCanvasSize
    }
  }

  private var containerBackground: Color {
    switch logo {
    case .x, .relayConsole:
      return Color.black.opacity(0.92)
    default:
      return RCTheme.sidebarSurfaceAlt
    }
  }

  private var borderColor: Color {
    switch logo {
    case .x:
      return Color.white.opacity(0.22)
    case .relayConsole:
      return RCTheme.relayCyan.opacity(0.58)
    default:
      return logo.markColor.opacity(0.45)
    }
  }
}

struct ApplicationsBrandPathSegment {
  let pathData: String
  let fill: Color
  var usesEvenOddFill = false
}
