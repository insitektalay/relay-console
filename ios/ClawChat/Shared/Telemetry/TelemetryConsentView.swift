import SwiftUI

@MainActor
struct TelemetryConsentView: View {
    @State private var productAnalyticsChoice: Bool?
    @State private var crashReportsChoice: Bool?
    @State private var isSaving = false

    var body: some View {
        ZStack {
            ClawColors.backgroundPrimary.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header

                    VStack(spacing: 14) {
                        consentOption(
                            icon: "chart.line.uptrend.xyaxis",
                            title: "Share product analytics",
                            benefit:
                                "Share basic usage data to help improve Relay.",
                            detail:
                                Telemetry.productAnalyticsAvailable
                                    ? "Messages, files, credentials, and URLs are never included."
                                    : "Unavailable in this build",
                            available: Telemetry.productAnalyticsAvailable,
                            selection: $productAnalyticsChoice
                        )

                        consentOption(
                            icon: "stethoscope",
                            title: "Share crash and error reports",
                            benefit:
                                "Share crash and error data to help improve stability.",
                            detail:
                                Telemetry.crashReportsAvailable
                                    ? "Screenshots, messages, files, and email are never included."
                                    : "Unavailable in this build",
                            available: Telemetry.crashReportsAvailable,
                            selection: $crashReportsChoice
                        )
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Label(
                            "Select Yes or No for each choice to continue.",
                            systemImage: "lock.shield"
                        )
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(ClawColors.textPrimary)

                        Text(
                            "Every Relay feature works either way. You can change either choice later in Settings."
                        )
                        .font(.footnote)
                        .foregroundStyle(ClawColors.textSecondary)

                        Link(
                            "Read Relay’s privacy policy",
                            destination: URL(string: "https://relayconsole.work/privacy")!
                        )
                        .font(.footnote.weight(.semibold))
                    }

                    VStack(spacing: 10) {
                        Button {
                            guard let productAnalyticsChoice, let crashReportsChoice else {
                                return
                            }
                            save(
                                productAnalytics: productAnalyticsChoice,
                                crashReports: crashReportsChoice
                            )
                        } label: {
                            Text(isSaving ? "Saving choices…" : "Continue")
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                        .tint(ClawColors.accent)
                        .disabled(
                            isSaving
                                || productAnalyticsChoice == nil
                                || crashReportsChoice == nil
                        )
                        .accessibilityHint(
                            "Saves both explicit privacy choices, then continues."
                        )
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 30)
                .frame(maxWidth: 680)
                .frame(maxWidth: .infinity)
            }
        }
        .preferredColorScheme(.dark)
        .interactiveDismissDisabled()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Help improve Relay privacy choices")
        .accessibilityAddTraits(.isModal)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(ClawColors.accent.opacity(0.16))
                Image(systemName: "sparkles")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(ClawColors.accent)
            }
            .frame(width: 58, height: 58)
            .accessibilityHidden(true)

            Text("Help us make Relay better")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(ClawColors.textPrimary)

            Text(
                "Sharing a small amount of privacy-safe diagnostics helps us focus on the improvements that matter and fix problems faster. Choose what you’re comfortable sharing."
            )
            .font(.body)
            .foregroundStyle(ClawColors.textSecondary)
        }
    }

    private func consentOption(
        icon: String,
        title: String,
        benefit: String,
        detail: String,
        available: Bool,
        selection: Binding<Bool?>
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(selection.wrappedValue == true ? ClawColors.accentGreen : ClawColors.accent)
                    .frame(width: 32, height: 32)
                    .background(
                        (selection.wrappedValue == true ? ClawColors.accentGreen : ClawColors.accent)
                            .opacity(0.12)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .accessibilityHidden(true)

                Text(title)
                    .font(.headline)
                    .foregroundStyle(ClawColors.textPrimary)

                Spacer()
            }

            Text(benefit)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(ClawColors.textPrimary)

            Text(detail)
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)

            HStack(spacing: 10) {
                choiceButton("Yes", value: true, selection: selection)
                    .disabled(!available)
                    .opacity(available ? 1 : 0.45)
                choiceButton("No", value: false, selection: selection)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel(title)
        }
        .padding(16)
        .background(
            selection.wrappedValue != nil
                ? ClawColors.accent.opacity(0.07)
                : ClawColors.backgroundCard
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(
                    selection.wrappedValue != nil
                        ? ClawColors.accent.opacity(0.40)
                        : ClawColors.borderSoft,
                    lineWidth: 1
                )
        )
    }

    private func choiceButton(
        _ label: String,
        value: Bool,
        selection: Binding<Bool?>
    ) -> some View {
        Button(label) {
            selection.wrappedValue = value
        }
        .buttonStyle(.plain)
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(selection.wrappedValue == value ? ClawColors.backgroundPrimary : ClawColors.textPrimary)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(selection.wrappedValue == value ? ClawColors.textPrimary : ClawColors.backgroundPrimary)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(ClawColors.borderSoft, lineWidth: 1)
        )
        .accessibilityAddTraits(selection.wrappedValue == value ? .isSelected : [])
    }

    private func save(productAnalytics: Bool, crashReports: Bool) {
        guard !isSaving else { return }
        isSaving = true
        Telemetry.savePrivacyPreferences(
            productAnalytics: productAnalytics,
            crashReports: crashReports
        )
    }
}
