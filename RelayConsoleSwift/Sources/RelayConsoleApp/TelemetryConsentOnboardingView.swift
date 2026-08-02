import SwiftUI

struct TelemetryConsentOnboardingView: View {
    @EnvironmentObject private var model: AppViewModel
    @State private var productAnalyticsChoice: Bool?
    @State private var crashReportingChoice: Bool?

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
                            isAvailable: model.productAnalyticsAvailable,
                            selection: $productAnalyticsChoice
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
                            isAvailable: model.crashReportingAvailable,
                            selection: $crashReportingChoice
                        )
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Label(
                            "Select Yes or No for each choice to continue.",
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
                            guard let productAnalyticsChoice, let crashReportingChoice else {
                                return
                            }
                            model.completeTelemetryChoice(
                                productAnalytics: productAnalyticsChoice,
                                crashReporting: crashReportingChoice
                            )
                        } label: {
                            if model.telemetryChoiceSaving {
                                ProgressView()
                                    .controlSize(.small)
                                Text("Saving choices…")
                            } else {
                                Text("Continue")
                            }
                        }
                        .buttonStyle(PrimaryLightButtonStyle())
                        .disabled(
                            model.telemetryChoiceSaving
                                || productAnalyticsChoice == nil
                                || crashReportingChoice == nil
                        )
                        .keyboardShortcut(.defaultAction)
                        .accessibilityHint(
                            "Saves both explicit privacy choices, then continues."
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
    let isAvailable: Bool
    @Binding var selection: Bool?

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(selection == true ? RCTheme.accentGreen : RCTheme.accentBlue)
                .frame(width: 30, height: 30)
                .background(
                    (selection == true ? RCTheme.accentGreen : RCTheme.accentBlue).opacity(0.12)
                )
                .clipShape(RoundedRectangle(cornerRadius: 7))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 7) {
                Text(title)
                    .font(.system(size: 14, weight: .bold))

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

            HStack(spacing: 8) {
                choiceButton("Yes", value: true, disabled: !isAvailable)
                choiceButton("No", value: false)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel(title)
        }
        .padding(16)
        .background(selection != nil ? RCTheme.accentBlue.opacity(0.07) : RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(
                    selection != nil ? RCTheme.accentBlue.opacity(0.40) : RCTheme.borderSoft,
                    lineWidth: 1
                )
        )
    }

    private func choiceButton(_ label: String, value: Bool, disabled: Bool = false) -> some View {
        Button(label) {
            selection = value
        }
        .buttonStyle(.plain)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(selection == value ? RCTheme.surfaceLevel0 : RCTheme.text)
        .frame(minWidth: 48)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(selection == value ? RCTheme.text : RCTheme.surfaceLevel1)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(
            RoundedRectangle(cornerRadius: 7)
                .stroke(RCTheme.borderStrong, lineWidth: 1)
        )
        .disabled(disabled)
        .opacity(disabled ? 0.45 : 1)
        .accessibilityAddTraits(selection == value ? .isSelected : [])
    }
}
