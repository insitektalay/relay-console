// LoginView.swift
// ClawChat – Auth: Login screen
// Swift 6, iOS 18, SwiftUI, dark-first design

import SwiftUI

enum LoginFormDefaults {
    static let email = ""
    static let password = ""
}

@MainActor
struct LoginView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator

    @State private var email: String = LoginFormDefaults.email
    @State private var password: String = LoginFormDefaults.password
    @State private var isPasswordVisible: Bool = false
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil
    @FocusState private var focusedField: LoginField?

    private enum LoginField: Hashable {
        case email, password
    }

    var body: some View {
        ZStack {
            RelayColors.backgroundPrimary.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: RelaySpacing.xxxl)

                    // MARK: Logo + Tagline
                    logoSection

                    Spacer().frame(height: RelaySpacing.xl)

                    // MARK: Form
                    formSection
                        .padding(.horizontal, RelaySpacing.xl)

                    Spacer().frame(height: 32)

                    // MARK: Register Link
                    registerLink
                }
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Logo Section

    private var logoSection: some View {
        VStack(spacing: 14) {
            RelayBrandLockup()

            Text("Secure access to your Relay workspace")
                .font(RelayFonts.cardBody)
                .foregroundStyle(RelayColors.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Form Section

    private var formSection: some View {
        RelayPanel {
            // Email field
            VStack(alignment: .leading, spacing: 6) {
                Text("Email")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(ClawColors.textSecondary)

                HStack(spacing: 10) {
                    Image(systemName: "envelope")
                        .font(.system(size: 15))
                        .foregroundStyle(ClawColors.textSecondary)
                        .frame(width: 20)

                    TextField("Email address", text: $email)
                        .font(.body)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .foregroundStyle(ClawColors.textPrimary)
                        .focused($focusedField, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .password }
                        .padding(.vertical, 6)
                        .accessibilityLabel("Email")
                        .accessibilityIdentifier("login-email")
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 14)
                .background(ClawColors.backgroundSecondary)
                .clipShape(RoundedRectangle(cornerRadius: ClawRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: ClawRadius.md)
                        .stroke(
                            focusedField == .email ? ClawColors.accent : ClawColors.separator,
                            lineWidth: focusedField == .email ? 1.5 : 0.5
                        )
                )
                .animation(.easeInOut(duration: 0.15), value: focusedField)
            }

            // Password field
            VStack(alignment: .leading, spacing: 6) {
                Text("Password")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(ClawColors.textSecondary)

                HStack(spacing: 10) {
                    Image(systemName: "lock")
                        .font(.system(size: 15))
                        .foregroundStyle(ClawColors.textSecondary)
                        .frame(width: 20)

                    passwordInput

                    Button {
                        isPasswordVisible.toggle()
                        _Concurrency.Task { @MainActor in
                            focusedField = .password
                        }
                    } label: {
                        Image(systemName: isPasswordVisible ? "eye.slash" : "eye")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                    .buttonStyle(.plain)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
                    .accessibilityLabel(isPasswordVisible ? "Hide password" : "Show password")
                    .accessibilityIdentifier("login-password-visibility-toggle")
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(ClawColors.backgroundSecondary)
                .clipShape(RoundedRectangle(cornerRadius: ClawRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: ClawRadius.md)
                        .stroke(
                            focusedField == .password ? ClawColors.accent : ClawColors.separator,
                            lineWidth: focusedField == .password ? 1.5 : 0.5
                        )
                )
                .animation(.easeInOut(duration: 0.15), value: focusedField)
            }

            // Error message
            if let error = errorMessage {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(ClawColors.accentRed)
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(ClawColors.accentRed)
                        .multilineTextAlignment(.leading)
                    Spacer()
                }
                .padding(.top, 4)
                .transition(.move(edge: .top).combined(with: .opacity))
            }

            Spacer().frame(height: 8)

            Button(action: attemptLogin) {
                HStack(spacing: RelaySpacing.sm) {
                    if isLoading { ProgressView().controlSize(.small) }
                    Text(isLoading ? "Signing In" : "Sign In")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(RelayButtonStyle(size: .md, variant: .primary))
            .disabled(!canSubmit || isLoading)
            .opacity(canSubmit ? 1 : 0.8)
        }
    }

    // MARK: - Register Link

    private var registerLink: some View {
        HStack(spacing: 4) {
            Text("Don't have an account?")
                .font(RelayFonts.cardBody)
                .foregroundStyle(RelayColors.textSecondary)

            Button("Create Account") {
                coordinator.navigate(to: .register)
            }
            .font(RelayFonts.cardTitle)
            .foregroundStyle(RelayColors.accent)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    private var passwordInput: some View {
        Group {
            if isPasswordVisible {
                TextField("Password", text: $password)
            } else {
                SecureField("••••••••", text: $password)
            }
        }
        .font(.body)
        .textContentType(.password)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .foregroundStyle(ClawColors.textPrimary)
        .focused($focusedField, equals: .password)
        .submitLabel(.done)
        .onSubmit { attemptLogin() }
        .padding(.vertical, 6)
        .accessibilityLabel("Password")
        .accessibilityIdentifier("login-password")
    }

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty &&
        !password.isEmpty
    }

    private func attemptLogin() {
        guard canSubmit, !isLoading else { return }
        focusedField = nil
        isLoading = true
        errorMessage = nil

        _Concurrency.Task { @MainActor in
            do {
                try await appStore.login(email: email.trimmingCharacters(in: .whitespaces),
                                         password: password)
            } catch {
                withAnimation {
                    errorMessage = error.localizedDescription
                }
            }
            isLoading = false
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AppStore.preview)
        .environment(AppCoordinator.preview)
}
