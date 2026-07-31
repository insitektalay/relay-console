// RunEventsView.swift
// ClawChat – Operations: Execution log for a specific run

import SwiftUI
import Combine

// MARK: - ViewModel

@MainActor
final class RunEventsViewModel: ObservableObject {
    @Published var events: [RunEvent] = []
    @Published var filterType: String? = nil
    @Published var searchText: String = ""
    @Published var showRawJSON: Bool = false
    @Published var isLoading: Bool = false
    @Published var error: String?

    let run: Run

    init(run: Run) {
        self.run = run
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let response: PaginatedResponse<RunEvent> = try await APIClient.shared.requestPaginated(.runEvents(runId: run.id, page: 1))
            events = response.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    var availableTypes: [String] {
        Array(Set(events.map(\.type))).sorted()
    }

    var filteredEvents: [RunEvent] {
        var result = events
        if let type = filterType {
            result = result.filter { $0.type == type }
        }
        if !searchText.isEmpty {
            result = result.filter { $0.content.localizedCaseInsensitiveContains(searchText) }
        }
        return result.sorted { $0.timestamp < $1.timestamp }
    }

    var runDuration: String {
        guard let end = run.completedAt else { return "In progress" }
        let secs = Int(end.timeIntervalSince(run.startedAt))
        let m = secs / 60
        let s = secs % 60
        return "\(m)m \(s)s"
    }

    var runStatusColor: Color {
        switch run.status {
        case .running:   return ClawColors.accentGreen
        case .completed: return ClawColors.accentGreen
        case .failed:    return ClawColors.accentRed
        case .cancelled: return ClawColors.textTertiary
        case .timedOut:  return ClawColors.accentOrange
        }
    }

    var runStatusLabel: String {
        switch run.status {
        case .running:   return "Running"
        case .completed: return "Completed"
        case .failed:    return "Failed"
        case .cancelled: return "Cancelled"
        case .timedOut:  return "Timed Out"
        }
    }
}

// MARK: - Event type helpers

private extension String {
    var eventTypeIcon: String {
        switch self {
        case "thinking":     return "ellipsis.bubble.fill"
        case "tool_call":    return "hammer.fill"
        case "tool_result":  return "checkmark.circle.fill"
        case "output":       return "text.bubble.fill"
        case "error":        return "xmark.circle.fill"
        case "info":         return "info.circle.fill"
        default:             return "circle.fill"
        }
    }

    var eventTypeColor: Color {
        switch self {
        case "thinking":     return ClawColors.accentPurple
        case "tool_call":    return ClawColors.accent
        case "tool_result":  return ClawColors.accentGreen
        case "output":       return ClawColors.textPrimary
        case "error":        return ClawColors.accentRed
        case "info":         return ClawColors.accentTeal
        default:             return ClawColors.textSecondary
        }
    }

    var eventTypeLabel: String {
        switch self {
        case "thinking":    return "Thinking"
        case "tool_call":   return "Tool Call"
        case "tool_result": return "Tool Result"
        case "output":      return "Output"
        case "error":       return "Error"
        case "info":        return "Info"
        default:            return self.capitalized
        }
    }
}

// MARK: - View

struct RunEventsView: View {
    let run: Run
    @StateObject private var vm: RunEventsViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(run: Run) {
        self.run = run
        _vm = StateObject(wrappedValue: RunEventsViewModel(run: run))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    runHeader
                    Divider().background(ClawColors.separator)
                    filterBar
                    Divider().background(ClawColors.separator)

                    if vm.isLoading && vm.events.isEmpty {
                        RelayLoadingState(message: "Loading run events")
                    } else if let error = vm.error, vm.events.isEmpty {
                        VStack(spacing: RelaySpacing.md) {
                            RelayErrorPanel(message: error)
                            Button("Try Again") { _Concurrency.Task { await vm.load() } }
                                .buttonStyle(RelayButtonStyle(size: .md, variant: .secondary))
                        }
                        .padding(RelaySpacing.lg)
                    } else if vm.filteredEvents.isEmpty {
                        Spacer()
                        VStack(spacing: ClawSpacing.md) {
                            Image(systemName: "doc.text.magnifyingglass")
                                .font(.system(size: 40))
                                .foregroundStyle(ClawColors.textTertiary)
                            Text("No events found")
                                .font(ClawFonts.cardBody)
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(vm.filteredEvents) { event in
                                    eventRow(event: event)
                                    Divider()
                                        .background(ClawColors.separatorLight)
                                        .padding(.leading, 56)
                                }
                            }
                            .padding(.bottom, ClawSpacing.xxxl)
                        }
                    }
                }
            }
            .navigationTitle("Run Log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(ClawColors.accent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        vm.showRawJSON.toggle()
                    } label: {
                        Text("{ }")
                            .font(.system(size: 13, weight: .semibold, design: .monospaced))
                            .foregroundStyle(vm.showRawJSON ? ClawColors.accent : ClawColors.textSecondary)
                    }
                }
            }
            .searchable(text: $vm.searchText, prompt: "Search logs…")
            .task { await vm.load() }
            .refreshable { await vm.load() }
        }
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    // MARK: - Run Header

    private var runHeader: some View {
        VStack(spacing: ClawSpacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: ClawSpacing.xs) {
                    HStack(spacing: ClawSpacing.sm) {
                        Text("Agent:")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                        AvatarView(name: run.agentId, imageUrl: nil, size: .small)
                        Text(run.agentId)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                    }

                    HStack(spacing: ClawSpacing.sm) {
                        Label(run.startedAt.fullTimestamp, systemImage: "play.fill")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }

                    HStack(spacing: ClawSpacing.md) {
                        Label(vm.runDuration, systemImage: "clock")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)

                        Label(String(format: "$%.4f", run.cost), systemImage: "dollarsign.circle")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)

                        Label("\(run.eventsCount) events", systemImage: "list.bullet")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }

                Spacer()

                Text(vm.runStatusLabel)
                    .font(ClawFonts.label)
                    .foregroundStyle(vm.runStatusColor)
                    .padding(.horizontal, ClawSpacing.md)
                    .padding(.vertical, ClawSpacing.xs)
                    .background(vm.runStatusColor.opacity(0.15))
                    .clipShape(Capsule())
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundSecondary)
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ClawSpacing.sm) {
                filterChip(label: "All", type: nil)
                ForEach(vm.availableTypes, id: \.self) { type in
                    filterChip(label: type.eventTypeLabel, type: type)
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.vertical, ClawSpacing.md)
        }
        .background(ClawColors.backgroundPrimary)
    }

    private func filterChip(label: String, type: String?) -> some View {
        let isSelected = vm.filterType == type
        return Button {
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.15)) {
                vm.filterType = isSelected ? nil : type
            }
        } label: {
            HStack(spacing: ClawSpacing.xs) {
                if let type {
                    Image(systemName: type.eventTypeIcon)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(isSelected ? .white : type.eventTypeColor)
                }
                Text(label)
                    .font(ClawFonts.label)
            }
            .foregroundStyle(isSelected ? .white : ClawColors.textSecondary)
            .padding(.horizontal, ClawSpacing.md)
            .padding(.vertical, ClawSpacing.xs)
            .background(isSelected ? (type?.eventTypeColor ?? ClawColors.accent) : ClawColors.backgroundTertiary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: vm.filterType)
    }

    // MARK: - Event Row

    @ViewBuilder
    private func eventRow(event: RunEvent) -> some View {
        HStack(alignment: .top, spacing: ClawSpacing.md) {
            // Timestamp
            Text(event.timestamp.timeOnly)
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(ClawColors.textTertiary)
                .frame(width: 42, alignment: .leading)
                .padding(.top, 2)

            // Type icon
            Image(systemName: event.type.eventTypeIcon)
                .font(.system(size: 16))
                .foregroundStyle(event.type.eventTypeColor)
                .frame(width: 20)
                .padding(.top, 1)

            // Content
            VStack(alignment: .leading, spacing: ClawSpacing.xs) {
                Text(event.type.eventTypeLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(event.type.eventTypeColor)

                if vm.showRawJSON {
                    Text(rawJSONString(event: event))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(ClawColors.accentGreen)
                        .textSelection(.enabled)
                } else {
                    Text(event.content)
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textPrimary)
                        .lineLimit(event.type == "thinking" ? 4 : nil)
                        .textSelection(.enabled)
                }

                if !event.metadata.isEmpty && !vm.showRawJSON {
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(event.metadata.prefix(3)), id: \.key) { key, value in
                            HStack(spacing: 4) {
                                Text(key)
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundStyle(ClawColors.textTertiary)
                                Text(value)
                                    .font(.system(size: 10))
                                    .foregroundStyle(ClawColors.textSecondary)
                            }
                        }
                    }
                    .padding(ClawSpacing.xs)
                    .background(ClawColors.backgroundTertiary)
                    .cornerRadius(ClawRadius.sm)
                }
            }

            Spacer()
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.md)
        .background(
            event.type == "error"
            ? ClawColors.accentRed.opacity(0.05)
            : Color.clear
        )
    }

    private func rawJSONString(event: RunEvent) -> String {
        """
        {
          "id": "\(event.id)",
          "type": "\(event.type)",
          "timestamp": "\(event.timestamp.fullTimestamp)",
          "content": "\(event.content.prefix(200))"
        }
        """
    }
}

// MARK: - Mock Data

extension RunEvent {
    static let mockEvents: [RunEvent] = {
        let now = Date()
        return [
            RunEvent(id: "e1", runId: "run001", type: "info",        content: "Task started. Loading context from workspace.", timestamp: now.addingTimeInterval(-3600), metadata: ["tokens": "0"]),
            RunEvent(id: "e2", runId: "run001", type: "thinking",     content: "I need to access the shared drive to find the invoice files for Q1. I'll use the file system tool to list the directory.", timestamp: now.addingTimeInterval(-3580), metadata: [:]),
            RunEvent(id: "e3", runId: "run001", type: "tool_call",    content: "list_directory(path: \"/shared/invoices/q1\")", timestamp: now.addingTimeInterval(-3560), metadata: ["tool": "filesystem", "duration_ms": "142"]),
            RunEvent(id: "e4", runId: "run001", type: "tool_result",  content: "Found 142 files. invoice_001.pdf ... invoice_142.pdf", timestamp: now.addingTimeInterval(-3540), metadata: ["count": "142"]),
            RunEvent(id: "e5", runId: "run001", type: "thinking",     content: "I have 142 invoice files. I'll now iterate through each one and extract the relevant fields using the PDF parser.", timestamp: now.addingTimeInterval(-3530), metadata: [:]),
            RunEvent(id: "e6", runId: "run001", type: "tool_call",    content: "parse_pdf(path: \"/shared/invoices/q1/invoice_001.pdf\")", timestamp: now.addingTimeInterval(-3500), metadata: ["tool": "pdf_parser"]),
            RunEvent(id: "e7", runId: "run001", type: "tool_result",  content: "Extracted: vendor=Acme Corp, amount=$1,240.00, date=2026-01-15", timestamp: now.addingTimeInterval(-3490), metadata: [:]),
            RunEvent(id: "e8", runId: "run001", type: "tool_call",    content: "write_csv(row: {vendor: \"Acme Corp\", amount: 1240.00, date: \"2026-01-15\"})", timestamp: now.addingTimeInterval(-3200), metadata: ["tool": "csv_writer"]),
            RunEvent(id: "e9", runId: "run001", type: "tool_result",  content: "Row written to output.csv successfully.", timestamp: now.addingTimeInterval(-3195), metadata: [:]),
            RunEvent(id: "e10", runId: "run001", type: "error",       content: "Failed to parse invoice_137.pdf: Malformed PDF structure at offset 4096. Skipping file.", timestamp: now.addingTimeInterval(-3100), metadata: ["file": "invoice_137.pdf", "error_code": "PDF_PARSE_ERROR"]),
            RunEvent(id: "e11", runId: "run001", type: "output",      content: "Batch complete. Processed 141/142 invoices. 1 file skipped due to parse error. Total amount: $184,320.50. Results saved to /shared/output/q1_invoices.csv", timestamp: now.addingTimeInterval(-3000), metadata: ["processed": "141", "skipped": "1"]),
        ]
    }()
}

// MARK: - Preview

#Preview {
    RunEventsView(run: Run.mockRuns[0])
        .preferredColorScheme(.dark)
}
