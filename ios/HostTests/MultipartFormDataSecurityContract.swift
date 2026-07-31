import Foundation

@main
struct MultipartFormDataSecurityContract {
    static func main() throws {
        expectEqual(
            try MultipartFormDataSecurity.safeFilename(#"C:\private\Résumé final.md"#),
            "Resume_final.md",
            "Paths and Unicode must normalize to one safe basename"
        )
        expectEqual(
            try MultipartFormDataSecurity.safeFilename(
                String(repeating: "a", count: 200) + ".markdown"
            ).utf8.count,
            MultipartFormDataSecurity.maximumFilenameBytes,
            "The filename byte cap must preserve a short extension"
        )
        expectEqual(
            try MultipartFormDataSecurity.safeMIMEType("IMAGE/SVG+XML"),
            "image/svg+xml",
            "MIME values must normalize without changing their token"
        )
        expectEqual(
            try MultipartFormDataSecurity.safeFilename("报告.md"),
            "upload.md",
            "A Unicode-only basename must retain a safe non-empty stem"
        )

        for hostile in [
            "report\r\nX-Evil: yes.md",
            "report\n.md",
            "report\"; name=\"evil.md",
            "report\u{0000}.md",
            "/private/path/",
            "..",
        ] {
            expectViolation(.invalidFilename) {
                _ = try MultipartFormDataSecurity.safeFilename(hostile)
            }
        }

        for hostile in [
            "text/plain\r\nX-Evil: yes",
            "text/plain; charset=utf-8",
            " text/plain",
            "text",
        ] {
            expectViolation(.invalidMIMEType) {
                _ = try MultipartFormDataSecurity.safeMIMEType(hostile)
            }
        }

        let body = try MultipartFormDataSecurity.encodeFile(
            data: Data("hello".utf8),
            filename: "/private/Café notes.md",
            mimeType: "TEXT/MARKDOWN",
            boundary: "Boundary-0123456789"
        )
        let bodyText = String(decoding: body, as: UTF8.self)
        expectEqual(
            bodyText.components(separatedBy: "Content-Disposition:").count - 1,
            1,
            "A file must produce exactly one content-disposition header"
        )
        expectEqual(
            bodyText.components(separatedBy: "Content-Type:").count - 1,
            1,
            "A file must produce exactly one content-type header"
        )
        guard bodyText.contains(#"filename="Cafe_notes.md""#),
              bodyText.contains("Content-Type: text/markdown\r\n"),
              !bodyText.contains("/private/")
        else {
            fatalError("The encoded body did not retain only normalized display metadata")
        }

        print("Multipart form-data security contract passed")
    }

    private static func expectEqual<T: Equatable>(
        _ actual: T,
        _ expected: T,
        _ message: String
    ) {
        guard actual == expected else {
            fatalError("\(message): expected \(expected), got \(actual)")
        }
    }

    private static func expectViolation(
        _ expected: MultipartFormDataSecurity.Violation,
        _ operation: () throws -> Void
    ) {
        do {
            try operation()
            fatalError("Expected \(expected)")
        } catch let violation as MultipartFormDataSecurity.Violation {
            expectEqual(violation, expected, "Unexpected multipart violation")
        } catch {
            fatalError("Unexpected error: \(error)")
        }
    }
}
