import Foundation

struct ExternalArtifactSyncPresentation {
    let normalizedURL: String?
    let state: AgentArtifactPresentationState
    let reason: String?
}

func applyExternalArtifactSyncPolicy(
    _ rawValue: String?,
    to row: inout [String: Any]
) {
    guard let rawValue else { return }
    if let destination = ExternalArtifactURLPolicy.destination(rawValue) {
        row["externalUrl"] = destination.normalizedURL
    } else {
        row["presentationState"] = AgentArtifactPresentationState.unavailable.rawValue
        row["presentationReason"] = ExternalArtifactURLPolicy.blockedReason
    }
}

func externalArtifactSyncPresentation(
    from row: [String: Any]
) -> ExternalArtifactSyncPresentation {
    let rawURL = row["externalUrl"] as? String
    let destination = ExternalArtifactURLPolicy.destination(rawURL)
    let blocked = rawURL != nil && destination == nil
    return ExternalArtifactSyncPresentation(
        normalizedURL: destination?.normalizedURL,
        state: blocked
            ? .unavailable
            : AgentArtifactPresentationState(
                rawValue: row["presentationState"] as? String ?? ""
            ) ?? .unavailable,
        reason: blocked
            ? ExternalArtifactURLPolicy.blockedReason
            : row["presentationReason"] as? String
    )
}
