import Foundation

public let jsonEncoder: JSONEncoder = {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    return encoder
}()

public let jsonDecoder = JSONDecoder()

public func encodeJSONRecord(_ record: JSONRecord) -> String {
    guard let data = try? jsonEncoder.encode(record), let text = String(data: data, encoding: .utf8) else {
        return "{}"
    }
    return text
}

public func decodeJSONRecord(_ text: String?) -> JSONRecord {
    guard let text, !text.isEmpty, let data = text.data(using: .utf8) else {
        return [:]
    }
    return (try? jsonDecoder.decode(JSONRecord.self, from: data)) ?? [:]
}

public func encodeJSONString<T: Encodable>(_ value: T?) -> String? {
    guard let value else { return nil }
    guard let data = try? jsonEncoder.encode(value) else { return nil }
    return String(data: data, encoding: .utf8)
}

public func decodeJSON<T: Decodable>(_ type: T.Type, from text: String?) -> T? {
    guard let text, let data = text.data(using: .utf8) else { return nil }
    return try? jsonDecoder.decode(T.self, from: data)
}

public func stringValue(_ value: JSONValue?) -> String? {
    guard let value else { return nil }
    switch value {
    case .string(let string):
        return string
    case .number(let number):
        return String(number)
    case .bool(let bool):
        return bool ? "true" : "false"
    default:
        return nil
    }
}

public func boolValue(_ value: JSONValue?) -> Bool? {
    guard let value else { return nil }
    switch value {
    case .bool(let bool):
        return bool
    case .string(let string):
        return ["1", "true", "yes", "on"].contains(string.lowercased())
    default:
        return nil
    }
}

