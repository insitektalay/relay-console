// AgentLibraryView.swift
// ClawChat – Manage OpenClaw agent library files

import SwiftUI

struct AgentLibraryView: View {
    let agentId: String
    let agentName: String
    @State private var vm = AgentLibraryViewModel()
    @State private var editingFile: AgentLibraryFile?
    @State private var pendingDelete: AgentLibraryFile?
    @State private var showDocumentPicker = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            ClawColors.backgroundPrimary.ignoresSafeArea()

            Group {
                if vm.isLoading {
                    RelayLoadingState(message: "Loading agent memory")
                } else if let error = vm.error, vm.files.isEmpty {
                    VStack(spacing: RelaySpacing.md) {
                        RelayErrorPanel(message: error)
                        Button("Try Again") { _Concurrency.Task { await vm.load(agentId: agentId) } }
                            .buttonStyle(RelayButtonStyle(size: .sm, variant: .secondary))
                    }
                    .padding(RelaySpacing.lg)
                } else if vm.files.isEmpty {
                    emptyView
                } else {
                    fileList
                }
            }
        }
        .navigationTitle("Library Files")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showDocumentPicker = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .sheet(item: $editingFile) { file in
            AgentFileEditorView(file: file, vm: vm)
        }
        .confirmationDialog(
            "Delete \(pendingDelete?.filename ?? "file")?",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete file", role: .destructive) {
                guard let file = pendingDelete else { return }
                pendingDelete = nil
                _Concurrency.Task { await vm.deleteFile(file) }
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: {
            Text("This permanently deletes the managed Relay memory file. This cannot be undone.")
        }
        .fileImporter(
            isPresented: $showDocumentPicker,
            allowedContentTypes: [.text, .plainText],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                let accessing = url.startAccessingSecurityScopedResource()
                defer { if accessing { url.stopAccessingSecurityScopedResource() } }
                if let data = try? Data(contentsOf: url) {
                    _Concurrency.Task {
                        await vm.uploadFile(agentId: agentId, data: data, filename: url.lastPathComponent)
                    }
                }
            case .failure:
                break
            }
        }
        .task { await vm.load(agentId: agentId) }
    }

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text")
                .font(.system(size: 44))
                .foregroundStyle(ClawColors.textTertiary)
            Text("No Library Files")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)
            Text("Upload markdown files to configure this agent's knowledge base.")
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Upload File") { showDocumentPicker = true }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 32)
                .padding(.vertical, 12)
                .background(ClawColors.accent)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var fileList: some View {
        List {
            ForEach(vm.files) { file in
                Button { editingFile = file } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "doc.text.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(Color(hex: "#40C8E0"))
                            .frame(width: 36)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(file.filename)
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(ClawColors.textPrimary)
                            Text("\(formatBytes(file.sizeBytes)) · Updated \(file.updatedAt.relativeTime)")
                                .font(.system(size: 12))
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
                .listRowBackground(ClawColors.backgroundCard)
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        pendingDelete = file
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private func formatBytes(_ bytes: Int) -> String {
        let kb = Double(bytes) / 1024
        if kb < 1 { return "\(bytes) B" }
        if kb < 1024 { return String(format: "%.1f KB", kb) }
        return String(format: "%.1f MB", kb / 1024)
    }
}
