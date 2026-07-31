// LaunchView.swift
// ClawChat – App launch / splash screen
// Swift 6, iOS 18, SwiftUI

import SwiftUI

@MainActor
struct LaunchView: View {
    @EnvironmentObject private var appStore: AppStore
    let onFinished: () -> Void

    @State private var logoScale: CGFloat = 0.6
    @State private var logoOpacity: Double = 0
    @State private var wordmarkOpacity: Double = 0
    @State private var taglineOpacity: Double = 0
    @State private var clawRotation: Double = -20
    @State private var isAnimatingPulse: Bool = false
    @State private var didStartSessionCheck: Bool = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Claw icon
                ZStack {
                    // Glow ring
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color(hex: "#0A84FF").opacity(0.25), .clear],
                                center: .center,
                                startRadius: 30,
                                endRadius: 70
                            )
                        )
                        .frame(width: 140, height: 140)
                        .scaleEffect(isAnimatingPulse ? 1.15 : 1.0)
                        .animation(
                            .easeInOut(duration: 1.6).repeatForever(autoreverses: true),
                            value: isAnimatingPulse
                        )

                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color(hex: "#0A84FF"), Color(hex: "#005AC8")],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 88, height: 88)
                        .shadow(color: Color(hex: "#0A84FF").opacity(0.5), radius: 24, x: 0, y: 8)

                    Image(systemName: "pawprint.fill")
                        .font(.system(size: 40, weight: .bold))
                        .foregroundStyle(.white)
                        .rotationEffect(.degrees(clawRotation))
                }
                .scaleEffect(logoScale)
                .opacity(logoOpacity)

                Spacer().frame(height: 28)

                // Wordmark
                Text("Relay Console")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .opacity(wordmarkOpacity)

                Spacer().frame(height: 8)

                // Tagline
                Text("Your AI Workforce, In Your Pocket")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(Color.white.opacity(0.5))
                    .opacity(taglineOpacity)

                Spacer()

                // Bottom version
                Text("Relay Console")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.white.opacity(0.2))
                    .padding(.bottom, 40)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            runEntryAnimation()
        }
    }

    // MARK: - Animation + Session Check

    private func runEntryAnimation() {
        // Logo entrance
        withAnimation(.spring(response: 0.6, dampingFraction: 0.7, blendDuration: 0)) {
            logoScale = 1.0
            logoOpacity = 1.0
            clawRotation = -15
        }

        // Wordmark fade-in
        withAnimation(.easeOut(duration: 0.4).delay(0.3)) {
            wordmarkOpacity = 1.0
        }

        // Tagline
        withAnimation(.easeOut(duration: 0.4).delay(0.5)) {
            taglineOpacity = 1.0
        }

        // Start pulse
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            isAnimatingPulse = true
        }

        guard !didStartSessionCheck else { return }
        didStartSessionCheck = true

        _Concurrency.Task { @MainActor in
            try? await _Concurrency.Task.sleep(for: .milliseconds(900))
            await checkSession()
        }
    }

    private func checkSession() async {
        let restoreTask = _Concurrency.Task { @MainActor in
            try await appStore.restoreSession()
        }

        let hasSession: Bool
        do {
            hasSession = try await withThrowingTaskGroup(of: Bool.self) { group in
                group.addTask {
                    try await restoreTask.value
                }
                group.addTask {
                    try await _Concurrency.Task.sleep(for: .seconds(3))
                    throw CancellationError()
                }

                let result = try await group.next() ?? false
                group.cancelAll()
                restoreTask.cancel()
                return result
            }
        } catch {
            restoreTask.cancel()
            appStore.logout()
            onFinished()
            return
        }

        if !hasSession {
            onFinished()
        }
    }
}

#Preview {
    LaunchView(onFinished: {})
        .environmentObject(AppStore.preview)
        .environment(AppCoordinator.preview)
}
