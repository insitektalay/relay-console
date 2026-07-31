import SwiftUI

struct TelemetryConsentOnboardingView: View {
    @EnvironmentObject private var model: AppViewModel
    @State private var productAnalyticsEnabled = false
    @State private var crashReportingEnabled = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.72)
                .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header

                    VStack(spacing: 12) {
                        TelemetryConsentOption(
                            icon: "chart.line.uptrend.xyaxis",
                            title: "Share product analytics",
                            benefit:
                                "Share basic usage data to help improve Relay.",
                            detail:
                                model.productAnalyticsAvailable
                                    ? "Messages, files, credentials, and URLs are never included."
                                    : "Unavailable in this build",
                            isRecommended: model.productAnalyticsAvailable,
                            isAvailable: model.productAnalyticsAvailable,
                            isOn: $productAnalyticsEnabled
                        )

                        TelemetryConsentOption(
                            icon: "stethoscope",
                            title: "Share crash and error reports",
                            benefit:
                                "Share crash and error data to help improve stability.",
                            detail:
                                model.crashReportingAvailable
                                    ? "Screenshots, messages, files, and email are never included."
                                    : "Unavailable in this build",
                            isRecommended: model.crashReportingAvailable,
                            isAvailable: model.crashReportingAvailable,
                            isOn: $crashReportingEnabled
                        )
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Label(
                            "Both choices are off unless you actively enable them.",
                            systemImage: "lock.shield"
                        )
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(RCTheme.text)

                        Text(
                            "You can use every Relay feature either way and change either choice later in Settings → Account."
                        )
                        .font(.system(size: 12))
                        .foregroundStyle(RCTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)

                        Link(
                            "Read Relay’s privacy policy",
                            destination: URL(string: "https://relayconsole.work/privacy")!
                        )
                        .font(.system(size: 12, weight: .semibold))
                    }

                    if let error = model.telemetryChoiceError {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(RCTheme.accentRed)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityLabel("Unable to save privacy choices. \(error)")
                    }

                    HStack(spacing: 10) {
                        Button {
                            productAnalyticsEnabled = true
                            crashReportingEnabled = true
                            model.completeTelemetryChoice(
                                productAnalytics: true,
                                crashReporting: true
                            )
                        } label: {
                            if model.telemetryChoiceSaving {
                                ProgressView()
                                    .controlSize(.small)
                                Text("Saving choices…")
                            } else {
                                Image(systemName: "heart.fill")
                                Text("Enable both and continue")
                            }
                        }
                        .buttonStyle(PrimaryLightButtonStyle())
                        .disabled(model.telemetryChoiceSaving)
                        .keyboardShortcut(.defaultAction)
                        .accessibilityHint(
                            "Enables PostHog product analytics and Sentry crash reporting, then continues."
                        )

                        Button("Continue with my choices") {
                            model.completeTelemetryChoice(
                                productAnalytics: productAnalyticsEnabled,
                                crashReporting: crashReportingEnabled
                            )
                        }
                        .buttonStyle(SecondaryLightButtonStyle())
                        .disabled(model.telemetryChoiceSaving)
                        .accessibilityHint(
                            "Saves the two switches exactly as shown, then continues."
                        )

                        Spacer()
                    }
                }
                .padding(28)
                .frame(maxWidth: 720, alignment: .leading)
                .background(RCTheme.surfaceLevel1)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(RCTheme.borderStrong, lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.45), radius: 28, y: 14)
                .padding(.horizontal, 28)
                .padding(.vertical, 34)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .foregroundStyle(RCTheme.text)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Help improve Relay privacy choices")
        .accessibilityAddTraits(.isModal)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(RCTheme.accentBlue.opacity(0.16))
                Image(systemName: "sparkles")
                    .font(.system(size: 25, weight: .semibold))
                    .foregroundStyle(RCTheme.accentBlue)
            }
            .frame(width: 52, height: 52)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 7) {
                Text("Help us make Relay better")
                    .font(.system(size: 24, weight: .bold))

                Text(
                    "Sharing a small amount of privacy-safe diagnostics helps us focus on the improvements that matter and fix problems faster. Choose what you’re comfortable sharing."
                )
                .font(.system(size: 14))
                .foregroundStyle(RCTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private struct TelemetryConsentOption: View {
    let icon: String
    let title: String
    let benefit: String
    let detail: String
    let isRecommended: Bool
    let isAvailable: Bool
    @Binding var isOn: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(isOn ? RCTheme.accentGreen : RCTheme.accentBlue)
                .frame(width: 30, height: 30)
                .background(
                    (isOn ? RCTheme.accentGreen : RCTheme.accentBlue).opacity(0.12)
                )
                .clipShape(RoundedRectangle(cornerRadius: 7))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 8) {
                    Text(title)
                        .font(.system(size: 14, weight: .bold))

                    if isRecommended {
                        Text("RECOMMENDED")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(RCTheme.accentGreen)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(RCTheme.accentGreen.opacity(0.10))
                            .clipShape(Capsule())
                    }
                }

                Text(benefit)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(RCTheme.text)
                    .fixedSize(horizontal: false, vertical: true)

                Text(detail)
                    .font(.system(size: 11.5))
                    .foregroundStyle(RCTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 12)

            Toggle(title, isOn: $isOn)
                .labelsHidden()
                .toggleStyle(.switch)
                .disabled(!isAvailable)
                .accessibilityLabel(title)
                .accessibilityValue(isOn ? "On" : "Off")
        }
        .padding(16)
        .background(isOn ? RCTheme.accentGreen.opacity(0.07) : RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(
                    isOn ? RCTheme.accentGreen.opacity(0.40) : RCTheme.borderSoft,
                    lineWidth: 1
                )
        )
    }
}
