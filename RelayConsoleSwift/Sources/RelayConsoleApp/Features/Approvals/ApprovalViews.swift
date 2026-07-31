import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApprovalsSidebarPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 12) {
      SidebarSectionHeader(title: "Approvals", subtitle: "Action queue", icon: "checkmark.seal") {
        StatusBadge(
          title: "\(model.providerApprovalInbox?.summary.pendingCount ?? 0)",
          tone: (model.providerApprovalInbox?.summary.pendingCount ?? 0) > 0 ? .amber : .green,
          accessibilityLabelText: "Pending approvals"
        )
        Button {
          Task { await model.refresh() }
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .buttonStyle(IconButtonStyle())
        .help("Refresh approvals")
        .accessibilityLabel("Refresh approvals")
      }
      SearchField(
        text: Binding(
          get: { model.approvalSearch },
          set: { model.setApprovalSearch($0) }
        ),
        placeholder: "Search approvals"
      )
      ApprovalFilterBar()
      ScrollView {
        LazyVStack(spacing: 8) {
          if model.providerApprovalInbox == nil {
            EmptyMini(title: "Loading approvals", body: "Checking retained provider actions.")
          } else if model.filteredProviderApprovalCards.isEmpty {
            EmptyMini(
              title: "No approvals", body: "No retained provider-action approvals match this view.")
          } else {
            ForEach(model.filteredProviderApprovalCards) { card in
              ProviderActionApprovalCardRow(
                card: card,
                selected: model.selectedProviderApprovalCard?.approvalId == card.approvalId
              )
            }
          }
        }
      }
    }
    .sidebarPanelChrome()
  }
}

struct ApprovalFilterBar: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    Picker(
      "Approval status",
      selection: Binding(
        get: { model.approvalStatusFilter },
        set: { model.setApprovalStatusFilter($0) }
      )
    ) {
      ForEach(ProviderApprovalFilter.allCases) { filter in
        Text(filter.title).tag(filter)
      }
    }
    .pickerStyle(.menu)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(RCTheme.sidebarSurfaceAlt)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .accessibilityLabel("Approval status filter")
  }
}

struct ProviderActionApprovalCardRow: View {
  @EnvironmentObject var model: AppViewModel
  let card: ProviderActionApprovalCardState
  let selected: Bool

  var body: some View {
    Button {
      model.selectProviderApproval(card)
    } label: {
      ProviderActionApprovalCardView(card: card, compact: true)
        .padding(10)
        .rcHoverFocusSurface(selected: selected)
    }
    .buttonStyle(.plain)
    .help("Open approval \(card.actionLabel)")
    .accessibilityLabel("Open approval \(card.title)")
    .accessibilityValue(selected ? "Selected" : card.statusLabel)
  }
}

struct ApprovalsScreen: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 0) {
      ScrollView {
        VStack(spacing: 14) {
          ApprovalsSummaryStrip()
          if let card = model.selectedProviderApprovalCard {
            ProviderActionApprovalDetailPanel(card: card)
          } else {
            FormCard {
              EmptyMiniLight(
                title: "No approval selected",
                body:
                  "Provider-action approval records will appear here after a broker request creates them."
              )
            }
          }
        }
        .padding(24)
      }
    }
    .accessibilityLabel("Approvals")
  }
}

struct ApprovalsSummaryStrip: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    let summary = model.providerApprovalInbox?.summary
    HStack(spacing: 8) {
      ApprovalStatTile(title: "Pending", value: summary?.pendingCount ?? 0, tone: .amber)
      ApprovalStatTile(title: "Approved", value: summary?.approvedCount ?? 0, tone: .green)
      ApprovalStatTile(title: "Executed", value: summary?.executedCount ?? 0, tone: .blue)
      ApprovalStatTile(title: "Failed", value: summary?.failedCount ?? 0, tone: .red)
      ApprovalStatTile(title: "Total", value: summary?.totalCount ?? 0, tone: .neutral)
    }
    .padding(.horizontal, 8)
    .padding(.vertical, 7)
    .background(RCTheme.surfaceLevel1.opacity(0.42))
    .clipShape(RoundedRectangle(cornerRadius: 7))
  }
}

struct ApprovalStatTile: View {
  let title: String
  let value: Int
  let tone: ComponentTone

  var body: some View {
    HStack(spacing: 6) {
      Circle()
        .fill(tone.color)
        .frame(width: 6, height: 6)
      Text(title)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      Text("\(value)")
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(tone.color)
    }
    .frame(minWidth: 86, alignment: .leading)
    .padding(.horizontal, 10)
    .frame(height: 28)
    .background(RCTheme.surfaceInset.opacity(0.72))
    .clipShape(RoundedRectangle(cornerRadius: 5))
  }
}

struct ProviderActionApprovalCardView: View {
  let card: ProviderActionApprovalCardState
  var compact: Bool = false

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 7 : 10) {
      HStack(spacing: 8) {
        VStack(alignment: .leading, spacing: 3) {
          Text(card.actionLabel)
            .font(.system(size: compact ? 13 : 16, weight: .semibold))
            .lineLimit(compact ? 1 : 2)
          Text(card.appName)
            .font(.system(size: compact ? 11 : 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
            .lineLimit(1)
        }
        Spacer()
        StatusBadge(
          title: card.statusLabel, tone: approvalStatusTone(card.status),
          accessibilityLabelText: card.statusLabel)
      }
      Text(card.payloadSummary)
        .font(.system(size: compact ? 11 : 12, weight: .medium))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(compact ? 2 : 4)
      HStack(spacing: 8) {
        Text(relativeTime(card.updatedAt))
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
        if let executionStatus = card.executionStatus {
          let executionLabel = providerApprovalExecutionLabel(
            card: card, executionStatus: executionStatus)
          StatusBadge(
            title: executionLabel,
            tone: providerApprovalExecutionTone(card: card, executionStatus: executionStatus),
            accessibilityLabelText: "Execution \(executionLabel)"
          )
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct ProviderActionApprovalDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let card: ProviderActionApprovalCardState
  @State private var showApproveConfirmation = false
  @State private var showRejectConfirmation = false

  var body: some View {
    NativeGroupedSection {
      VStack(alignment: .leading, spacing: 14) {
        approvalDecisionHeader
        if card.status == .pending {
          HStack(spacing: 10) {
            if card.decisionAvailableInTopLevelUI {
              Button {
                showApproveConfirmation = true
              } label: {
                Label(
                  approveBusy ? "Approving..." : approveButtonTitle,
                  systemImage: approveBusy ? "hourglass" : "checkmark.circle.fill"
                )
              }
              .buttonStyle(PrimaryLightButtonStyle())
              .disabled(actionsDisabled)
              .help(approveHelp)
              .accessibilityLabel("\(approveButtonTitle) \(card.title)")
            }
            Button {
              showRejectConfirmation = true
            } label: {
              Label(
                rejectBusy ? "Rejecting..." : "Reject",
                systemImage: rejectBusy ? "hourglass" : "xmark.circle"
              )
            }
            .buttonStyle(SecondaryLightButtonStyle())
            .disabled(actionsDisabled)
            .help("Reject \(card.actionLabel)")
            .accessibilityLabel("Reject \(card.title)")
            Spacer()
          }
        } else if card.status == .approved && !model.isRailwayProviderApproval(card) {
          HStack(spacing: 10) {
            Button {
              model.executeApprovedProviderApproval(card)
            } label: {
              Label(
                executeBusy ? "Executing..." : "Execute approved",
                systemImage: executeBusy ? "hourglass" : "play.circle.fill"
              )
            }
            .buttonStyle(PrimaryLightButtonStyle())
            .disabled(actionsDisabled)
            .help("Execute approved \(card.actionLabel)")
            .accessibilityLabel("Execute approved \(card.title)")
            Spacer()
          }
        }
        if let error = model.error?.nilIfEmpty {
          HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
              .foregroundStyle(RCTheme.accentRed)
            Text(error)
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.text)
              .fixedSize(horizontal: false, vertical: true)
              .textSelection(.enabled)
          }
          .padding(12)
          .background(RCTheme.accentRed.opacity(0.10))
          .clipShape(RoundedRectangle(cornerRadius: 4))
          .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentRed.opacity(0.35)))
        }
        if let reason = card.decisionUnavailableReason {
          HStack(alignment: .top, spacing: 10) {
            Image(systemName: "lock.shield")
              .foregroundStyle(RCTheme.accentAmber)
            Text(reason)
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
              .fixedSize(horizontal: false, vertical: true)
          }
          .padding(12)
          .background(RCTheme.surfaceInset)
          .clipShape(RoundedRectangle(cornerRadius: 4))
          .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
        }
        DisclosureGroup {
          VStack(alignment: .leading, spacing: 8) {
            ApprovalDetailMetric(label: "Approval ID", value: card.approvalId)
            ApprovalDetailMetric(label: "Payload hash", value: card.payloadHash)
            ApprovalDetailMetric(label: "Updated", value: relativeTime(card.updatedAt))
            ApprovalDetailMetric(
              label: "Execution", value: providerApprovalExecutionMetric(card: card))
          }
          .padding(.top, 8)
        } label: {
          Text("Advanced details")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
      }
    }
    .alert(approveConfirmationTitle, isPresented: $showApproveConfirmation) {
      Button("Cancel", role: .cancel) {}
      Button(approveButtonTitle) {
        model.approveAndExecuteProviderApproval(card)
      }
    } message: {
      Text(card.payloadSummary)
    }
    .alert("Reject approval?", isPresented: $showRejectConfirmation) {
      Button("Cancel", role: .cancel) {}
      Button("Reject", role: .destructive) {
        model.rejectProviderApproval(card)
      }
    } message: {
      Text(card.payloadSummary)
    }
  }

  private var approvalDecisionHeader: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top, spacing: 12) {
        VStack(alignment: .leading, spacing: 5) {
          Text(card.actionLabel)
            .font(.system(size: 22, weight: .semibold))
          Text(card.payloadSummary)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(RCTheme.muted)
            .fixedSize(horizontal: false, vertical: true)
        }
        Spacer()
        StatusBadge(
          title: card.statusLabel, tone: approvalStatusTone(card.status),
          accessibilityLabelText: card.statusLabel)
      }
      HStack(spacing: 8) {
        ApprovalInlineMeta(label: "Provider", value: card.appName)
        ApprovalInlineMeta(label: "Requested", value: relativeTime(card.requestedAt))
        ApprovalInlineMeta(label: "Risk", value: card.statusLabel)
      }
    }
    .padding(.bottom, 4)
  }

  private var approveButtonTitle: String {
    model.isRailwayProviderApproval(card) ? "Approve" : "Approve and execute"
  }

  private var approveHelp: String {
    if model.isRailwayProviderApproval(card) {
      return "Approve \(card.actionLabel). The requesting agent must then continue the action."
    }
    return "Approve and execute \(card.actionLabel)"
  }

  private var approveConfirmationTitle: String {
    model.isRailwayProviderApproval(card) ? "Approve this action?" : "Approve and execute?"
  }

  private var approveBusy: Bool {
    model.busy == "approve-provider-action-\(card.approvalId)"
  }

  private var rejectBusy: Bool {
    model.busy == "reject-provider-action-\(card.approvalId)"
  }

  private var executeBusy: Bool {
    model.busy == "execute-provider-action-\(card.approvalId)"
  }

  private var actionsDisabled: Bool {
    approveBusy || rejectBusy || executeBusy || model.providerApprovalInbox?.readOnly == true
  }
}

struct ApprovalDetailMetric: View {
  let label: String
  let value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(label.uppercased())
        .font(.system(size: 10, weight: .bold))
        .foregroundStyle(RCTheme.muted)
      Text(value)
        .font(
          .system(
            size: 12, weight: .semibold, design: label == "Payload hash" ? .monospaced : .default)
        )
        .foregroundStyle(RCTheme.text)
        .lineLimit(2)
        .truncationMode(.middle)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(12)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
  }
}

struct ApprovalInlineMeta: View {
  let label: String
  let value: String

  var body: some View {
    HStack(spacing: 5) {
      Text(label)
        .font(.system(size: 10, weight: .bold))
        .foregroundStyle(RCTheme.muted)
      Text(value)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(RCTheme.text)
        .lineLimit(1)
    }
    .padding(.horizontal, 8)
    .frame(height: 24)
    .background(RCTheme.surfaceInset.opacity(0.72))
    .clipShape(RoundedRectangle(cornerRadius: 4))
  }
}

func approvalStatusTone(_ status: ProviderActionApprovalCardStatus) -> ComponentTone {
  switch status {
  case .pending:
    return .amber
  case .approved:
    return .green
  case .executed:
    return .blue
  case .failed:
    return .red
  case .rejected, .cancelled:
    return .neutral
  case .expired:
    return .purple
  }
}

func executionStatusTone(_ status: ProviderActionExecutionStatus) -> ComponentTone {
  switch status {
  case .succeeded:
    return .green
  case .failed, .blocked:
    return .red
  case .pendingApproval, .approved:
    return .amber
  case .queued, .running, .autoExecuted:
    return .blue
  case .cancelled, .expired:
    return .neutral
  }
}

func providerApprovalExecutionMetric(card: ProviderActionApprovalCardState) -> String {
  guard let executionStatus = card.executionStatus else {
    return "Not executed"
  }
  return providerApprovalExecutionLabel(card: card, executionStatus: executionStatus)
}

func providerApprovalExecutionLabel(
  card: ProviderActionApprovalCardState,
  executionStatus: ProviderActionExecutionStatus
) -> String {
  if card.status == .failed, card.statusLabel == "Not posted to LinkedIn" {
    return card.statusLabel
  }
  return executionStatus.rawValue
}

func providerApprovalExecutionTone(
  card: ProviderActionApprovalCardState,
  executionStatus: ProviderActionExecutionStatus
) -> ComponentTone {
  if card.status == .failed {
    return .red
  }
  return executionStatusTone(executionStatus)
}
