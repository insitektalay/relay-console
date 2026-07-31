// LoadingView.swift
// ClawChat

import SwiftUI

// MARK: - LoadingView

struct RelayLoadingState: View {
    var message: String? = nil
    var tint: Color = ClawColors.accent

    var body: some View {
        VStack(spacing: ClawSpacing.md) {
            ProgressView()
                .progressViewStyle(.circular)
                .tint(tint)
                .scaleEffect(1.2)

            if let message {
                Text(message)
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel(message ?? "Loading")
        .accessibilityAddTraits(.updatesFrequently)
    }
}

typealias LoadingView = RelayLoadingState

// MARK: - Skeleton shapes

struct SkeletonLine: View {
    var width: CGFloat? = nil   // nil = fill width
    var height: CGFloat = 14
    var cornerRadius: CGFloat = 6

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(ClawColors.backgroundTertiary)
            .frame(width: width, height: height)
            .shimmer()
    }
}

struct SkeletonCircle: View {
    var diameter: CGFloat = 44

    var body: some View {
        Circle()
            .fill(ClawColors.backgroundTertiary)
            .frame(width: diameter, height: diameter)
            .shimmer()
    }
}

struct SkeletonRect: View {
    var width: CGFloat? = nil
    var height: CGFloat = 80
    var cornerRadius: CGFloat = ClawRadius.card

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(ClawColors.backgroundTertiary)
            .frame(width: width, height: height)
            .shimmer()
    }
}

// MARK: - Thread list skeleton row

struct SkeletonThreadRow: View {
    var body: some View {
        HStack(spacing: ClawSpacing.md) {
            SkeletonCircle(diameter: 44)

            VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                HStack {
                    SkeletonLine(width: 120, height: 14)
                    Spacer()
                    SkeletonLine(width: 32, height: 10)
                }
                SkeletonLine(width: nil, height: 12)
                SkeletonLine(width: 160, height: 12)
            }
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.sm)
    }
}

// MARK: - Agent card skeleton

struct SkeletonAgentCard: View {
    var body: some View {
        HStack(spacing: ClawSpacing.md) {
            SkeletonCircle(diameter: 52)

            VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                SkeletonLine(width: 140, height: 16)
                SkeletonLine(width: 90, height: 12)
                SkeletonLine(width: 60, height: 10)
            }

            Spacer()
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
    }
}

// MARK: - Thread list skeleton screen

struct SkeletonThreadList: View {
    var count: Int = 8

    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<count, id: \.self) { _ in
                SkeletonThreadRow()
                Divider()
                    .background(ClawColors.separator)
                    .padding(.leading, 74)
            }
        }
    }
}

// MARK: - ViewModifier for overlay skeleton

struct SkeletonOverlayModifier: ViewModifier {
    let isLoading: Bool

    func body(content: Content) -> some View {
        content
            .redacted(reason: isLoading ? .placeholder : [])
            .if(isLoading) { view in
                view.shimmer()
            }
    }
}

extension View {
    /// Applies redacted placeholder + shimmer when `isLoading` is true.
    func skeletonLoading(_ isLoading: Bool) -> some View {
        modifier(SkeletonOverlayModifier(isLoading: isLoading))
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: ClawSpacing.xl) {
            LoadingView(message: "Loading workspace...")

            Divider().background(ClawColors.separator)

            SkeletonThreadList(count: 5)

            Divider().background(ClawColors.separator)

            VStack(spacing: ClawSpacing.sm) {
                ForEach(0..<3, id: \.self) { _ in
                    SkeletonAgentCard()
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
        }
    }
    .background(ClawColors.backgroundPrimary)
}
