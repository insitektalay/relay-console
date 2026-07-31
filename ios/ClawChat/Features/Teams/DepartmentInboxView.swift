// DepartmentInboxView.swift
// ClawChat – Department inbox for updates, alerts, and reports

import SwiftUI

// MARK: - Models

struct InboxMessage: Identifiable {
    let id: String
    var type: InboxMessageType
    var title: String
    var body: String
    var source: String
    var isRead: Bool
    var timestamp: Date
    var referenceId: String?
}

enum InboxMessageType: String, CaseIterable {
    case alert = "Alert"
    case report = "Report"
    case approval = "Approval"
    case incident = "Incident"
    case system = "System"
}

// MARK: - ViewModel

@Observable
final class DepartmentInboxViewModel {
    var departmentId: String
    var messages: [InboxMessage] = []
    var isLoading = false
    var error: String?

    var unreadCount: Int { messages.filter { !$0.isRead }.count }

    var todayMessages: [InboxMessage] {
        messages.filter { Calendar.current.isDateInToday($0.timestamp) }
    }

    var thisWeekMessages: [InboxMessage] {
        messages.filter {
            !Calendar.current.isDateInToday($0.timestamp) &&
            Calendar.current.isDate($0.timestamp, equalTo: Date(), toGranularity: .weekOfYear)
        }
    }

    var olderMessages: [InboxMessage] {
        messages.filter {
            !Calendar.current.isDate($0.timestamp, equalTo: Date(), toGranularity: .weekOfYear)
        }
    }

    init(departmentId: String) {
        self.departmentId = departmentId
    }

    @MainActor
    func load() async {
        isLoading = true
        defer { isLoading = false }
        messages = []
        error = "Department inbox is not available in this release. No sample messages are shown as live data."
    }

    func markAllRead() {
        for i in messages.indices {
            messages[i].isRead = true
        }
    }

    func markRead(id: String) {
        if let i = messages.firstIndex(where: { $0.id == id }) {
            messages[i].isRead = true
        }
    }
}

// MARK: - Main View

struct DepartmentInboxView: View {
    @State var viewModel: DepartmentInboxViewModel
    @State private var selectedMessage: InboxMessage?
    @State private var selectedTypeFilter: InboxMessageType? = nil

    init(departmentId: String) {
        _viewModel = State(initialValue: DepartmentInboxViewModel(departmentId: departmentId))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Filter chips
            filterChips
                .padding(.vertical, ClawSpacing.md)

            Divider().background(ClawColors.separator)

            if viewModel.isLoading {
                loadingView
            } else if let error = viewModel.error {
                unavailableView(error)
            } else {
                messageList
            }
        }
        .background(ClawColors.backgroundPrimary)
        .navigationTitle("Department Inbox")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if viewModel.unreadCount > 0 {
                    Button("Mark All Read") {
                        withAnimation { viewModel.markAllRead() }
                    }
                    .font(ClawFonts.label)
                    .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .task { await viewModel.load() }
        .sheet(item: $selectedMessage) { message in
            InboxMessageDetailView(message: message)
        }
    }

    // MARK: - Filter Chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ClawSpacing.sm) {
                allChip
                ForEach(InboxMessageType.allCases, id: \.self) { type in
                    typeFilterChip(type: type)
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
        }
    }

    private var allChip: some View {
        let isSelected = selectedTypeFilter == nil
        return Button {
            selectedTypeFilter = nil
        } label: {
            Text("All")
                .font(ClawFonts.label)
                .foregroundStyle(isSelected ? .white : ClawColors.textSecondary)
                .padding(.horizontal, ClawSpacing.md)
                .padding(.vertical, ClawSpacing.sm)
                .background(isSelected ? ClawColors.accent : ClawColors.backgroundTertiary)
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(isSelected ? Color.clear : ClawColors.separator, lineWidth: 0.5)
                )
        }
        .buttonStyle(.plain)
    }

    private func typeFilterChip(type: InboxMessageType) -> some View {
        let isSelected = selectedTypeFilter == type
        let color = inboxTypeColor(type)
        let count = filteredMessages(for: type).count

        return Button {
            selectedTypeFilter = isSelected ? nil : type
        } label: {
            HStack(spacing: ClawSpacing.xs) {
                Image(systemName: inboxTypeIcon(type))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isSelected ? .white : color)
                Text(type.rawValue)
                    .font(ClawFonts.label)
                    .foregroundStyle(isSelected ? .white : color)
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(isSelected ? color : .white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(isSelected ? Color.white : color)
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, ClawSpacing.md)
            .padding(.vertical, ClawSpacing.sm)
            .background(isSelected ? color : color.opacity(0.12))
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(isSelected ? Color.clear : color.opacity(0.3), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }

    private func filteredMessages(for type: InboxMessageType) -> [InboxMessage] {
        viewModel.messages.filter { $0.type == type && !$0.isRead }
    }

    // MARK: - Messages List

    private var messageList: some View {
        let filtered: [InboxMessage] = viewModel.messages.filter { msg in
            selectedTypeFilter == nil || msg.type == selectedTypeFilter
        }

        let today = filtered.filter { Calendar.current.isDateInToday($0.timestamp) }
        let thisWeek = filtered.filter {
            !Calendar.current.isDateInToday($0.timestamp) &&
            Calendar.current.isDate($0.timestamp, equalTo: Date(), toGranularity: .weekOfYear)
        }
        let older = filtered.filter {
            !Calendar.current.isDate($0.timestamp, equalTo: Date(), toGranularity: .weekOfYear)
        }

        return Group {
            if filtered.isEmpty {
                emptyView
            } else {
                ScrollView {
                    LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                        if !today.isEmpty {
                            inboxSection(title: "Today", messages: today)
                        }
                        if !thisWeek.isEmpty {
                            inboxSection(title: "This Week", messages: thisWeek)
                        }
                        if !older.isEmpty {
                            inboxSection(title: "Earlier", messages: older)
                        }
                    }
                    .padding(.bottom, ClawSpacing.xxxl)
                }
            }
        }
    }

    @ViewBuilder
    private func inboxSection(title: String, messages: [InboxMessage]) -> some View {
        Section {
            VStack(spacing: ClawSpacing.xs) {
                ForEach(messages) { message in
                    InboxMessageRow(message: message) {
                        viewModel.markRead(id: message.id)
                        selectedMessage = message
                    }
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.bottom, ClawSpacing.md)
        } header: {
            HStack {
                Text(title.uppercased())
                    .font(ClawFonts.sectionHeader)
                    .foregroundStyle(ClawColors.textTertiary)
                Spacer()
            }
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.vertical, ClawSpacing.sm)
            .background(ClawColors.backgroundPrimary)
        }
    }

    // MARK: - Empty / Loading

    private var emptyView: some View {
        VStack(spacing: ClawSpacing.lg) {
            Spacer()
            Image(systemName: "tray")
                .font(.system(size: 48))
                .foregroundStyle(ClawColors.textTertiary)
            Text("Inbox is empty")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(ClawColors.textSecondary)
            Spacer()
        }
    }

    private func unavailableView(_ detail: String) -> some View {
        ContentUnavailableView(
            "Department inbox unavailable",
            systemImage: "tray",
            description: Text(detail)
        )
    }

    private var loadingView: some View {
        ScrollView {
            VStack(spacing: ClawSpacing.xs) {
                ForEach(0..<6, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: ClawRadius.md)
                        .fill(ClawColors.backgroundCard)
                        .frame(height: 72)
                        .shimmer()
                }
            }
            .padding(ClawSpacing.lg)
        }
    }
}

// MARK: - Inbox Message Row

struct InboxMessageRow: View {
    let message: InboxMessage
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: ClawSpacing.md) {
                // Icon
                ZStack {
                    Circle()
                        .fill(inboxTypeColor(message.type).opacity(0.15))
                        .frame(width: 36, height: 36)
                    Image(systemName: inboxTypeIcon(message.type))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(inboxTypeColor(message.type))
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .top) {
                        Text(message.title)
                            .font(message.isRead
                                  ? .system(size: 14, weight: .regular)
                                  : .system(size: 14, weight: .semibold))
                            .foregroundStyle(message.isRead ? ClawColors.textSecondary : ClawColors.textPrimary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        VStack(alignment: .trailing, spacing: 4) {
                            Text(message.timestamp.chatTimestamp)
                                .font(ClawFonts.caption)
                                .foregroundStyle(ClawColors.textTertiary)
                            if !message.isRead {
                                Circle()
                                    .fill(ClawColors.accent)
                                    .frame(width: 8, height: 8)
                            }
                        }
                    }

                    HStack(spacing: ClawSpacing.xs) {
                        // Type badge
                        Text(message.type.rawValue)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(inboxTypeColor(message.type))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(inboxTypeColor(message.type).opacity(0.12))
                            .clipShape(Capsule())

                        Text("•")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)

                        Text(message.source)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
            .padding(ClawSpacing.md)
            .background(message.isRead ? ClawColors.backgroundCard : ClawColors.backgroundCard)
            .cornerRadius(ClawRadius.md)
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.md)
                    .stroke(message.isRead ? ClawColors.separator : inboxTypeColor(message.type).opacity(0.3), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Message Detail View

struct InboxMessageDetailView: View {
    let message: InboxMessage
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: ClawSpacing.xl) {
                    // Header
                    VStack(alignment: .leading, spacing: ClawSpacing.md) {
                        HStack(spacing: ClawSpacing.sm) {
                            Image(systemName: inboxTypeIcon(message.type))
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(inboxTypeColor(message.type))
                            Text(message.type.rawValue.uppercased())
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(inboxTypeColor(message.type))
                        }

                        Text(message.title)
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(ClawColors.textPrimary)

                        HStack(spacing: ClawSpacing.xs) {
                            Image(systemName: "person.fill")
                                .font(.system(size: 11))
                                .foregroundStyle(ClawColors.textTertiary)
                            Text(message.source)
                                .font(ClawFonts.label)
                                .foregroundStyle(ClawColors.textSecondary)
                            Text("•")
                                .foregroundStyle(ClawColors.textTertiary)
                            Text(message.timestamp.fullTimestamp)
                                .font(ClawFonts.caption)
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                    }

                    Divider().background(ClawColors.separator)

                    // Body
                    Text(message.body)
                        .font(.system(size: 15))
                        .foregroundStyle(ClawColors.textPrimary)
                        .lineSpacing(5)

                    // Actions based on type
                    messageActions

                    Spacer(minLength: ClawSpacing.xxxl)
                }
                .padding(ClawSpacing.lg)
            }
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private var messageActions: some View {
        switch message.type {
        case .approval:
            HStack(spacing: ClawSpacing.md) {
                Button {
                    dismiss()
                } label: {
                    Label("Approve", systemImage: "checkmark.circle.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, ClawSpacing.md)
                        .background(ClawColors.accentGreen)
                        .cornerRadius(ClawRadius.lg)
                }
                .buttonStyle(.plain)

                Button {
                    dismiss()
                } label: {
                    Label("Reject", systemImage: "xmark.circle.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, ClawSpacing.md)
                        .background(ClawColors.accentRed)
                        .cornerRadius(ClawRadius.lg)
                }
                .buttonStyle(.plain)
            }

        case .incident:
            Button {
                dismiss()
            } label: {
                Label("View Incident", systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, ClawSpacing.md)
                    .background(ClawColors.accentRed)
                    .cornerRadius(ClawRadius.lg)
            }
            .buttonStyle(.plain)

        case .report:
            Button {
                dismiss()
            } label: {
                Label("Open Report", systemImage: "chart.bar.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, ClawSpacing.md)
                    .background(ClawColors.accentPurple)
                    .cornerRadius(ClawRadius.lg)
            }
            .buttonStyle(.plain)

        default:
            EmptyView()
        }
    }
}

// MARK: - Helpers

func inboxTypeIcon(_ type: InboxMessageType) -> String {
    switch type {
    case .alert:    return "bell.badge.fill"
    case .report:   return "chart.bar.fill"
    case .approval: return "checkmark.seal.fill"
    case .incident: return "exclamationmark.triangle.fill"
    case .system:   return "gearshape.fill"
    }
}

func inboxTypeColor(_ type: InboxMessageType) -> Color {
    switch type {
    case .alert:    return ClawColors.accentOrange
    case .report:   return ClawColors.accentPurple
    case .approval: return ClawColors.accentOrange
    case .incident: return ClawColors.accentRed
    case .system:   return ClawColors.textSecondary
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        DepartmentInboxView(departmentId: "d1")
    }
    .preferredColorScheme(.dark)
}
