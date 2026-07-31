// View+Extensions.swift
// ClawChat

import SwiftUI

// MARK: - UIRectCorner bridging

struct RoundedCorner: Shape {
    var radius: CGFloat
    var corners: UIRectCorner

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

// MARK: - View extensions

extension View {

    // MARK: Card styling

    /// Applies the standard ClawChat card background with separator border.
    func clawCard(accentColor: Color = ClawColors.accent) -> some View {
        modifier(ClawCardModifier(accentColor: accentColor))
    }

    /// Fills the view's background with the primary app background colour.
    func clawBackground() -> some View {
        modifier(ClawBackgroundModifier())
    }

    // MARK: Keyboard

    /// Dismisses the software keyboard on tap.
    func hideKeyboard() -> some View {
        onTapGesture {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil, from: nil, for: nil
            )
        }
    }

    /// Adds one app-wide keyboard accessory with a clear dismissal action.
    func clawKeyboardDismissable() -> some View {
        toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder),
                        to: nil,
                        from: nil,
                        for: nil
                    )
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(ClawColors.accent)
            }
        }
    }

    // MARK: Partial corner radius

    /// Rounds only the specified corners.
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }

    // MARK: Shimmer

    /// Adds a shimmer animation — use while content is loading.
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }

    // MARK: Conditional modifier

    /// Applies a transform only when `condition` is true.
    @ViewBuilder
    func `if`<Content: View>(
        _ condition: Bool,
        transform: (Self) -> Content
    ) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

    /// Applies one of two transforms depending on `condition`.
    @ViewBuilder
    func ifElse<TrueContent: View, FalseContent: View>(
        _ condition: Bool,
        ifTransform: (Self) -> TrueContent,
        elseTransform: (Self) -> FalseContent
    ) -> some View {
        if condition {
            ifTransform(self)
        } else {
            elseTransform(self)
        }
    }

    /// Applies a transform only when the optional `value` is non-nil,
    /// passing the unwrapped value into the closure.
    @ViewBuilder
    func ifLet<T, Content: View>(
        _ value: T?,
        transform: (Self, T) -> Content
    ) -> some View {
        if let value {
            transform(self, value)
        } else {
            self
        }
    }

    // MARK: Frame helpers

    /// Expands the view to fill the maximum available width.
    func fillWidth(alignment: Alignment = .center) -> some View {
        frame(maxWidth: .infinity, alignment: alignment)
    }

    /// Expands the view to fill the maximum available height.
    func fillHeight(alignment: Alignment = .center) -> some View {
        frame(maxHeight: .infinity, alignment: alignment)
    }

    // MARK: Tap area

    /// Enlarges the tappable hit area without changing visual size.
    func tapArea(_ size: CGFloat = 44) -> some View {
        contentShape(Rectangle())
            .frame(minWidth: size, minHeight: size)
    }
}
