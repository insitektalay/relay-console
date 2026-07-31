import Foundation

public struct HarnessModelOption: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var label: String
    public var runtimeType: RuntimeType
    public var isDefault: Bool
    public var source: String
}

public struct HarnessRuntimeModelCatalog: Codable, Equatable, Sendable {
    public var runtimeType: RuntimeType
    public var defaultModel: String
    public var models: [String]
    public var source: String
    public var observedAt: String
    public var isFallback: Bool

    public init(
        runtimeType: RuntimeType,
        defaultModel: String,
        models: [String],
        source: String,
        observedAt: String,
        isFallback: Bool = false
    ) {
        self.runtimeType = runtimeType
        self.defaultModel = defaultModel
        self.models = models
        self.source = source
        self.observedAt = observedAt
        self.isFallback = isFallback
    }
}

public struct ResolvedHarnessModel: Codable, Equatable, Sendable {
    public var requested: String?
    public var selected: String
    public var fallbackApplied: Bool
    public var reason: String?
}

public enum HarnessModelSelectionService {
    private static let catalogLock = NSLock()
    nonisolated(unsafe) private static var observedCatalogs: [RuntimeType: HarnessRuntimeModelCatalog] = [:]

    public static func updateObservedCatalog(_ catalog: HarnessRuntimeModelCatalog) {
        let normalizedModels = normalizedModelIDs(catalog.models)
        guard !normalizedModels.isEmpty else { return }
        let defaultModel = normalizedModels.contains(catalog.defaultModel)
            ? catalog.defaultModel
            : normalizedModels[0]
        catalogLock.lock()
        observedCatalogs[catalog.runtimeType] = HarnessRuntimeModelCatalog(
            runtimeType: catalog.runtimeType,
            defaultModel: defaultModel,
            models: normalizedModels,
            source: catalog.source,
            observedAt: catalog.observedAt,
            isFallback: catalog.isFallback
        )
        catalogLock.unlock()
    }

    public static func catalog(for runtimeType: RuntimeType) -> HarnessRuntimeModelCatalog {
        catalogLock.lock()
        let observed = observedCatalogs[runtimeType]
        catalogLock.unlock()
        if let observed { return observed }
        let ids = fallbackModelIDs(for: runtimeType)
        return HarnessRuntimeModelCatalog(
            runtimeType: runtimeType,
            defaultModel: ids.first ?? "",
            models: ids,
            source: "relay-offline-fallback",
            observedAt: "",
            isFallback: true
        )
    }

    public static func options(for runtimeType: RuntimeType) -> [HarnessModelOption] {
        let catalog = catalog(for: runtimeType)
        let ids = catalog.models
        return ids.enumerated().map { index, id in
            HarnessModelOption(
                id: id,
                label: id,
                runtimeType: runtimeType,
                isDefault: id == catalog.defaultModel || (catalog.defaultModel.isEmpty && index == 0),
                source: catalog.source
            )
        }
    }

    public static func defaultModel(for runtimeType: RuntimeType) throws -> String {
        guard let model = options(for: runtimeType).first(where: \.isDefault)?.id else {
            throw RelayError(.unsupported, "Model selection is unavailable for \(runtimeType.rawValue).")
        }
        return model
    }

    public static func resolve(_ requested: String?, for runtimeType: RuntimeType) throws -> ResolvedHarnessModel {
        let available = options(for: runtimeType)
        guard let fallback = available.first(where: \.isDefault)?.id else {
            throw RelayError(.unsupported, "Model selection is unavailable for \(runtimeType.rawValue).")
        }
        let normalized = requested?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let normalized, !normalized.isEmpty else {
            return ResolvedHarnessModel(requested: requested, selected: fallback, fallbackApplied: false, reason: nil)
        }
        guard available.contains(where: { $0.id == normalized }) else {
            // Hermes owns model availability. Preserve a syntactically safe model
            // selected by Hermes itself even if Relay is temporarily offline or
            // its last observed catalogue predates that model.
            if runtimeType == .hermes, isSafeRuntimeModelID(normalized) {
                return ResolvedHarnessModel(
                    requested: normalized,
                    selected: normalized,
                    fallbackApplied: false,
                    reason: "Preserved from the connected Hermes runtime."
                )
            }
            return ResolvedHarnessModel(requested: normalized, selected: fallback, fallbackApplied: true, reason: "The selected model is not in the Relay-tested catalog for this harness release.")
        }
        return ResolvedHarnessModel(requested: normalized, selected: normalized, fallbackApplied: false, reason: nil)
    }

    private static func fallbackModelIDs(for runtimeType: RuntimeType) -> [String] {
        switch runtimeType {
        case .hermes:
            return [
                "gpt-5.6-sol",
                "gpt-5.6-terra",
                "gpt-5.6-luna",
                "gpt-5.5",
                "gpt-5.4",
                "gpt-5.4-mini",
                "gpt-5.3-codex-spark",
                "gpt-5.3-codex"
            ]
        case .openclaw:
            return ["gpt-5.5", "gpt-5.4", "gpt-5.3-codex"]
        case .relayEcho, .claudeCode, .codexCli:
            return []
        }
    }

    private static func normalizedModelIDs(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.compactMap { value in
            let model = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard isSafeRuntimeModelID(model), seen.insert(model).inserted else { return nil }
            return model
        }
    }

    private static func isSafeRuntimeModelID(_ value: String) -> Bool {
        guard !value.isEmpty, value.count <= 128 else { return false }
        return value.unicodeScalars.allSatisfy {
            CharacterSet.alphanumerics.contains($0)
                || CharacterSet(charactersIn: "._:/-").contains($0)
        }
    }
}
