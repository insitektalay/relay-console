// ClawTheme.swift
// ClawChat – Relay Console parity design system

import SwiftUI

// MARK: - Color Palette

enum RelayColors {
    // Backgrounds
    static let backgroundPrimary   = Color(hex: "#060809")
    static let backgroundRail      = Color(hex: "#090B0D")
    static let backgroundSecondary = Color(hex: "#0A0D10")
    static let backgroundTertiary  = Color(hex: "#111519")
    static let backgroundCard      = Color(hex: "#111519")
    static let backgroundInset     = Color(hex: "#0F1318")
    static let backgroundElevated  = Color(hex: "#1F2730")
    static let backgroundSurface   = Color(hex: "#1F2730")
    static let backgroundHover     = Color(hex: "#242C36")
    static let backgroundSelected  = Color(hex: "#1C2F45")
    static let backgroundSurfaceGreen = Color(hex: "#192628")

    // Text
    static let textPrimary   = Color(hex: "#DCD8CA")
    static let textSecondary = Color(hex: "#96999E")
    static let textTertiary  = Color(hex: "#777B80")
    static let textAccent    = Color(hex: "#508DD7")

    // Brand / Accent
    static let accent       = Color(hex: "#508DD7")
    static let accentGreen  = Color(hex: "#64D78D")
    static let accentRed    = Color(hex: "#E16F64")
    static let accentOrange = Color(hex: "#D6B967")
    static let accentPurple = Color(hex: "#9B8AD7")
    static let accentTeal   = Color(hex: "#55C6C7")
    static let accentGold   = Color(hex: "#B5A16F")
    static let accentSlate  = Color(hex: "#9AA6B2")

    // Status colours
    static let statusOnDuty  = Color(hex: "#64D78D")
    static let statusOffDuty = Color(hex: "#96999E")
    static let statusBusy    = Color(hex: "#D6B967")
    static let statusPaused  = Color(hex: "#9B8AD7")
    static let statusIdle    = Color(hex: "#B5A16F")
    static let statusError   = Color(hex: "#E16F64")

    // Thread type colours
    static let threadDirect       = Color(hex: "#508DD7")
    static let threadTeam         = Color(hex: "#64D78D")
    static let threadDepartment   = Color(hex: "#9B8AD7")
    static let threadAgentToAgent = Color(hex: "#55C6C7")
    static let threadSystem       = Color(hex: "#96999E")
    static let threadApproval     = Color(hex: "#D6B967")
    static let threadIncident     = Color(hex: "#E16F64")

    // Borders
    static let borderBase     = Color(hex: "#3B4147")
    static let borderLow      = borderBase.opacity(0.30)
    static let borderSoft     = borderBase.opacity(0.46)
    static let borderStandard = borderBase.opacity(0.62)
    static let borderStrong   = borderBase.opacity(0.78)
    static let borderFocus    = accent.opacity(0.68)
    static let separator      = borderStandard
    static let separatorLight = borderLow

    // Forms and chat
    static let fieldBackground = Color(hex: "#0F1317")
    static let chatCanvas = Color(hex: "#050607")
    static let chatChrome = Color(hex: "#0B0E11")
    static let chatComposer = Color(hex: "#0F1216")
    static let chatText = Color(hex: "#CDC9C2")
    static let chatTextStrong = Color(hex: "#E6DFD0")
    static let chatAccent = Color(hex: "#86B1E6")
    static let agentCardBackground = chatCanvas
    static let userCardBackground = Color(hex: "#20262D")
    static let agentCardBorder = Color.clear
    static let userCardBorder = borderStandard

    // Bubbles
    static let bubbleOutgoing = userCardBackground
    static let bubbleIncoming = agentCardBackground

    // Unread badge
    static let unreadBadge = Color(hex: "#508DD7")
}

// Transitional source compatibility: all existing consumers resolve to the one Relay family.
typealias ClawColors = RelayColors

// MARK: - Typography

enum RelayFonts {
    static let threadTitle     = Font.system(.subheadline, design: .default, weight: .semibold)
    static let threadSnippet   = Font.system(.subheadline, design: .default, weight: .regular)
    static let threadTimestamp = Font.system(.caption, design: .default, weight: .regular)

    static let messageBody      = Font.system(.body, design: .default, weight: .regular)
    static let messageTimestamp = Font.system(.caption2, design: .default, weight: .regular)

    static let sectionHeader = Font.system(.caption2, design: .default, weight: .semibold)
    static let cardTitle     = Font.system(.subheadline, design: .default, weight: .semibold)
    static let cardBody      = Font.system(.footnote, design: .default, weight: .regular)

    static let agentName = Font.system(.headline, design: .default, weight: .semibold)
    static let agentRole = Font.system(.subheadline, design: .default, weight: .regular)

    static let screenTitle     = Font.system(.headline, design: .default, weight: .semibold)
    static let navigationTitle = Font.system(.headline, design: .default, weight: .semibold)

    static let badge   = Font.system(.caption2, design: .default, weight: .semibold)
    static let caption = Font.system(.caption, design: .default, weight: .regular)
    static let label   = Font.system(.footnote, design: .default, weight: .medium)
}

typealias ClawFonts = RelayFonts

// MARK: - Spacing

enum RelaySpacing {
    static let xs:   CGFloat = 4
    static let sm:   CGFloat = 8
    static let md:   CGFloat = 12
    static let lg:   CGFloat = 16
    static let xl:   CGFloat = 20
    static let xxl:  CGFloat = 24
    static let xxxl: CGFloat = 32
}

typealias ClawSpacing = RelaySpacing

// MARK: - Corner Radius

enum RelayRadius {
    static let sm:          CGFloat = 4
    static let md:          CGFloat = 6
    static let lg:          CGFloat = 6
    static let xl:          CGFloat = 8
    static let bubble:      CGFloat = 6
    static let card:        CGFloat = 4
    static let avatar:      CGFloat = 22  // half of 44pt
    static let avatarLarge: CGFloat = 36  // half of 72pt
}

typealias ClawRadius = RelayRadius

enum RelayMetrics {
    static let minimumHitTarget: CGFloat = 44
    static let iconVisualSize: CGFloat = 30
    static let searchFieldHeight: CGFloat = 48
}

enum RelayBrand {
    static let productName = "Relay Console"
    static let shortName = "Relay"
}

// MARK: - ViewModifiers

struct ClawCardModifier: ViewModifier {
    var accentColor: Color = ClawColors.accent

    func body(content: Content) -> some View {
        content
            .background(ClawColors.backgroundCard)
            .cornerRadius(ClawRadius.card)
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.card)
                    .stroke(ClawColors.separator, lineWidth: 1)
            )
    }
}

struct ClawBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(ClawColors.backgroundPrimary)
    }
}

struct ShimmerModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    let gradient = LinearGradient(
                        gradient: Gradient(stops: [
                            .init(color: .clear, location: 0),
                            .init(color: .white.opacity(0.08), location: 0.35),
                            .init(color: .white.opacity(0.16), location: 0.5),
                            .init(color: .white.opacity(0.08), location: 0.65),
                            .init(color: .clear, location: 1)
                        ]),
                        startPoint: .init(x: phase - 0.5, y: 0),
                        endPoint:   .init(x: phase + 0.5, y: 0)
                    )
                    Rectangle()
                        .fill(gradient)
                        .frame(width: geo.size.width, height: geo.size.height)
                }
            )
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    phase = 1.5
                }
            }
    }
}

// MARK: - Global appearance configuration

enum ClawAppearance {
    @MainActor
    static func configure() {
        // Navigation Bar
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = UIColor(ClawColors.backgroundPrimary)
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor(ClawColors.textPrimary)]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor(ClawColors.textPrimary)]
        navAppearance.shadowColor = UIColor(ClawColors.separator)

        UINavigationBar.appearance().standardAppearance   = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance    = navAppearance
        UINavigationBar.appearance().tintColor            = UIColor(ClawColors.accent)

        // Tab Bar
        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = UIColor(ClawColors.backgroundSecondary)
        tabAppearance.stackedLayoutAppearance.selected.iconColor   = UIColor(ClawColors.accent)
        tabAppearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(ClawColors.accent)
        ]
        tabAppearance.stackedLayoutAppearance.normal.iconColor = UIColor(ClawColors.textTertiary)
        tabAppearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(ClawColors.textTertiary)
        ]

        // UITabBar appearance APIs are unreliable on iOS 26's redesigned tab bar;
        // tint/color is handled via SwiftUI .tint() instead.
        if #unavailable(iOS 26) {
            UITabBar.appearance().standardAppearance   = tabAppearance
            UITabBar.appearance().scrollEdgeAppearance = tabAppearance
        }

        // Table / List
        UITableView.appearance().backgroundColor     = UIColor(ClawColors.backgroundPrimary)
        UITableViewCell.appearance().backgroundColor = UIColor(ClawColors.backgroundPrimary)
    }
}
