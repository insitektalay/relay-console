// TeamMemoryView.swift
// ClawChat – Team knowledge base / memory

import SwiftUI

// MARK: - ViewModel

@Observable
@MainActor
final class TeamMemoryViewState {
    var teamId: String
    var items: [TeamMemoryItem] = []
    var searchText: String = ""
    var selectedFilter: MemoryItemType? = nil
    var isLoading = false
    var error: String?

    var filteredItems: [TeamMemoryItem] {
        var result = items

        if let filter = selectedFilter {
            result = result.filter { $0.type == filter }
        }

        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter {
                $0.title.lowercased().contains(query) ||
                $0.content.lowercased().contains(query) ||
                $0.tags.contains { $0.lowercased().contains(query) }
            }
        }

        return result
    }

    init(teamId: String) {
        self.teamId = teamId
    }

    @MainActor
    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let response: PaginatedResponse<TeamMemoryItem> = try await APIClient.shared.requestPaginated(
                .teamMemory(teamId: teamId, page: 1)
            )
            items = response.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            items = []
        }
    }

    func addItem(_ item: TeamMemoryItem) {
        items.insert(item, at: 0)
        _Concurrency.Task { [weak self] in
            guard let self else { return }
            do {
                let created: TeamMemoryItem = try await APIClient.shared.request(
                    .addTeamMemory(teamId: teamId, title: item.title, content: item.content, type: item.type.rawValue)
                )
                await MainActor.run {
                    if let idx = self.items.firstIndex(where: { $0.id == item.id }) {
                        self.items[idx] = created
                    }
                }
            } catch {
                await MainActor.run {
                    self.items.removeAll { $0.id == item.id }
                    self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
                }
            }
        }
    }

    func updateItem(_ item: TeamMemoryItem) {
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index] = item
        }
    }

    func deleteItem(id: String) {
        items.removeAll { $0.id == id }
    }
}

// MARK: - Main View

struct TeamMemoryView: View {
    @State var viewModel: TeamMemoryViewState
    @State private var showAddSheet = false
    @State private var selectedItem: TeamMemoryItem?

    init(teamId: String) {
        _viewModel = State(initialValue: TeamMemoryViewState(teamId: teamId))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                searchBar
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.top, ClawSpacing.md)
                    .padding(.bottom, ClawSpacing.sm)

                // Filter chips
                filterChips
                    .padding(.bottom, ClawSpacing.md)

                Divider().background(ClawColors.separator)

                // Items list
                if viewModel.isLoading {
                    loadingView
                } else if let error = viewModel.error {
                    VStack(spacing: RelaySpacing.md) {
                        RelayErrorPanel(message: error)
                        Button("Try Again") { _Concurrency.Task { await viewModel.load() } }
                            .buttonStyle(RelayButtonStyle(size: .sm, variant: .secondary))
                    }
                    .padding(RelaySpacing.lg)
                } else if viewModel.filteredItems.isEmpty {
                    emptyView
                } else {
                    itemsList
                }
            }
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Team Memory")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                            .foregroundStyle(ClawColors.accent)
                    }
                }
            }
            .task { await viewModel.load() }
            .sheet(isPresented: $showAddSheet) {
                AddMemoryItemSheet(teamId: viewModel.teamId) { newItem in
                    viewModel.addItem(newItem)
                }
            }
            .sheet(item: $selectedItem) { item in
                MemoryItemDetailView(item: item)
            }
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: ClawSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.textTertiary)
            TextField("Search memory...", text: $viewModel.searchText)
                .font(ClawFonts.cardTitle)
                .foregroundStyle(ClawColors.textPrimary)
                .autocorrectionDisabled()
            if !viewModel.searchText.isEmpty {
                Button {
                    viewModel.searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(ClawColors.textTertiary)
                }
            }
        }
        .padding(.horizontal, ClawSpacing.md)
        .padding(.vertical, ClawSpacing.sm)
        .background(ClawColors.backgroundTertiary)
        .cornerRadius(ClawRadius.md)
    }

    // MARK: - Filter Chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ClawSpacing.sm) {
                filterChip(label: "All", type: nil)
                filterChip(label: "Rules", type: .rule)
                filterChip(label: "SOPs", type: .sop)
                filterChip(label: "Context", type: .context)
                filterChip(label: "Documents", type: .document)
                filterChip(label: "Notes", type: .note)
            }
            .padding(.horizontal, ClawSpacing.lg)
        }
    }

    private func filterChip(label: String, type: MemoryItemType?) -> some View {
        let isSelected = viewModel.selectedFilter == type
        let color = type.map { memoryTypeColor($0) } ?? ClawColors.accent

        return Button {
            viewModel.selectedFilter = isSelected ? nil : type
        } label: {
            HStack(spacing: ClawSpacing.xs) {
                if let type {
                    Image(systemName: memoryTypeIcon(type))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(isSelected ? .white : color)
                }
                Text(label)
                    .font(ClawFonts.label)
                    .foregroundStyle(isSelected ? .white : color)
            }
            .padding(.horizontal, ClawSpacing.md)
            .padding(.vertical, ClawSpacing.sm)
            .background(isSelected ? color : color.opacity(0.15))
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(isSelected ? Color.clear : color.opacity(0.3), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Items List

    private var itemsList: some View {
        ScrollView {
            LazyVStack(spacing: ClawSpacing.xs) {
                ForEach(viewModel.filteredItems) { item in
                    MemoryItemRow(item: item) {
                        selectedItem = item
                    }
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.vertical, ClawSpacing.md)
        }
    }

    // MARK: - Loading / Empty

    private var loadingView: some View {
        VStack(spacing: ClawSpacing.md) {
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: ClawRadius.md)
                    .fill(ClawColors.backgroundCard)
                    .frame(height: 80)
                    .shimmer()
            }
        }
        .padding(ClawSpacing.lg)
    }

    private var emptyView: some View {
        VStack(spacing: ClawSpacing.lg) {
            Spacer()
            Image(systemName: "brain.fill")
                .font(.system(size: 48))
                .foregroundStyle(ClawColors.textTertiary)
            Text(viewModel.searchText.isEmpty && viewModel.selectedFilter == nil
                 ? "No memory items yet"
                 : "No results found")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(ClawColors.textSecondary)
            if viewModel.searchText.isEmpty && viewModel.selectedFilter == nil {
                Text("Tap + to add rules, SOPs, context, or notes for your team.")
                    .font(ClawFonts.cardBody)
                    .foregroundStyle(ClawColors.textTertiary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, ClawSpacing.xxxl)
            }
            Spacer()
        }
    }
}

// MARK: - Memory Item Row

struct MemoryItemRow: View {
    let item: TeamMemoryItem
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: ClawSpacing.md) {
                // Type icon
                ZStack {
                    RoundedRectangle(cornerRadius: ClawRadius.sm)
                        .fill(memoryTypeColor(item.type).opacity(0.15))
                        .frame(width: 36, height: 36)
                    Image(systemName: memoryTypeIcon(item.type))
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(memoryTypeColor(item.type))
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .top) {
                        Text(item.title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        Text(item.type.displayName)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(memoryTypeColor(item.type))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(memoryTypeColor(item.type).opacity(0.15))
                            .clipShape(Capsule())
                    }

                    Text(item.content)
                        .font(ClawFonts.cardBody)
                        .foregroundStyle(ClawColors.textSecondary)
                        .lineLimit(2)

                    HStack(spacing: ClawSpacing.xs) {
                        ForEach(item.tags.prefix(3), id: \.self) { tag in
                            Text("#\(tag)")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(ClawColors.textTertiary)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(ClawColors.backgroundTertiary)
                                .clipShape(Capsule())
                        }
                        if item.tags.count > 3 {
                            Text("+\(item.tags.count - 3)")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                        Spacer()
                        Text(item.updatedAt.chatTimestamp)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
            .padding(ClawSpacing.md)
            .background(ClawColors.backgroundCard)
            .cornerRadius(ClawRadius.md)
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.md)
                    .stroke(ClawColors.separator, lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Memory Item Detail View

struct MemoryItemDetailView: View {
    let item: TeamMemoryItem
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: ClawSpacing.xl) {
                    // Type badge + title
                    VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                        HStack(spacing: ClawSpacing.sm) {
                            Image(systemName: memoryTypeIcon(item.type))
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(memoryTypeColor(item.type))
                            Text(item.type.displayName)
                                .font(ClawFonts.label)
                                .foregroundStyle(memoryTypeColor(item.type))
                        }
                        .padding(.horizontal, ClawSpacing.sm)
                        .padding(.vertical, ClawSpacing.xs)
                        .background(memoryTypeColor(item.type).opacity(0.15))
                        .clipShape(Capsule())

                        Text(item.title)
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(ClawColors.textPrimary)
                    }

                    // Content
                    Text(item.content)
                        .font(.system(size: 15))
                        .foregroundStyle(ClawColors.textPrimary)
                        .lineSpacing(4)

                    // Tags
                    if !item.tags.isEmpty {
                        VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                            Text("TAGS")
                                .font(ClawFonts.sectionHeader)
                                .foregroundStyle(ClawColors.textTertiary)
                            FlowLayout(spacing: ClawSpacing.xs) {
                                ForEach(item.tags, id: \.self) { tag in
                                    Text("#\(tag)")
                                        .font(ClawFonts.label)
                                        .foregroundStyle(ClawColors.accent)
                                        .padding(.horizontal, ClawSpacing.sm)
                                        .padding(.vertical, ClawSpacing.xs)
                                        .background(ClawColors.accent.opacity(0.15))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }

                    Divider().background(ClawColors.separator)

                    // Meta
                    VStack(alignment: .leading, spacing: ClawSpacing.xs) {
                        metaRow(label: "Created", value: item.createdAt.fullTimestamp)
                        metaRow(label: "Last Updated", value: item.updatedAt.fullTimestamp)
                        metaRow(label: "Author", value: item.createdById)
                    }

                    RelayStatusStrip(
                        title: "Editing unavailable",
                        detail: "The Relay service currently supports listing and creating team memory, but not editing or deleting it. This item is read-only on iPhone.",
                        tone: .neutral,
                        icon: "lock.fill"
                    )
                }
                .padding(ClawSpacing.lg)
            }
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Memory Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func metaRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(ClawFonts.caption)
                .foregroundStyle(ClawColors.textTertiary)
                .frame(width: 100, alignment: .leading)
            Text(value)
                .font(ClawFonts.caption)
                .foregroundStyle(ClawColors.textSecondary)
        }
    }
}

// MARK: - Add Memory Item Sheet

struct AddMemoryItemSheet: View {
    let teamId: String
    let onSave: (TeamMemoryItem) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var content = ""
    @State private var selectedType: MemoryItemType = .note
    @State private var tagsText = ""

    private var isValid: Bool { !title.trimmingCharacters(in: .whitespaces).isEmpty && !content.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Title", text: $title)
                        .listRowBackground(ClawColors.backgroundCard)
                        .foregroundStyle(ClawColors.textPrimary)

                    Picker("Type", selection: $selectedType) {
                        ForEach(MemoryItemType.allCases, id: \.self) { type in
                            Label(type.displayName, systemImage: memoryTypeIcon(type))
                                .tag(type)
                        }
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                    .foregroundStyle(ClawColors.textPrimary)
                    .tint(ClawColors.accent)
                }

                Section("Content") {
                    TextEditor(text: $content)
                        .frame(minHeight: 120)
                        .listRowBackground(ClawColors.backgroundCard)
                        .foregroundStyle(ClawColors.textPrimary)
                }

                Section("Tags (comma separated)") {
                    TextField("e.g. finance, invoices, batch", text: $tagsText)
                        .listRowBackground(ClawColors.backgroundCard)
                        .foregroundStyle(ClawColors.textPrimary)
                        .autocorrectionDisabled()
                }
            }
            .scrollContentBackground(.hidden)
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Add Memory Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let tags = tagsText
                            .split(separator: ",")
                            .map { $0.trimmingCharacters(in: .whitespaces) }
                            .filter { !$0.isEmpty }
                        let now = Date()
                        let item = TeamMemoryItem(
                            id: UUID().uuidString,
                            teamId: teamId,
                            title: title.trimmingCharacters(in: .whitespaces),
                            content: content.trimmingCharacters(in: .whitespaces),
                            type: selectedType,
                            tags: tags,
                            createdAt: now,
                            updatedAt: now,
                            createdById: "currentUser"
                        )
                        onSave(item)
                        dismiss()
                    }
                    .disabled(!isValid)
                    .fontWeight(.semibold)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Edit Memory Item Sheet

struct EditMemoryItemSheet: View {
    let item: TeamMemoryItem
    let onSave: (TeamMemoryItem) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var content: String
    @State private var selectedType: MemoryItemType
    @State private var tagsText: String

    init(item: TeamMemoryItem, onSave: @escaping (TeamMemoryItem) -> Void) {
        self.item = item
        self.onSave = onSave
        _title = State(initialValue: item.title)
        _content = State(initialValue: item.content)
        _selectedType = State(initialValue: item.type)
        _tagsText = State(initialValue: item.tags.joined(separator: ", "))
    }

    private var isValid: Bool { !title.trimmingCharacters(in: .whitespaces).isEmpty && !content.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Title", text: $title)
                        .listRowBackground(ClawColors.backgroundCard)
                        .foregroundStyle(ClawColors.textPrimary)

                    Picker("Type", selection: $selectedType) {
                        ForEach(MemoryItemType.allCases, id: \.self) { type in
                            Label(type.displayName, systemImage: memoryTypeIcon(type))
                                .tag(type)
                        }
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                    .foregroundStyle(ClawColors.textPrimary)
                    .tint(ClawColors.accent)
                }

                Section("Content") {
                    TextEditor(text: $content)
                        .frame(minHeight: 120)
                        .listRowBackground(ClawColors.backgroundCard)
                        .foregroundStyle(ClawColors.textPrimary)
                }

                Section("Tags (comma separated)") {
                    TextField("e.g. finance, invoices", text: $tagsText)
                        .listRowBackground(ClawColors.backgroundCard)
                        .foregroundStyle(ClawColors.textPrimary)
                        .autocorrectionDisabled()
                }
            }
            .scrollContentBackground(.hidden)
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Edit Memory Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let tags = tagsText
                            .split(separator: ",")
                            .map { $0.trimmingCharacters(in: .whitespaces) }
                            .filter { !$0.isEmpty }
                        var updated = item
                        updated.title = title.trimmingCharacters(in: .whitespaces)
                        updated.content = content.trimmingCharacters(in: .whitespaces)
                        updated.type = selectedType
                        updated.tags = tags
                        updated.updatedAt = Date()
                        onSave(updated)
                        dismiss()
                    }
                    .disabled(!isValid)
                    .fontWeight(.semibold)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Flow Layout (for tags)

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > maxWidth && currentX > 0 {
                currentX = 0
                currentY += rowHeight + spacing
                rowHeight = 0
            }
            currentX += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: maxWidth, height: currentY + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var currentX = bounds.minX
        var currentY = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > bounds.maxX && currentX > bounds.minX {
                currentX = bounds.minX
                currentY += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: currentX, y: currentY), proposal: ProposedViewSize(size))
            currentX += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Helpers

func memoryTypeIcon(_ type: MemoryItemType) -> String {
    switch type {
    case .rule:     return "exclamationmark.shield.fill"
    case .sop:      return "list.bullet.clipboard.fill"
    case .context:  return "info.circle.fill"
    case .document: return "doc.fill"
    case .note:     return "note.text"
    }
}

func memoryTypeColor(_ type: MemoryItemType) -> Color {
    switch type {
    case .rule:     return ClawColors.accentRed
    case .sop:      return ClawColors.accentOrange
    case .context:  return ClawColors.accent
    case .document: return ClawColors.accentPurple
    case .note:     return ClawColors.accentGreen
    }
}

extension MemoryItemType {
    var displayName: String {
        switch self {
        case .rule:     return "Rule"
        case .sop:      return "SOP"
        case .context:  return "Context"
        case .document: return "Document"
        case .note:     return "Note"
        }
    }
}

extension MemoryItemType: CaseIterable {
    static var allCases: [MemoryItemType] { [.rule, .sop, .context, .document, .note] }
}

// MARK: - Preview

#Preview {
    TeamMemoryView(teamId: "team1")
        .preferredColorScheme(.dark)
}
