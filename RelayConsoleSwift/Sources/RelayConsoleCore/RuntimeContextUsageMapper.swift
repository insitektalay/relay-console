import Foundation

public enum RuntimeContextUsageMapper {
    public static func hermesContextUsage(
        from usage: JSONRecord,
        dispatchId: RelayId? = nil,
        source: String
    ) -> JSONRecord? {
        let tokenCount = jsonInt(
            usage["context_used"]
                ?? usage["contextUsed"]
                ?? usage["context_tokens"]
                ?? usage["contextTokens"]
        )
        let maxTokens = jsonInt(
            usage["context_max"]
                ?? usage["contextMax"]
                ?? usage["context_length"]
                ?? usage["contextLength"]
        )
        var percentUsed = jsonDouble(
            usage["context_percent"]
                ?? usage["contextPercent"]
                ?? usage["percentUsed"]
                ?? usage["usagePercent"]
        )
        if percentUsed == nil, let tokenCount, let maxTokens, maxTokens > 0 {
            percentUsed = Double(tokenCount) / Double(maxTokens) * 100
        }

        guard percentUsed != nil || tokenCount != nil || maxTokens != nil else {
            return nil
        }

        let isEstimate = boolValue(usage["isEstimate"])
            ?? boolValue(usage["estimate"])
            ?? (tokenCount == nil || maxTokens == nil || percentUsed == nil)

        var record: JSONRecord = [
            "harness": .string("hermes"),
            "source": .string(source),
            "measurement": .string("hermes_gateway_usage"),
            "isEstimate": .bool(isEstimate),
            "referencesCount": .number(0),
            "level": .string(contextUsageLevel(percentUsed)),
            "redactionStatus": .string("reference-details-excluded")
        ]
        if let dispatchId {
            record["dispatchId"] = .string(dispatchId)
        }
        if let percentUsed {
            record["percentUsed"] = .number(normalizedPercent(percentUsed))
        }
        if let tokenCount {
            record["tokenCount"] = .number(Double(tokenCount))
        }
        if let maxTokens {
            record["maxTokens"] = .number(Double(maxTokens))
        }
        if let model = stringValue(usage["model"]), !model.isEmpty {
            record["model"] = .string(model)
        }
        copyInt("calls", from: usage, to: &record, as: "apiCalls")
        copyInt("total", from: usage, to: &record, as: "sessionTotalTokens")
        copyInt("prompt", from: usage, to: &record, as: "sessionPromptTokens")
        copyInt("input", from: usage, to: &record, as: "sessionInputTokens")
        copyInt("output", from: usage, to: &record, as: "sessionOutputTokens")
        copyInt("compressions", from: usage, to: &record, as: "compressions")
        return record
    }

    private static func copyInt(_ sourceKey: String, from source: JSONRecord, to destination: inout JSONRecord, as destinationKey: String) {
        if let value = jsonInt(source[sourceKey]) {
            destination[destinationKey] = .number(Double(value))
        }
    }

    private static func contextUsageLevel(_ percentUsed: Double?) -> String {
        guard let percentUsed else { return "unknown" }
        switch normalizedPercent(percentUsed) {
        case 90...:
            return "critical"
        case 75..<90:
            return "warning"
        default:
            return "normal"
        }
    }

    private static func normalizedPercent(_ value: Double) -> Double {
        value > 0 && value <= 1 ? value * 100 : max(0, min(100, value))
    }

    private static func jsonDouble(_ value: JSONValue?) -> Double? {
        switch value {
        case .number(let number):
            return number
        case .string(let string):
            return Double(string.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "%")))
        default:
            return nil
        }
    }

    private static func jsonInt(_ value: JSONValue?) -> Int? {
        switch value {
        case .number(let number):
            return Int(number)
        case .string(let string):
            return Int(string.trimmingCharacters(in: .whitespacesAndNewlines))
        default:
            return nil
        }
    }
}
