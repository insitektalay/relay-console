import CryptoKit
import Foundation

struct CloudAttachmentMetadata: Codable, Equatable {
    var id: String
    var workspaceId: String
    var threadId: String
    var filename: String
    var mimeType: String
    var sizeBytes: Int
    var kind: String
    var totalChunks: Int
    var receivedChunks: [Int]
    var createdAt: String
}

struct CloudAttachmentCompletion: Equatable {
    var metadata: CloudAttachmentMetadata
    var sha256: String
    var localMediaRef: String
}

final class CloudAttachmentStore: @unchecked Sendable {
    static let capability = "clawchat.attachments.local_media"
    private static let maximumBytes = 100 * 1024 * 1024

    let rootURL: URL

    init(rootURL: URL? = nil) {
        if let rootURL {
            self.rootURL = rootURL.standardizedFileURL
        } else {
            let applicationSupport = FileManager.default.urls(
                for: .applicationSupportDirectory,
                in: .userDomainMask
            ).first ?? FileManager.default.temporaryDirectory
            self.rootURL = applicationSupport
                .appendingPathComponent("Relay Console", isDirectory: true)
                .appendingPathComponent("cloud-attachments", isDirectory: true)
                .standardizedFileURL
        }
    }

    func begin(_ payload: [String: Any]) throws -> CloudAttachmentMetadata {
        let id = try requiredString(payload, "attachmentId")
        guard UUID(uuidString: id) != nil else {
            throw RelayError(.invalidInput, "Attachment id is invalid.")
        }
        let workspaceId = try requiredString(payload, "workspaceId")
        let threadId = try requiredString(payload, "threadId")
        let filename = try safeFilename(requiredString(payload, "filename"))
        let mimeType = try requiredString(payload, "mimeType")
        let kind = try requiredString(payload, "kind")
        let sizeBytes = try requiredInt(payload, "sizeBytes")
        let totalChunks = try requiredInt(payload, "totalChunks")
        guard sizeBytes >= 0, sizeBytes <= Self.maximumBytes, totalChunks > 0 else {
            throw RelayError(.invalidInput, "Attachment size or chunk count is invalid.")
        }

        let metadata = CloudAttachmentMetadata(
            id: id,
            workspaceId: workspaceId,
            threadId: threadId,
            filename: filename,
            mimeType: mimeType,
            sizeBytes: sizeBytes,
            kind: kind,
            totalChunks: totalChunks,
            receivedChunks: [],
            createdAt: nowIso()
        )
        let directory = directoryURL(id: id)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        FileManager.default.createFile(atPath: uploadURL(id: id).path, contents: Data())
        try writeMetadata(metadata)
        return metadata
    }

    func appendChunk(_ payload: [String: Any]) throws -> Int {
        let id = try requiredString(payload, "attachmentId")
        var metadata = try readMetadata(id: id)
        let workspaceId = try requiredString(payload, "workspaceId")
        let threadId = try requiredString(payload, "threadId")
        let totalChunks = try requiredInt(payload, "totalChunks")
        guard metadata.workspaceId == workspaceId,
              metadata.threadId == threadId,
              metadata.totalChunks == totalChunks
        else {
            throw RelayError(.permissionDenied, "Attachment upload scope does not match this runtime host.")
        }
        let chunkIndex = try requiredInt(payload, "chunkIndex")
        let offsetBytes = try requiredInt(payload, "offsetBytes")
        guard chunkIndex >= 0,
              chunkIndex < metadata.totalChunks,
              !metadata.receivedChunks.contains(chunkIndex),
              let chunkBase64 = payload["chunkBase64"] as? String,
              let chunk = Data(base64Encoded: chunkBase64),
              !chunk.isEmpty
        else {
            throw RelayError(.invalidInput, "Attachment chunk is invalid.")
        }

        let fileURL = uploadURL(id: id)
        let handle = try FileHandle(forWritingTo: fileURL)
        defer { try? handle.close() }
        let currentOffset = try handle.seekToEnd()
        guard currentOffset == UInt64(offsetBytes),
              currentOffset + UInt64(chunk.count) <= UInt64(metadata.sizeBytes)
        else {
            throw RelayError(.invalidInput, "Attachment chunk offset is invalid.")
        }
        try handle.write(contentsOf: chunk)
        metadata.receivedChunks.append(chunkIndex)
        metadata.receivedChunks.sort()
        try writeMetadata(metadata)
        return chunk.count
    }

    func complete(_ payload: [String: Any]) throws -> CloudAttachmentCompletion {
        let id = try requiredString(payload, "attachmentId")
        let metadata = try readMetadata(id: id)
        let workspaceId = try requiredString(payload, "workspaceId")
        let threadId = try requiredString(payload, "threadId")
        guard metadata.workspaceId == workspaceId,
              metadata.threadId == threadId,
              metadata.receivedChunks == Array(0..<metadata.totalChunks)
        else {
            throw RelayError(.permissionDenied, "Attachment upload is incomplete or belongs to another conversation.")
        }
        let source = uploadURL(id: id)
        let bytes = try Data(contentsOf: source, options: .mappedIfSafe)
        guard bytes.count == metadata.sizeBytes else {
            throw RelayError(.invalidInput, "Attachment byte count does not match the declared size.")
        }
        let destination = completedURL(metadata: metadata)
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: source, to: destination)
        let digest = SHA256.hash(data: bytes)
            .map { String(format: "%02x", $0) }
            .joined()
        return CloudAttachmentCompletion(
            metadata: metadata,
            sha256: digest,
            localMediaRef: destination.path
        )
    }

    func cancel(_ payload: [String: Any]) throws {
        let id = try requiredString(payload, "attachmentId")
        let metadata = try readMetadata(id: id)
        let workspaceId = try requiredString(payload, "workspaceId")
        let threadId = try requiredString(payload, "threadId")
        guard metadata.workspaceId == workspaceId,
              metadata.threadId == threadId
        else {
            throw RelayError(.permissionDenied, "Attachment upload belongs to another conversation.")
        }
        try FileManager.default.removeItem(at: directoryURL(id: id))
    }

    func readableImagePath(
        localMediaRef: String,
        mimeType: String,
        bridgeDeviceId: String?,
        expectedBridgeDeviceId: String
    ) -> String? {
        guard mimeType.lowercased().hasPrefix("image/"),
              bridgeDeviceId == expectedBridgeDeviceId
        else { return nil }
        let candidate = URL(fileURLWithPath: localMediaRef).standardizedFileURL
        let rootPath = rootURL.path.hasSuffix("/") ? rootURL.path : rootURL.path + "/"
        guard candidate.path.hasPrefix(rootPath),
              FileManager.default.fileExists(atPath: candidate.path)
        else { return nil }
        return candidate.path
    }

    private func directoryURL(id: String) -> URL {
        rootURL.appendingPathComponent(id, isDirectory: true)
    }

    private func metadataURL(id: String) -> URL {
        directoryURL(id: id).appendingPathComponent("metadata.json")
    }

    private func uploadURL(id: String) -> URL {
        directoryURL(id: id).appendingPathComponent("content.upload")
    }

    private func completedURL(metadata: CloudAttachmentMetadata) -> URL {
        directoryURL(id: metadata.id).appendingPathComponent(metadata.filename)
    }

    private func writeMetadata(_ metadata: CloudAttachmentMetadata) throws {
        let data = try JSONEncoder().encode(metadata)
        try data.write(to: metadataURL(id: metadata.id), options: .atomic)
    }

    private func readMetadata(id: String) throws -> CloudAttachmentMetadata {
        guard UUID(uuidString: id) != nil else {
            throw RelayError(.invalidInput, "Attachment id is invalid.")
        }
        return try JSONDecoder().decode(
            CloudAttachmentMetadata.self,
            from: Data(contentsOf: metadataURL(id: id))
        )
    }

    private func safeFilename(_ value: String) throws -> String {
        let filename = URL(fileURLWithPath: value).lastPathComponent
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !filename.isEmpty,
              filename != ".",
              filename != "..",
              filename.utf8.count <= 255,
              !filename.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) })
        else {
            throw RelayError(.invalidInput, "Attachment filename is invalid.")
        }
        return filename
    }

    private func requiredString(_ payload: [String: Any], _ key: String) throws -> String {
        guard let value = payload[key] as? String,
              !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw RelayError(.invalidInput, "Attachment \(key) is required.")
        }
        return value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func requiredInt(_ payload: [String: Any], _ key: String) throws -> Int {
        if let value = payload[key] as? Int {
            return value
        }
        if let value = payload[key] as? NSNumber {
            return value.intValue
        }
        throw RelayError(.invalidInput, "Attachment \(key) is required.")
    }
}
