import CryptoKit
import Foundation

public final class NativeChatAttachmentStore: @unchecked Sendable {
    public let rootURL: URL

    public init(appDataRoot: URL) {
        self.rootURL = appDataRoot
            .appendingPathComponent("chat-attachments", isDirectory: true)
            .standardizedFileURL
    }

    @discardableResult
    public func persist(data: Data, attachment: ChatAttachment) throws -> String {
        let destination = try fileURL(for: attachment)
        let digest = SHA256.hash(data: data)
            .map { String(format: "%02x", $0) }
            .joined()
        guard data.count == attachment.byteSize, digest == attachment.sha256.lowercased() else {
            throw RelayError(.invalidInput, "Attachment bytes do not match the selected file.")
        }

        let directory = destination.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o700],
            ofItemAtPath: directory.path
        )
        try data.write(to: destination, options: .atomic)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o600],
            ofItemAtPath: destination.path
        )
        return destination.path
    }

    public func readableImagePath(for attachment: ChatAttachment) throws -> String? {
        guard attachment.kind == .image,
              attachment.mimeType.lowercased().hasPrefix("image/")
        else { return nil }
        guard attachment.status == .uploaded else {
            throw RelayError(.invalidInput, "The selected image has not finished importing.")
        }

        let fileURL = try fileURL(for: attachment)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            throw RelayError(
                .notFound,
                "The selected image is no longer available. Remove it and attach the image again."
            )
        }
        let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
        let digest = SHA256.hash(data: data)
            .map { String(format: "%02x", $0) }
            .joined()
        guard data.count == attachment.byteSize, digest == attachment.sha256.lowercased() else {
            throw RelayError(
                .invalidInput,
                "The retained image no longer matches the selected attachment. Attach it again."
            )
        }
        return fileURL.path
    }

    public func remove(_ attachment: ChatAttachment) throws {
        let directory = try fileURL(for: attachment).deletingLastPathComponent()
        guard FileManager.default.fileExists(atPath: directory.path) else { return }
        try FileManager.default.removeItem(at: directory)
    }

    private func fileURL(for attachment: ChatAttachment) throws -> URL {
        let attachmentId = attachment.id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !attachmentId.isEmpty,
              URL(fileURLWithPath: attachmentId).lastPathComponent == attachmentId
        else {
            throw RelayError(.invalidInput, "Attachment id is invalid.")
        }
        let fileName = URL(fileURLWithPath: attachment.fileName).lastPathComponent
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !fileName.isEmpty, fileName != ".", fileName != ".." else {
            throw RelayError(.invalidInput, "Attachment filename is invalid.")
        }
        let candidate = rootURL
            .appendingPathComponent(attachmentId, isDirectory: true)
            .appendingPathComponent(fileName, isDirectory: false)
            .standardizedFileURL
        let rootPath = rootURL.path.hasSuffix("/") ? rootURL.path : rootURL.path + "/"
        guard candidate.path.hasPrefix(rootPath) else {
            throw RelayError(.permissionDenied, "Attachment path is outside Relay Console storage.")
        }
        return candidate
    }
}
