// AgentFileEditorView.swift
// ClawChat – Markdown file editor for agent library

import SwiftUI

struct AgentFileEditorView: View {
    let file: AgentLibraryFile
    let vm: AgentLibraryViewModel
    @State private var editedContent: String
    @State private var isSaving = false
    @Environment(\.dismiss) private var dismiss

    init(file: AgentLibraryFile, vm: AgentLibraryViewModel) {
        self.file = file
        self.vm = vm
        self._editedContent = State(initialValue: file.content)
    }

    var hasChanges: Bool { editedContent != file.content }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()
                TextEditor(text: $editedContent)
                    .font(.system(.body, design: .monospaced))
                    .foregroundStyle(ClawColors.textPrimary)
                    .scrollContentBackground(.hidden)
                    .background(ClawColors.backgroundPrimary)
                    .padding(.horizontal, 12)
            }
            .navigationTitle(file.filename)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ClawColors.accent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        _Concurrency.Task {
                            isSaving = true
                            await vm.updateFile(file, content: editedContent)
                            isSaving = false
                            dismiss()
                        }
                    } label: {
                        if isSaving {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: ClawColors.accent))
                                .scaleEffect(0.8)
                        } else {
                            Text("Save")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(hasChanges ? ClawColors.accent : ClawColors.textTertiary)
                        }
                    }
                    .disabled(!hasChanges || isSaving)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationBackground(ClawColors.backgroundPrimary)
    }
}
