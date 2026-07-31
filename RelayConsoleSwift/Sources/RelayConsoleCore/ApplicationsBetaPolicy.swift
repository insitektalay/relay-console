import Foundation

private struct MarketplaceReleaseManifestResource: Codable {
    struct Freeze: Codable {
        var status: String
        var frozenAt: String?
        var sourceRevision: String?
    }

    struct Decision: Codable, Equatable {
        var slug: String?
        var state: String
        var label: String
        var connectEligible: Bool
        var liveVerified: Bool
        var reason: String
        var reviewedAt: String?
    }

    var schemaVersion: String
    var manifestVersion: String
    var releaseChannel: String
    var freeze: Freeze
    var defaultProvider: Decision
    var providers: [Decision]
}

public struct ApplicationsBetaPolicy: Equatable, Sendable {
    public var schemaVersion: Int
    public var manifestVersion: String
    public var releaseChannel: String
    public var reviewedAt: String
    public var approvedSlugs: [String]
    public var unapprovedAvailability: MarketplaceAppAvailabilityState
    public var unapprovedReason: String
    public var freezeStatus: String

    private var defaultState: String
    private var defaultLabel: String
    private var decisionsBySlug: [String: ReleaseDecision]

    private struct ReleaseDecision: Equatable, Sendable {
        var state: String
        var label: String
        var connectEligible: Bool
        var liveVerified: Bool
        var reason: String
    }

    public static func loadCurrent() throws -> ApplicationsBetaPolicy {
        guard let url = Bundle.module.url(forResource: "marketplace-release-manifest", withExtension: "json") else {
            throw RelayError(.internalError, "The Marketplace release manifest is missing.")
        }
        let manifest = try JSONDecoder().decode(
            MarketplaceReleaseManifestResource.self,
            from: Data(contentsOf: url)
        )
        let labels = [
            "available": "Available",
            "preview": "Preview",
            "provider_setup_required": "Provider setup required",
            "provider_review_pending": "Provider review pending",
            "customer_credential_required": "Beta — customer credentials required",
            "unsupported": "Unsupported",
            "coming_later": "Coming later",
        ]
        let allDecisions = [manifest.defaultProvider] + manifest.providers
        let slugs = manifest.providers.compactMap(\.slug)
        let connectEligible = manifest.providers.filter(\.connectEligible)
        guard manifest.schemaVersion == "relay.marketplace-release.v1",
              manifest.releaseChannel == RelayConsoleReleaseMetadata.current.releaseChannel,
              manifest.freeze.status == "open" || manifest.freeze.status == "frozen",
              manifest.freeze.status == "frozen" || (manifest.freeze.frozenAt == nil && manifest.freeze.sourceRevision == nil),
              Set(slugs).count == slugs.count,
              slugs == slugs.sorted(),
              slugs.allSatisfy({ $0.range(of: "^[a-z0-9]+(?:-[a-z0-9]+)*$", options: .regularExpression) != nil }),
              allDecisions.allSatisfy({ decision in
                  labels[decision.state] == decision.label
                      && !decision.reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                      && (!decision.liveVerified || decision.connectEligible)
                      && decision.connectEligible == (decision.state == "available" || decision.state == "customer_credential_required")
              }),
              !manifest.defaultProvider.connectEligible,
              !manifest.defaultProvider.liveVerified
        else {
            throw RelayError(.internalError, "The Marketplace release manifest failed validation.")
        }
        let decisions = Dictionary(uniqueKeysWithValues: manifest.providers.compactMap { decision -> (String, ReleaseDecision)? in
            guard let slug = decision.slug else { return nil }
            return (
                slug,
                ReleaseDecision(
                    state: decision.state,
                    label: decision.label,
                    connectEligible: decision.connectEligible,
                    liveVerified: decision.liveVerified,
                    reason: decision.reason
                )
            )
        })
        return ApplicationsBetaPolicy(
            schemaVersion: 1,
            manifestVersion: manifest.manifestVersion,
            releaseChannel: manifest.releaseChannel,
            reviewedAt: manifest.manifestVersion.prefix(10).description,
            approvedSlugs: connectEligible.compactMap(\.slug),
            unapprovedAvailability: availability(forReleaseState: manifest.defaultProvider.state),
            unapprovedReason: manifest.defaultProvider.reason,
            freezeStatus: manifest.freeze.status,
            defaultState: manifest.defaultProvider.state,
            defaultLabel: manifest.defaultProvider.label,
            decisionsBySlug: decisions
        )
    }

    public func availability(for slug: String) -> MarketplaceAppAvailabilityState {
        if approvedSlugs.contains(slug) { return .available }
        return Self.availability(forReleaseState: decisionsBySlug[slug]?.state ?? defaultState)
    }

    public func releaseLabel(for slug: String) -> String {
        if approvedSlugs.contains(slug), decisionsBySlug[slug] == nil { return "Available" }
        return decisionsBySlug[slug]?.label ?? defaultLabel
    }

    public func apply(to app: MarketplaceCatalogApp) -> MarketplaceCatalogApp {
        var gated = app
        // Release policy can narrow a supported provider, but it cannot invent
        // a connector for a canonically unsupported provider.
        if app.availability == .unavailable {
            return gated
        }
        if approvedSlugs.contains(app.slug),
           decisionsBySlug[app.slug] == nil,
           app.availability != .unavailable {
            // Explicit policy overrides are used by native integration tests and
            // owner-reviewed preview environments. Approval is the availability
            // decision for a supported provider, but it must never override a
            // canonical unsupported-provider contract.
            gated.availability = .available
            gated.availabilityReason = nil
            gated.betaNotice = "Available"
            return gated
        }
        let decision = decisionsBySlug[app.slug]
        gated.availability = availability(for: app.slug)
        gated.availabilityReason = decision?.reason ?? unapprovedReason
        gated.betaNotice = decision?.label ?? defaultLabel
        if decision?.connectEligible == true,
           decision?.liveVerified == false,
           gated.capabilities.isEmpty,
           gated.runtimeSupport.isEmpty {
            gated.summary = "\(gated.name) credentials can be encrypted and saved as configured but unverified. No provider request, runtime installation, or agent action is enabled until Relay ships a bounded connector."
        }
        return gated
    }

    private static func availability(forReleaseState state: String) -> MarketplaceAppAvailabilityState {
        switch state {
        case "available", "customer_credential_required":
            return .available
        case "preview", "coming_later":
            return .comingSoon
        default:
            return .unavailable
        }
    }
}
