import SwiftUI

enum AgentFileToolbarActionKind: String, CaseIterable, Identifiable {
    case new
    case upload
    case download
    case link
    case edit
    case save
    case pull
    case push
    case baselines
    case delete

    var id: String { rawValue }

    var title: String {
        switch self {
        case .new:
            return "New"
        case .upload:
            return "Upload"
        case .download:
            return "Download"
        case .link:
            return "Link"
        case .edit:
            return "Edit"
        case .save:
            return "Save"
        case .pull:
            return "Pull"
        case .push:
            return "Push"
        case .baselines:
            return "Baselines"
        case .delete:
            return "Delete"
        }
    }

    var systemImage: String {
        switch self {
        case .new:
            return "plus"
        case .upload:
            return "square.and.arrow.up"
        case .download:
            return "square.and.arrow.down"
        case .link:
            return "link"
        case .edit:
            return "pencil"
        case .save:
            return "checkmark"
        case .pull:
            return "arrow.down.doc"
        case .push:
            return "arrow.up.doc"
        case .baselines:
            return "slider.horizontal.3"
        case .delete:
            return "trash"
        }
    }

    var help: String {
        switch self {
        case .new:
            return "Create new markdown"
        case .upload:
            return "Upload markdown"
        case .download:
            return "Download selected item"
        case .link:
            return "Change linked local file"
        case .edit:
            return "Edit markdown"
        case .save:
            return "Save file"
        case .pull:
            return "Sync from local"
        case .push:
            return "Sync to local"
        case .baselines:
            return "Apply canonical baseline"
        case .delete:
            return "Delete selected item"
        }
    }

    var accentColor: Color {
        switch self {
        case .new:
            return RCTheme.accentBlue
        case .upload:
            return RCTheme.accentGreen
        case .download:
            return RCTheme.accentPurple
        case .link:
            return RCTheme.accentAmber
        case .edit:
            return Color(red: 0.306, green: 0.741, blue: 0.839)
        case .save:
            return Color(red: 0.533, green: 0.851, blue: 0.659)
        case .pull:
            return Color(red: 0.412, green: 0.612, blue: 0.902)
        case .push:
            return Color(red: 0.890, green: 0.561, blue: 0.318)
        case .baselines:
            return Color(red: 0.804, green: 0.494, blue: 0.843)
        case .delete:
            return RCTheme.accentRed
        }
    }
}

struct AgentFileToolbarAction: Identifiable {
    let kind: AgentFileToolbarActionKind
    var isDisabled = false
    var isActive = false
    var action: () -> Void

    var id: AgentFileToolbarActionKind { kind }
}

struct AgentFileToolbar: View {
    var leadingActions: [AgentFileToolbarAction]
    var trailingActions: [AgentFileToolbarAction]
    var iconOnly = false
    var colorized = false

    var body: some View {
        if leadingActions.isEmpty && trailingActions.isEmpty {
            EmptyView()
        } else {
            GeometryReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: AgentFileToolbarMetrics.spacing) {
                        toolbarGroup(leadingActions)
                        if !trailingActions.isEmpty {
                            Spacer(minLength: leadingActions.isEmpty ? 0 : AgentFileToolbarMetrics.groupSpacing)
                            toolbarGroup(trailingActions)
                        }
                    }
                    .frame(minWidth: proxy.size.width, alignment: .leading)
                    .padding(.vertical, 1)
                }
            }
            .frame(height: AgentFileToolbarMetrics.height + 2)
        }
    }

    @ViewBuilder
    private func toolbarGroup(_ actions: [AgentFileToolbarAction]) -> some View {
        ForEach(actions) { action in
            AgentFileToolbarButton(action: action, iconOnly: iconOnly, colorized: colorized)
        }
    }
}

private struct AgentFileToolbarButton: View {
    let action: AgentFileToolbarAction
    let iconOnly: Bool
    let colorized: Bool

    var body: some View {
        Button(role: action.kind == .delete ? .destructive : nil, action: action.action) {
            if iconOnly {
                Image(systemName: action.kind.systemImage)
                    .font(.system(size: 12, weight: .semibold))
                    .frame(width: 16, height: 16)
            } else {
                HStack(spacing: 6) {
                    Image(systemName: action.kind.systemImage)
                        .font(.system(size: 12, weight: .semibold))
                        .frame(width: 14)
                    Text(action.kind.title)
                        .font(.system(size: 12, weight: .semibold))
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
        }
        .buttonStyle(
            AgentFileToolbarButtonStyle(
                role: role,
                isActive: action.isActive,
                tint: colorized ? action.kind.accentColor : nil,
                iconOnly: iconOnly
            )
        )
        .disabled(action.isDisabled)
        .help(action.kind.help)
        .accessibilityLabel(action.kind.help)
    }

    private var role: AgentFileToolbarButtonStyle.Role {
        action.kind == .delete ? .destructive : .normal
    }
}

struct AgentFileToolbarButtonStyle: ButtonStyle {
    enum Role {
        case normal
        case destructive
    }

    @Environment(\.isEnabled) private var isEnabled

    var role: Role
    var isActive: Bool
    var tint: Color? = nil
    var iconOnly = false

    func makeBody(configuration: Configuration) -> some View {
        RCHoverFocusReader { state in
            configuration.label
                .frame(width: iconOnly ? AgentFileToolbarMetrics.iconSize : nil, height: AgentFileToolbarMetrics.height)
                .padding(.horizontal, iconOnly ? 0 : 10)
                .foregroundStyle(foregroundColor(isHovered: state.isHovered, isFocused: state.isFocused))
                .background(
                    backgroundColor(
                        isPressed: configuration.isPressed,
                        isHovered: state.isHovered,
                        isFocused: state.isFocused
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(
                            borderColor(
                                isPressed: configuration.isPressed,
                                isHovered: state.isHovered,
                                isFocused: state.isFocused
                            ),
                            lineWidth: state.isFocused ? 1.4 : 1
                        )
                )
                .contentShape(RoundedRectangle(cornerRadius: 6))
                .opacity(isEnabled ? 1 : 0.55)
                .animation(state.animation, value: configuration.isPressed)
        }
    }

    private func foregroundColor(isHovered: Bool, isFocused: Bool) -> Color {
        guard isEnabled else { return RCTheme.muted }
        if let tint {
            return tint
        }
        switch role {
        case .normal:
            return isActive || isHovered || isFocused ? RCTheme.accentBlue : RCTheme.text
        case .destructive:
            return RCTheme.accentRed
        }
    }

    private func backgroundColor(isPressed: Bool, isHovered: Bool, isFocused: Bool) -> Color {
        guard isEnabled else { return RCTheme.surfaceInset }
        let interactive = isPressed || isHovered || isFocused
        if let tint {
            return tint.opacity(interactive || isActive ? 0.22 : 0.12)
        }
        switch role {
        case .normal:
            if isActive {
                return RCTheme.accentBlue.opacity(isPressed ? 0.18 : 0.12)
            }
            return interactive ? RCTheme.surfaceHover : RCTheme.sidebarSurfaceAlt
        case .destructive:
            return RCTheme.accentRed.opacity(interactive ? 0.18 : 0.10)
        }
    }

    private func borderColor(isPressed: Bool, isHovered: Bool, isFocused: Bool) -> Color {
        guard isEnabled else { return RCTheme.borderSoft }
        if isFocused {
            return RCTheme.accentBlue.opacity(0.68)
        }
        let interactive = isPressed || isHovered
        if let tint {
            return tint.opacity(interactive || isActive ? 0.52 : 0.30)
        }
        switch role {
        case .normal:
            if isActive {
                return RCTheme.accentBlue.opacity(0.45)
            }
            return interactive ? RCTheme.borderStrong : RCTheme.borderSoft
        case .destructive:
            return RCTheme.accentRed.opacity(interactive ? 0.45 : 0.32)
        }
    }
}

private enum AgentFileToolbarMetrics {
    static let height: CGFloat = 30
    static let iconSize: CGFloat = 36
    static let spacing: CGFloat = 8
    static let groupSpacing: CGFloat = 16
}
