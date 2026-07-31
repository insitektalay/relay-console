import { normalizeLibraryFolderPath } from "@/components/agents/openclaw-library-paths"
import type { useOpenClawLibraryPhase6 } from "@/components/agents/openclaw-library-card"

function folderKey(root: string, folder: string = "") {
  return `${root}:${normalizeLibraryFolderPath(folder)}`
}

export function useOpenClawLibraryPhase7(
  context: ReturnType<typeof useOpenClawLibraryPhase6>
) {
  function linkSelectedKnowledgeFile() {
    if (!context.selectedLinkedLocalFile) return
    if (context.selectedLinkedLocalFile.root === "library") {
      void context.performLinkLocalFile(
        {
          root: "library",
          folder: context.selectedLinkedLocalFile.folder,
          filename: context.selectedLinkedLocalFile.filename,
        },
        { syncAfterPick: false }
      )
      return
    }
    void context.performLinkLocalFile(
      {
        root: context.selectedLinkedLocalFile.root,
        agentId: context.selectedLinkedLocalFile.agentId,
        folder: context.selectedLinkedLocalFile.folder,
        filename: context.selectedLinkedLocalFile.filename,
      },
      { syncAfterPick: false }
    )
  }

  const knowledgeRootStates = context.workspaceRoots.map(
    (root) => context.folderStates[folderKey(root.id, "")]
  )
  const hasUndiscoveredKnowledgeFolders =
    context.knowledgeSection === "instructions" ||
    context.knowledgeSection === "memory" ||
    context.knowledgeSection === "skills"
      ? context.workspaceRoots.some((root) =>
          context.knowledgeSection === "instructions" &&
          (root.id === "library" || root.id === "sessions")
            ? false
            : Object.entries(context.folderStates)
                .filter(
                  ([key, state]) => key.startsWith(`${root.id}:`) && state.data
                )
                .some(([, state]) => {
                  const data = state.data!
                  return (
                    context.canDescendIntoKnowledgeFolder(data.folder) &&
                    data.folders.some((folder) => {
                      const path = normalizeLibraryFolderPath(folder.path)
                      return (
                        context.shouldDiscoverKnowledgeFolder(path) &&
                        !context.folderStates[folderKey(root.id, path)]
                      )
                    })
                  )
                })
        )
      : false
  const knowledgeDiscoveryLoading =
    Boolean(context.knowledgeSection) &&
    (knowledgeRootStates.some((state) => !state) ||
      Object.values(context.folderStates).some((state) => state.loading) ||
      hasUndiscoveredKnowledgeFolders)
  const knowledgeDiscoveryError = Object.values(context.folderStates).find(
    (state) => state.error && !state.loading
  )?.error

  function retryKnowledgeDiscovery() {
    context.setFolderStates({})
    for (const root of context.workspaceRoots) {
      if (root.id === "library" || context.agentId) {
        void context.loadFolder(root.id, "")
      }
    }
  }
  return {
    activeKnowledgeItem: context.activeKnowledgeItem,
    agentAvatarUrl: context.agentAvatarUrl,
    agentGroupLabel: context.agentGroupLabel,
    agentId: context.agentId,
    agentLabel: context.agentLabel,
    applyBaseline: context.applyBaseline,
    baselineDraftContent: context.baselineDraftContent,
    baselineDraftName: context.baselineDraftName,
    cancelEditBaseline: context.cancelEditBaseline,
    canonicalBaselines: context.canonicalBaselines,
    confirmDeleteTarget: context.confirmDeleteTarget,
    confirmLinkedLocalLinkDialog: context.confirmLinkedLocalLinkDialog,
    createFolderMutation: context.createFolderMutation,
    deleteBaseline: context.deleteBaseline,
    deleteFileMutation: context.deleteFileMutation,
    deleteFolderMutation: context.deleteFolderMutation,
    dropdownKnowledgeItems: context.dropdownKnowledgeItems,
    editingBaselineId: context.editingBaselineId,
    editorContent: context.editorContent,
    editorDirty: context.editorDirty,
    editorFilename: context.editorFilename,
    expandedFolders: context.expandedFolders,
    folderDraft: context.folderDraft,
    folderKey,
    folderStates: context.folderStates,
    formatFileLocation: context.formatFileLocation,
    formatLocationLabel: context.formatLocationLabel,
    handlePngUpload: context.handlePngUpload,
    handleSelectedFileSyncAction: context.handleSelectedFileSyncAction,
    handleSelectedFileSyncToLocalAction:
      context.handleSelectedFileSyncToLocalAction,
    handleSelectedFolderSyncAction: context.handleSelectedFolderSyncAction,
    handleSelectedFolderSyncToLocalAction:
      context.handleSelectedFolderSyncToLocalAction,
    handleUpload: context.handleUpload,
    isHermesWorkspace: context.isHermesWorkspace,
    isLinkingSelectedTarget: context.isLinkingSelectedTarget,
    isOpen: context.isOpen,
    isSyncingSelectedTarget: context.isSyncingSelectedTarget,
    knowledgeDiscoveryError,
    knowledgeDiscoveryLoading,
    knowledgeEditing: context.knowledgeEditing,
    knowledgeFolderCreating: context.knowledgeFolderCreating,
    knowledgeSection: context.knowledgeSection,
    knowledgeSelectorCollapsed: context.knowledgeSelectorCollapsed,
    libraryOnly: context.libraryOnly,
    linkSelectedKnowledgeFile,
    linkedLocalLinkDialog: context.linkedLocalLinkDialog,
    linkingTargetKey: context.linkingTargetKey,
    onOpenChat: context.onOpenChat,
    openKnowledgeItem: context.openKnowledgeItem,
    pngUploadInputRef: context.pngUploadInputRef,
    renderTreeBranch: context.renderTreeBranch,
    retryKnowledgeDiscovery,
    saveBaseline: context.saveBaseline,
    saveFileMutation: context.saveFileMutation,
    selectFolder: context.selectFolder,
    selectedBaselineId: context.selectedBaselineId,
    selectedFile: context.selectedFile,
    selectedFileQuery: context.selectedFileQuery,
    selectedFolderContext: context.selectedFolderContext,
    selectedLinkedLocalFile: context.selectedLinkedLocalFile,
    selectedLinkedLocalFolder: context.selectedLinkedLocalFolder,
    selectedLinkedLocalMeta: context.selectedLinkedLocalMeta,
    selectedLinkedLocalStatus: context.selectedLinkedLocalStatus,
    selectedLinkedLocalSummary: context.selectedLinkedLocalSummary,
    selectedLinkedLocalSupport: context.selectedLinkedLocalSupport,
    selectedNode: context.selectedNode,
    setBaselineDraftContent: context.setBaselineDraftContent,
    setBaselineDraftName: context.setBaselineDraftName,
    setConfirmDeleteTarget: context.setConfirmDeleteTarget,
    setEditorContent: context.setEditorContent,
    setEditorDirty: context.setEditorDirty,
    setEditorFilename: context.setEditorFilename,
    setFolderDraft: context.setFolderDraft,
    setKnowledgeEditing: context.setKnowledgeEditing,
    setKnowledgeFolderCreating: context.setKnowledgeFolderCreating,
    setKnowledgeSelectorCollapsed: context.setKnowledgeSelectorCollapsed,
    setLinkedLocalLinkDialog: context.setLinkedLocalLinkDialog,
    setSelectedBaselineId: context.setSelectedBaselineId,
    setShowBaselineManager: context.setShowBaselineManager,
    showBaselineManager: context.showBaselineManager,
    startEditBaseline: context.startEditBaseline,
    startKnowledgeMarkdown: context.startKnowledgeMarkdown,
    startNewMarkdown: context.startNewMarkdown,
    toggleFolder: context.toggleFolder,
    uploadInputRef: context.uploadInputRef,
    workspaceId: context.workspaceId,
    workspaceRoots: context.workspaceRoots,
  }
}
