import Foundation

enum MultipartFormDataSecurity {
    enum Violation: Error, Equatable {
        case invalidFilename
        case invalidMIMEType
        case invalidBoundary
    }

    static let maximumFilenameBytes = 120

    static func safeFilename(_ rawValue: String) throws -> String {
        guard !rawValue.isEmpty,
              !rawValue.contains("\""),
              !rawValue.unicodeScalars.contains(where: {
                  CharacterSet.controlCharacters.contains($0)
              })
        else {
            throw Violation.invalidFilename
        }

        let slashNormalized = rawValue.replacingOccurrences(of: "\\", with: "/")
        guard let rawBasename = slashNormalized
            .split(separator: "/", omittingEmptySubsequences: false)
            .last,
              !rawBasename.isEmpty,
              rawBasename != ".",
              rawBasename != ".."
        else {
            throw Violation.invalidFilename
        }

        let folded = String(rawBasename)
            .precomposedStringWithCompatibilityMapping
            .folding(
                options: [.diacriticInsensitive, .widthInsensitive],
                locale: Locale(identifier: "en_US_POSIX")
            )

        var normalized = ""
        var pendingReplacement = false
        for scalar in folded.unicodeScalars {
            if isSafeFilenameScalar(scalar) {
                if pendingReplacement,
                   !normalized.isEmpty,
                   !normalized.hasSuffix("."),
                   !normalized.hasSuffix("_"),
                   !normalized.hasSuffix("-") {
                    normalized.append("_")
                }
                normalized.unicodeScalars.append(scalar)
                pendingReplacement = false
            } else {
                pendingReplacement = true
            }
        }

        normalized = ensureSafeStem(normalized)

        return boundedFilename(normalized)
    }

    static func safeMIMEType(_ rawValue: String) throws -> String {
        guard rawValue == rawValue.trimmingCharacters(in: .whitespacesAndNewlines),
              rawValue.utf8.count <= 127
        else {
            throw Violation.invalidMIMEType
        }
        let parts = rawValue.split(separator: "/", omittingEmptySubsequences: false)
        guard parts.count == 2,
              !parts[0].isEmpty,
              !parts[1].isEmpty,
              parts.allSatisfy({ $0.unicodeScalars.allSatisfy(isMIMETokenScalar) })
        else {
            throw Violation.invalidMIMEType
        }
        return rawValue.lowercased()
    }

    static func encodeFile(
        data: Data,
        filename rawFilename: String,
        mimeType rawMIMEType: String,
        boundary: String
    ) throws -> Data {
        guard !boundary.isEmpty,
              boundary.utf8.count <= 70,
              boundary.unicodeScalars.allSatisfy({
                  isASCIIAlphaNumeric($0) || $0.value == 45
              })
        else {
            throw Violation.invalidBoundary
        }

        let filename = try safeFilename(rawFilename)
        let mimeType = try safeMIMEType(rawMIMEType)

        var body = Data()
        body.appendUTF8("--\(boundary)\r\n")
        body.appendUTF8(
            "Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n"
        )
        body.appendUTF8("Content-Type: \(mimeType)\r\n\r\n")
        body.append(data)
        body.appendUTF8("\r\n--\(boundary)--\r\n")
        return body
    }

    private static func ensureSafeStem(_ normalized: String) -> String {
        let characters = Array(normalized)
        let finalDot = characters.lastIndex(of: ".")
        let stem = finalDot.map { Array(characters[..<$0]) } ?? characters
        if stem.contains(where: { character in
            character.unicodeScalars.allSatisfy(isASCIIAlphaNumeric)
        }) {
            return normalized
        }

        guard let finalDot else {
            return "upload"
        }
        let extensionCandidate = String(characters[characters.index(after: finalDot)...])
        guard !extensionCandidate.isEmpty,
              extensionCandidate.count <= 16,
              extensionCandidate.unicodeScalars.allSatisfy(isSafeFilenameScalar)
        else {
            return "upload"
        }
        return "upload.\(extensionCandidate)"
    }

    private static func boundedFilename(_ filename: String) -> String {
        guard filename.utf8.count > maximumFilenameBytes else {
            return filename
        }

        let characters = Array(filename)
        if let dot = characters.lastIndex(of: ".") {
            let suffix = Array(characters[dot...])
            let stem = Array(characters[..<dot])
            if suffix.count <= 17, !stem.isEmpty {
                let availableStemCount = maximumFilenameBytes - suffix.count
                return String(stem.prefix(availableStemCount) + suffix)
            }
        }
        return String(characters.prefix(maximumFilenameBytes))
    }

    private static func isSafeFilenameScalar(_ scalar: Unicode.Scalar) -> Bool {
        isASCIIAlphaNumeric(scalar) ||
            scalar.value == 45 ||
            scalar.value == 46 ||
            scalar.value == 95
    }

    private static func isMIMETokenScalar(_ scalar: Unicode.Scalar) -> Bool {
        isASCIIAlphaNumeric(scalar) ||
            "!#$&^_.+-".unicodeScalars.contains(scalar)
    }

    private static func isASCIIAlphaNumeric(_ scalar: Unicode.Scalar) -> Bool {
        (48...57).contains(scalar.value) ||
            (65...90).contains(scalar.value) ||
            (97...122).contains(scalar.value)
    }
}

private extension Data {
    mutating func appendUTF8(_ value: String) {
        append(contentsOf: value.utf8)
    }
}
