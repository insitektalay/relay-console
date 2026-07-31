// AgentLibraryViewModel.swift
// ClawChat – Agent library file management

import Foundation
import Observation

@MainActor
@Observable
final class AgentLibraryViewModel {
    var files: [AgentLibraryFile] = []
    var isLoading = false
    var isUploading = false
    var error: String?

    func load(agentId: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: PaginatedResponse<AgentLibraryFile> = try await APIClient.shared.requestPaginated(
                .agentLibraryFiles(agentId: agentId)
            )
            files = response.data
        } catch {
            self.error = error.localizedDescription
        }
    }

    func updateFile(_ file: AgentLibraryFile, content: String) async {
        do {
            let updated: AgentLibraryFile = try await APIClient.shared.request(
                .updateAgentLibraryFile(agentId: file.agentId, fileId: file.id, content: content)
            )
            if let idx = files.firstIndex(where: { $0.id == file.id }) {
                files[idx] = updated
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteFile(_ file: AgentLibraryFile) async {
        files.removeAll { $0.id == file.id }
        do {
            let _: [String: String] = try await APIClient.shared.request(
                .deleteAgentLibraryFile(agentId: file.agentId, fileId: file.id)
            )
        } catch {
            files.insert(file, at: 0)
            self.error = error.localizedDescription
        }
    }

    func uploadFile(agentId: String, data: Data, filename: String) async {
        isUploading = true
        defer { isUploading = false }
        do {
            // Use multipart upload; backend returns a URL string on success.
            // After upload completes, reload the file list to pick up the new record.
            _ = try await APIClient.shared.upload(
                data: data,
                filename: filename,
                mimeType: "text/markdown",
                endpoint: .uploadAgentLibraryFile(agentId: agentId)
            )
            await load(agentId: agentId)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
