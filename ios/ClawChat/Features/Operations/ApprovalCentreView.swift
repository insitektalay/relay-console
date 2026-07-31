// ApprovalCentreView.swift
// ClawChat – Operations: Approval inbox

import SwiftUI
import Combine

enum ApprovalQueueFilter: String, CaseIterable, Identifiable {
    case all = "All statuses"
    case pending = "Pending"
    case approved = "Approved"
    case rejected = "Rejected"
    case expired = "Expired"
    case cancelled = "Cancelled"

    var id: String { rawValue }

    var status: ApprovalStatus? {
        switch self {
        case .all: nil
        case .pending: .pending
        case .approved: .approved
        case .rejected: .rejected
        case .expired: .expired
        case .cancelled: .cancelled
        }
    }
}

// MARK: - ViewModel

@MainActor
final class ApprovalsViewState: ObservableObject {
    @Published var approvals: [Approval] = []
    @Published var selectedApproval: Approval? = nil
    @Published var actioningIds: Set<String> = []
    @Published var notes: String = ""
    @Published var isLoading: Bool = false
    @Published var error: String?
    var workspaceId: String = ""

    var pendingCount: Int {
        approvals.filter { $0.status == .pending }.count
    }

    func filteredApprovals(query: String, filter: ApprovalQueueFilter) -> [Approval] {
        approvals.filter { approval in
            let matchesStatus = filter.status == nil || approval.effectiveStatus == filter.status
            let matchesQuery = query.isEmpty
                || approval.title.localizedCaseInsensitiveContains(query)
                || approval.description.localizedCaseInsensitiveContains(query)
                || approval.requestedByAgentId.localizedCaseInsensitiveContains(query)
                || approval.taskId?.localizedCaseInsensitiveContains(query) == true
            return matchesStatus && matchesQuery
        }
    }

    func load() async {
        guard !workspaceId.isEmpty, !isLoading else { return }
        isLoading = true
        error = nil
        do {
            let response: PaginatedResponse<Approval> = try await APIClient.shared.requestPaginated(
                .approvals(workspaceId: workspaceId, page: 1, status: nil)
            )
            approvals = response.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func isActioning(_ approval: Approval) -> Bool {
        actioningIds.contains(approval.id)
    }

    func approve(approval: Approval, notes: String) {
        actioningIds.insert(approval.id)
        _Concurrency.Task { [weak self] in
            do {
                let updated: Approval = try await APIClient.shared.request(
                    .resolveApproval(id: approval.id, decision: "approved", notes: notes.isEmpty ? nil : notes)
                )
                await MainActor.run {
                    if let idx = self?.approvals.firstIndex(where: { $0.id == updated.id }) {
                        self?.approvals[idx] = updated
                    }
                    self?.actioningIds.remove(approval.id)
                }
            } catch {
                await MainActor.run {
                    self?.actioningIds.remove(approval.id)
                    self?.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
                }
            }
        }
    }

    func reject(approval: Approval, notes: String) {
        actioningIds.insert(approval.id)
        _Concurrency.Task { [weak self] in
            do {
                let updated: Approval = try await APIClient.shared.request(
                    .resolveApproval(id: approval.id, decision: "rejected", notes: notes.isEmpty ? nil : notes)
                )
                await MainActor.run {
                    if let idx = self?.approvals.firstIndex(where: { $0.id == updated.id }) {
                        self?.approvals[idx] = updated
                    }
                    self?.actioningIds.remove(approval.id)
                }
            } catch {
                await MainActor.run {
                    self?.actioningIds.remove(approval.id)
                    self?.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
                }
            }
        }
    }

    func expiresIn(_ approval: Approval) -> String? {
        guard let exp = approval.expiresAt else { return nil }
        let secs = exp.timeIntervalSinceNow
        guard secs > 0 else { return "Expired" }
        let hours = Int(secs / 3600)
        let mins  = Int((secs.truncatingRemainder(dividingBy: 3600)) / 60)
        if hours > 0 { return "Expires in \(hours)h \(mins)m" }
        return "Expires in \(mins)m"
    }
}

// MARK: - View

struct ApprovalCentreView: View {
    @StateObject private var vm = ApprovalsViewState()
    @EnvironmentObject private var appStore: AppStore
    @State private var showNoteSheet: Bool = false
    @State private var pendingAction: (Approval, Bool)? = nil   // (approval, isApprove)
    @State private var noteText: String = ""
    @State private var showCriticalConfirm: Bool = false
    @State private var query = ""
    @State private var filter: ApprovalQueueFilter = .all

    private var filteredApprovals: [Approval] {
        vm.filteredApprovals(query: query, filter: filter)
    }

    var body: some View {
        Group {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: RelaySpacing.lg) {
                        RelaySectionHeader(title: "Approvals", subtitle: "Review pending agent actions before execution")
                        RelaySearchField(text: $query, prompt: "Search approvals")
                        Menu {
                            ForEach(ApprovalQueueFilter.allCases) { value in
                                Button(value.rawValue) { filter = value }
                            }
                        } label: {
                            Label(filter.rawValue, systemImage: "line.3.horizontal.decrease.circle")
                                .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(RelayButtonStyle(variant: .secondary))
                        summaryStrip

                        if vm.isLoading && vm.approvals.isEmpty {
                            RelayLoadingState(message: "Loading approvals").frame(minHeight: 180)
                        } else if let error = vm.error, vm.approvals.isEmpty {
                            VStack(spacing: RelaySpacing.md) {
                                RelayStatusStrip(title: "Approvals could not be loaded", detail: error, tone: .failure, icon: "exclamationmark.triangle.fill")
                                Button("Retry") { _Concurrency.Task { await vm.load() } }
                                    .buttonStyle(RelayButtonStyle(variant: .secondary))
                            }
                        } else if filteredApprovals.isEmpty {
                            emptyState
                        } else {
                            RelaySectionHeader(title: "Action queue", subtitle: "\(filteredApprovals.count) matching approvals")
                            ForEach(filteredApprovals) { approval in
                                approvalCard(approval: approval)
                            }
                        }

                        if let error = vm.error, !vm.approvals.isEmpty {
                            RelayStatusStrip(title: "Approval action failed", detail: error, tone: .failure, icon: "exclamationmark.triangle.fill")
                        }
                    }
                    .padding(RelaySpacing.lg)
                    .padding(.bottom, RelaySpacing.xxl)
                }
                .defaultScrollAnchor(.top)
            }
            .navigationTitle("Approvals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                if vm.pendingCount > 0 {
                    ToolbarItem(placement: .topBarTrailing) {
                        ZStack {
                            Text("\(vm.pendingCount)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(ClawColors.accentRed)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
            .sheet(isPresented: $showNoteSheet) {
                noteSheet
            }
            .task {
                if let wsId = appStore.selectedWorkspace?.id {
                    vm.workspaceId = wsId
                    await vm.load()
                }
            }
            .refreshable { await vm.load() }
            .confirmationDialog(
                "Approve Critical Risk Action?",
                isPresented: $showCriticalConfirm,
                titleVisibility: .visible
            ) {
                Button("Approve", role: .destructive) {
                    if let (approval, _) = pendingAction {
                        vm.approve(approval: approval, notes: noteText)
                    }
                    pendingAction = nil
                }
                Button("Cancel", role: .cancel) { pendingAction = nil }
            } message: {
                Text("This action is marked as Critical Risk and may be irreversible. Are you sure you want to approve?")
            }
        }
    }

    private var summaryStrip: some View {
        HStack(spacing: RelaySpacing.sm) {
            approvalStat("Pending", vm.approvals.filter { $0.effectiveStatus == .pending }.count, RelayColors.accentOrange)
            approvalStat("Approved", vm.approvals.filter { $0.status == .approved }.count, RelayColors.accentGreen)
            approvalStat("Rejected", vm.approvals.filter { $0.status == .rejected }.count, RelayColors.accentRed)
            approvalStat("Total", vm.approvals.count, RelayColors.accent)
        }
    }

    private func approvalStat(_ title: String, _ value: Int, _ color: Color) -> some View {
        RelayPanel {
            VStack(spacing: 3) {
                Text("\(value)").font(.caption.weight(.bold)).foregroundStyle(color)
                Text(title).font(.caption2.weight(.semibold)).foregroundStyle(RelayColors.textSecondary)
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Approval Card

    @ViewBuilder
    private func approvalCard(approval: Approval) -> some View {
        let riskColor = Color.riskLevelColor(approval.risk)
        let isExpired = approval.effectiveStatus == .expired
        let isPending = approval.effectiveStatus == .pending
        let isActioning = vm.isActioning(approval)

        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            // Top row: status tag + risk
            HStack {
                HStack(spacing: ClawSpacing.xs) {
                    if isPending {
                        Circle()
                            .fill(ClawColors.accentOrange)
                            .frame(width: 7, height: 7)
                    }
                    Text(isPending ? "APPROVAL REQUIRED" : (isExpired ? "EXPIRED" : approval.status.displayLabel.uppercased()))
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(isPending ? ClawColors.accentOrange : ClawColors.textSecondary)
                }

                Spacer()

                Text(approval.risk.rawValue.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(riskColor)
                    .padding(.horizontal, ClawSpacing.sm)
                    .padding(.vertical, 3)
                    .background(riskColor.opacity(0.15))
                    .cornerRadius(ClawRadius.sm)
            }

            // Title
            Text(approval.title)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(ClawColors.textPrimary)
                .lineLimit(3)

            // Description
            if !approval.description.isEmpty {
                Text(approval.description)
                    .font(ClawFonts.cardBody)
                    .foregroundStyle(ClawColors.textSecondary)
                    .lineLimit(2)
            }

            if let payload = exactPayload(from: approval) {
                DisclosureGroup("Exact action payload") {
                    Text(payload)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(ClawColors.textSecondary)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, ClawSpacing.xs)
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ClawColors.accentOrange)
                .accessibilityHint("Expand to verify the immutable provider action before approving")
            }

            Divider().background(ClawColors.separatorLight)

            // Meta rows
            VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                metaRow(label: "Requested by", value: approval.requestedByAgentId, icon: "person.fill")

                if let provider = ApprovalPayloadPresentation.stringMetadata(approval, keys: ["provider", "app", "appName", "app_name"]) {
                    metaRow(label: "Provider", value: provider, icon: "shippingbox.fill")
                }

                if let provenance = ApprovalPayloadPresentation.stringMetadata(approval, keys: ["provenance", "source", "origin"]) {
                    metaRow(label: "Provenance", value: provenance, icon: "point.3.connected.trianglepath.dotted")
                }

                if let taskId = approval.taskId {
                    metaRow(label: "Task", value: taskId, icon: "checklist")
                }

                HStack(spacing: ClawSpacing.xs) {
                    Image(systemName: "exclamationmark.shield.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(riskColor)
                    Text("Risk: ")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(ClawColors.textSecondary)
                    Text("\(approval.risk.rawValue.capitalized)")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(riskColor)
                    if approval.risk == .high || approval.risk == .critical {
                        Text("— Irreversible action")
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }

                if approval.status == .pending, let expiresLabel = vm.expiresIn(approval) {
                    HStack(spacing: ClawSpacing.xs) {
                        Image(systemName: "clock.badge.exclamationmark")
                            .font(.system(size: 12))
                            .foregroundStyle(ClawColors.accentOrange)
                        Text(expiresLabel)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(ClawColors.accentOrange)
                    }
                }
            }

            // Steps progress (if multi-step)
            if approval.steps.count > 1 {
                approvalStepsView(approval: approval)
            }

            // Resolved notes
            if let resolvedNotes = approval.notes, !resolvedNotes.isEmpty, !isPending {
                Text("Notes: \(resolvedNotes)")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
                    .italic()
            }

            // Action buttons (pending only)
            if isPending {
                Divider().background(ClawColors.separatorLight)

                VStack(spacing: ClawSpacing.sm) {
                    // Reject
                    Button {
                        pendingAction = (approval, false)
                        noteText = ""
                        showNoteSheet = true
                    } label: {
                        Text("Reject")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(ClawColors.accentRed)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .padding(.vertical, ClawSpacing.sm)
                            .background(ClawColors.accentRed.opacity(0.12))
                            .cornerRadius(ClawRadius.md)
                    }
                    .buttonStyle(.plain)
                    .disabled(isActioning)

                    // Approve
                    Button {
                        if approval.risk == .critical {
                            pendingAction = (approval, true)
                            showCriticalConfirm = true
                        } else {
                            pendingAction = (approval, true)
                            noteText = ""
                            showNoteSheet = true
                        }
                    } label: {
                        HStack(spacing: ClawSpacing.xs) {
                            if isActioning {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .tint(.white)
                            } else {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 12, weight: .bold))
                            }
                            Text("Approve")
                                .font(.system(size: 14, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .padding(.vertical, ClawSpacing.sm)
                        .background(ClawColors.accentGreen)
                        .cornerRadius(ClawRadius.md)
                    }
                    .buttonStyle(.plain)
                    .disabled(isActioning)
                }
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.card)
                .stroke(isPending ? riskColor.opacity(0.4) : ClawColors.separator, lineWidth: isPending ? 1 : 0.5)
        )
    }

    private func metaRow(label: String, value: String, icon: String) -> some View {
        HStack(spacing: ClawSpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(ClawColors.textTertiary)
                .frame(width: 16)
            Text("\(label): ")
                .font(ClawFonts.caption)
                .foregroundStyle(ClawColors.textSecondary)
            Text(value)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(ClawColors.textPrimary)
        }
    }

    private func exactPayload(from approval: Approval) -> String? {
        ApprovalPayloadPresentation.payloadText(for: approval)
    }

    private func approvalStepsView(approval: Approval) -> some View {
        VStack(alignment: .leading, spacing: ClawSpacing.xs) {
            Text("Approval Steps")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
                .textCase(.uppercase)

            HStack(spacing: ClawSpacing.xs) {
                ForEach(approval.steps.sorted(by: { $0.order < $1.order })) { step in
                    let color: Color = {
                        switch step.status {
                        case .approved: return ClawColors.accentGreen
                        case .rejected: return ClawColors.accentRed
                        case .pending:  return ClawColors.textTertiary
                        default:        return ClawColors.textTertiary
                        }
                    }()

                    HStack(spacing: 2) {
                        Circle()
                            .fill(color)
                            .frame(width: 8, height: 8)
                        Text("Step \(step.order + 1)")
                            .font(.system(size: 10))
                            .foregroundStyle(color)
                    }

                    if step.id != approval.steps.last?.id {
                        Rectangle()
                            .fill(ClawColors.separator)
                            .frame(height: 1)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }

    // MARK: - Note Sheet

    private var noteSheet: some View {
        NavigationStack {
            VStack(spacing: ClawSpacing.lg) {
                if let (approval, isApprove) = pendingAction {
                    Text(isApprove ? "Approve: \(approval.title)" : "Reject: \(approval.title)")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                        .multilineTextAlignment(.center)
                        .padding(.top, ClawSpacing.lg)

                    VStack(alignment: .leading, spacing: ClawSpacing.xs) {
                        Text("Notes (optional)")
                            .font(ClawFonts.label)
                            .foregroundStyle(ClawColors.textSecondary)

                        TextEditor(text: $noteText)
                            .font(ClawFonts.cardBody)
                            .foregroundStyle(ClawColors.textPrimary)
                            .frame(minHeight: 100)
                            .padding(ClawSpacing.sm)
                            .background(ClawColors.backgroundTertiary)
                            .cornerRadius(ClawRadius.md)
                            .colorScheme(.dark)
                    }
                    .padding(.horizontal, ClawSpacing.lg)

                    Spacer()

                    Button {
                        if isApprove {
                            vm.approve(approval: approval, notes: noteText)
                        } else {
                            vm.reject(approval: approval, notes: noteText)
                        }
                        pendingAction = nil
                        showNoteSheet = false
                    } label: {
                        Text(isApprove ? "Confirm Approval" : "Confirm Rejection")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, ClawSpacing.md)
                            .background(isApprove ? ClawColors.accentGreen : ClawColors.accentRed)
                            .cornerRadius(ClawRadius.md)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.bottom, ClawSpacing.xl)
                }
            }
            .background(ClawColors.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("Add Notes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        pendingAction = nil
                        showNoteSheet = false
                    }
                    .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        RelayInlineEmptyState(
            icon: query.isEmpty ? "checkmark.seal.fill" : "magnifyingglass",
            title: query.isEmpty && filter == .all ? "All clear" : "No approvals found",
            subtitle: query.isEmpty ? "No retained approvals match \(filter.rawValue.lowercased())." : "Try another search or status filter."
        )
    }
}

enum ApprovalPayloadPresentation {
    private static let payloadKeys = ["exactPayload", "exact_payload", "payload", "actionPayload", "action_payload"]
    private static let sensitiveFragments = ["token", "secret", "password", "api_key", "apikey", "authorization", "credential", "private_key"]

    static func payloadText(for approval: Approval) -> String? {
        guard let value = payloadKeys.compactMap({ approval.metadata[$0] }).first else { return nil }
        let redacted = redactSecrets(value)
        guard let data = try? JSONEncoder.pretty.encode(redacted) else { return redacted.displayString }
        return String(data: data, encoding: .utf8)
    }

    static func stringMetadata(_ approval: Approval, keys: [String]) -> String? {
        for key in keys {
            if case .string(let value) = approval.metadata[key], !value.isEmpty { return value }
        }
        return nil
    }

    static func redactSecrets(_ value: JSONValue) -> JSONValue {
        switch value {
        case .object(let object):
            return .object(object.reduce(into: [:]) { result, pair in
                let key = pair.key.lowercased()
                result[pair.key] = sensitiveFragments.contains(where: { key.contains($0) })
                    ? .string("[redacted]")
                    : redactSecrets(pair.value)
            })
        case .array(let array): return .array(array.map(redactSecrets))
        default: return value
        }
    }
}

private extension JSONEncoder {
    static var pretty: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return encoder
    }
}

// MARK: - Extensions

extension ApprovalStatus {
    var displayLabel: String {
        switch self {
        case .pending:   return "Pending"
        case .approved:  return "Approved"
        case .rejected:  return "Rejected"
        case .expired:   return "Expired"
        case .cancelled: return "Cancelled"
        }
    }
}

extension Approval {
    var effectiveStatus: ApprovalStatus {
        if status == .pending, let expiresAt, expiresAt <= Date() { return .expired }
        return status
    }
}

// MARK: - Mock Data

extension Approval {
    static let mockApprovals: [Approval] = {
        let now = Date()
        return [
            Approval(id: "apr1", title: "Delete production database backup", description: "Agent OpsBot is requesting permission to permanently delete the production database backup from 2026-01-01.", status: .pending, requestedByAgentId: "OpsBot", taskId: "task-3", workspaceId: "ws1", risk: .critical, steps: [ApprovalStep(id: "s1", approvalId: "apr1", order: 0, approverId: nil, status: .pending, notes: nil, resolvedAt: nil), ApprovalStep(id: "s2", approvalId: "apr1", order: 1, approverId: nil, status: .pending, notes: nil, resolvedAt: nil)], createdAt: now.addingTimeInterval(-3600), resolvedAt: nil, expiresAt: now.addingTimeInterval(14400), notes: nil),
            Approval(id: "apr2", title: "Send bulk email to 12,000 customers", description: "MarketingBot wants to send a promotional email to the entire customer list.", status: .pending, requestedByAgentId: "MarketingBot", taskId: "task-7", workspaceId: "ws1", risk: .high, steps: [ApprovalStep(id: "s3", approvalId: "apr2", order: 0, approverId: nil, status: .pending, notes: nil, resolvedAt: nil)], createdAt: now.addingTimeInterval(-1800), resolvedAt: nil, expiresAt: now.addingTimeInterval(7200), notes: nil),
            Approval(id: "apr3", title: "Enable external API access", description: "DevBot is requesting access to an external third-party API endpoint.", status: .approved, requestedByAgentId: "DevBot", taskId: "task-4", workspaceId: "ws1", risk: .medium, steps: [ApprovalStep(id: "s4", approvalId: "apr3", order: 0, approverId: "u1", status: .approved, notes: "Reviewed and approved", resolvedAt: now.addingTimeInterval(-7200))], createdAt: now.addingTimeInterval(-14400), resolvedAt: now.addingTimeInterval(-7200), expiresAt: nil, notes: "Reviewed and approved"),
            Approval(id: "apr4", title: "Archive Q4 financial records", description: "FinanceBot wants to archive 2025 Q4 financial records to cold storage.", status: .rejected, requestedByAgentId: "FinanceBot", taskId: nil, workspaceId: "ws1", risk: .low, steps: [ApprovalStep(id: "s5", approvalId: "apr4", order: 0, approverId: "u1", status: .rejected, notes: "Not ready for archival", resolvedAt: now.addingTimeInterval(-86400))], createdAt: now.addingTimeInterval(-172800), resolvedAt: now.addingTimeInterval(-86400), expiresAt: nil, notes: "Not ready for archival"),
        ]
    }()
}

// MARK: - Preview

#Preview {
    ApprovalCentreView()
        .environmentObject(AppStore.preview)
        .preferredColorScheme(.dark)
}
