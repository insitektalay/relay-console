// PairingView.swift
// Relay Console – user-managed runtime bridge guidance

import SwiftUI

/// Retained as a compatibility destination for older navigation state. Runtime
/// pairing is completed by the separately installed Relay bridge, which
/// connects outbound through Relay and never asks the iOS app for a runtime
/// URL or API key.
struct PairingView: View {
    var body: some View {
        ZStack {
            ClawColors.backgroundPrimary.ignoresSafeArea()

            VStack(spacing: ClawSpacing.lg) {
                Image(systemName: "link.badge.plus")
                    .font(.system(size: 40))
                    .foregroundStyle(ClawColors.accent)

                Text("Connect a runtime bridge")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(ClawColors.textPrimary)

                Text("Install the Relay bridge beside your customer-operated Hermes Agent or OpenClaw runtime. The bridge pairs securely and connects outbound through Relay, so you do not expose a public runtime URL or enter its API key here.")
                    .font(.system(size: 15))
                    .foregroundStyle(ClawColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)

                Link("Open bridge installation guide", destination: URL(string: "https://relayconsole.work/install")!)
                    .buttonStyle(.borderedProminent)
                    .tint(ClawColors.accent)
            }
            .padding(ClawSpacing.xl)
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    PairingView()
}
