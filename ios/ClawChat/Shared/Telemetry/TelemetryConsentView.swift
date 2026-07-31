import SwiftUI

@MainActor
struct TelemetryConsentView: View {
    @State private var productAnalyticsEnabled = false
    @State private var crashReportsEnabled = false
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
                            isOn: $productAnalyticsEnabled
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
                            isOn: $crashReportsEnabled
                        )
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Label(
                            "Both choices are off unless you actively enable them.",
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
                            productAnalyticsEnabled = true
                            crashReportsEnabled = true
                            save(productAnalytics: true, crashReports: true)
                        } label: {
                            Label(
                                isSaving ? "Saving choices…" : "Enable both and continue",
                                systemImage: isSaving ? "hourglass" : "heart.fill"
                            )
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                        .tint(ClawColors.accent)
                        .disabled(isSaving)
                        .accessibilityHint(
                            "Enables PostHog product analytics and Sentry crash reporting."
                        )

                        Button("Continue with my choices") {
                            save(
                                productAnalytics: productAnalyticsEnabled,
                                crashReports: crashReportsEnabled
                            )
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                        .frame(maxWidth: .infinity)
                        .disabled(isSaving)
                        .accessibilityHint("Saves both switches exactly as shown.")
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
        isOn: Binding<Bool>
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(isOn.wrappedValue ? ClawColors.accentGreen : ClawColors.accent)
                    .frame(width: 32, height: 32)
                    .background(
                        (isOn.wrappedValue ? ClawColors.accentGreen : ClawColors.accent)
                            .opacity(0.12)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .accessibilityHidden(true)

                Text(title)
                    .font(.headline)
                    .foregroundStyle(ClawColors.textPrimary)

                if available {
                    Text("RECOMMENDED")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(ClawColors.accentGreen)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(ClawColors.accentGreen.opacity(0.10))
                        .clipShape(Capsule())
                }

                Spacer()

                Toggle(title, isOn: isOn)
                    .labelsHidden()
                    .accessibilityLabel(title)
                    .disabled(!available)
            }

            Text(benefit)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(ClawColors.textPrimary)

            Text(detail)
                .font(.caption)
                .foregroundStyle(ClawColors.textSecondary)
        }
        .padding(16)
        .background(
            isOn.wrappedValue
                ? ClawColors.accentGreen.opacity(0.07)
                : ClawColors.backgroundCard
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(
                    isOn.wrappedValue
                        ? ClawColors.accentGreen.opacity(0.40)
                        : ClawColors.borderSoft,
                    lineWidth: 1
                )
        )
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
