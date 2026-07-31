// RegisterView.swift
// ClawChat – Auth: Registration screen
// Swift 6, iOS 18, SwiftUI, dark-first design

import SwiftUI

@MainActor
struct RegisterView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator

    @State private var name: String = ""
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var confirmPassword: String = ""
    @State private var inviteCode: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil
    @FocusState private var focusedField: RegisterField?

    private enum RegisterField: Hashable {
        case name, email, password, confirmPassword, inviteCode
    }

    // MARK: - Validation

    private var nameValid: Bool {
        name.trimmingCharacters(in: .whitespaces).count >= 2
    }

    private var emailValid: Bool {
        let pattern = #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }

    private var passwordValid: Bool {
        password.count >= 8
    }

    private var passwordsMatch: Bool {
        password == confirmPassword && !confirmPassword.isEmpty
    }

    private var canSubmit: Bool {
        nameValid && emailValid && passwordValid && passwordsMatch
            && !inviteCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isLoading
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            ClawColors.backgroundPrimary.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 24)

                    // Header
                    headerSection

                    Spacer().frame(height: RelaySpacing.xl)

                    // Form
                    formSection
                        .padding(.horizontal, 24)

                    Spacer().frame(height: 32)

                    // Back to login
                    loginLink
                }
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .preferredColorScheme(.dark)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: { coordinator.navigate(to: .login) }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                        Text("Sign In")
                            .font(.system(size: 16))
                    }
                    .foregroundStyle(ClawColors.accent)
                }
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: RelaySpacing.md) {
            RelayBrandLockup(compact: true)
            Text("Create Account")
                .font(RelayFonts.screenTitle)
                .foregroundStyle(RelayColors.textPrimary)

            Text("Create secure access to Relay Console")
                .font(RelayFonts.cardBody)
                .foregroundStyle(RelayColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }

    // MARK: - Form

    private var formSection: some View {
        VStack(spacing: 12) {
            // Name
            inputField(
                label: "Full Name",
                icon: "person",
                placeholder: "Alex Smith",
                text: $name,
                field: .name,
                next: .email,
                contentType: .name,
                validation: name.isEmpty ? nil : (nameValid ? nil : "Name must be at least 2 characters")
            )

            // Email
            inputField(
                label: "Email",
                icon: "envelope",
                placeholder: "you@company.com",
                text: $email,
                field: .email,
                next: .password,
                keyboard: .emailAddress,
                contentType: .emailAddress,
                validation: email.isEmpty ? nil : (emailValid ? nil : "Enter a valid email address")
            )

            // Password
            secureInputField(
                label: "Password",
                icon: "lock",
                placeholder: "Minimum 8 characters",
                text: $password,
                field: .password,
                next: .confirmPassword,
                contentType: .newPassword,
                validation: password.isEmpty ? nil : (passwordValid ? nil : "Password must be at least 8 characters")
            )

            // Confirm Password
            secureInputField(
                label: "Confirm Password",
                icon: "lock.rotation",
                placeholder: "Re-enter your password",
                text: $confirmPassword,
                field: .confirmPassword,
                next: .inviteCode,
                contentType: .newPassword,
                validation: confirmPassword.isEmpty ? nil : (passwordsMatch ? nil : "Passwords do not match")
            )

            inputField(
                label: "Beta Invite Code",
                icon: "ticket",
                placeholder: "Enter your Relay beta invite code",
                text: $inviteCode,
                field: .inviteCode,
                next: nil,
                validation: inviteCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ? "A beta invite code is required"
                    : nil,
                submitAction: attemptRegister
            )

            // Error
            if let error = errorMessage {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.accentRed)
                    Text(error)
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.accentRed)
                    Spacer()
                }
                .padding(.top, 4)
                .transition(.move(edge: .top).combined(with: .opacity))
            }

            Spacer().frame(height: 8)

            Button(action: attemptRegister) {
                HStack(spacing: RelaySpacing.sm) {
                    if isLoading { ProgressView().controlSize(.small) }
                    Text(isLoading ? "Creating Account" : "Create Account")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(RelayButtonStyle(size: .md, variant: .primary))
            .disabled(!canSubmit)
            .opacity(canSubmit ? 1 : 0.8)
        }
    }

    // MARK: - Login Link

    private var loginLink: some View {
        HStack(spacing: 4) {
            Text("Already have an account?")
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.textSecondary)

            Button("Sign In") {
                coordinator.navigate(to: .login)
            }
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(ClawColors.accent)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
    }

    // MARK: - Field Builders

    @ViewBuilder
    private func inputField(
        label: String,
        icon: String,
        placeholder: String,
        text: Binding<String>,
        field: RegisterField,
        next: RegisterField?,
        keyboard: UIKeyboardType = .default,
        contentType: UITextContentType? = nil,
        validation: String? = nil,
        submitAction: (() -> Void)? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(ClawColors.textSecondary)

            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 15))
                    .foregroundStyle(ClawColors.textSecondary)
                    .frame(width: 20)

                TextField(placeholder, text: text)
                    .keyboardType(keyboard)
                    .textContentType(contentType)
                    .autocapitalization(keyboard == .emailAddress ? .none : .words)
                    .autocorrectionDisabled(keyboard == .emailAddress)
                    .foregroundStyle(ClawColors.textPrimary)
                    .focused($focusedField, equals: field)
                    .submitLabel(next == nil ? .done : .next)
                    .onSubmit {
                        if let next { focusedField = next }
                        else { submitAction?() }
                    }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(ClawColors.backgroundSecondary)
            .clipShape(RoundedRectangle(cornerRadius: ClawRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.md)
                    .stroke(fieldBorderColor(field: field, hasError: validation != nil), lineWidth: fieldBorderWidth(field: field))
            )
            .animation(.easeInOut(duration: 0.15), value: focusedField)

            if let validation {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 11))
                    Text(validation)
                        .font(.system(size: 11))
                }
                .foregroundStyle(ClawColors.accentRed)
                .transition(.opacity)
            }
        }
    }

    @ViewBuilder
    private func secureInputField(
        label: String,
        icon: String,
        placeholder: String,
        text: Binding<String>,
        field: RegisterField,
        next: RegisterField?,
        contentType: UITextContentType? = nil,
        validation: String? = nil,
        submitAction: (() -> Void)? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(ClawColors.textSecondary)

            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 15))
                    .foregroundStyle(ClawColors.textSecondary)
                    .frame(width: 20)

                SecureField(placeholder, text: text)
                    .textContentType(contentType)
                    .foregroundStyle(ClawColors.textPrimary)
                    .focused($focusedField, equals: field)
                    .submitLabel(next == nil ? .done : .next)
                    .onSubmit {
                        if let next { focusedField = next }
                        else { submitAction?() }
                    }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(ClawColors.backgroundSecondary)
            .clipShape(RoundedRectangle(cornerRadius: ClawRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.md)
                    .stroke(fieldBorderColor(field: field, hasError: validation != nil), lineWidth: fieldBorderWidth(field: field))
            )
            .animation(.easeInOut(duration: 0.15), value: focusedField)

            if let validation {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 11))
                    Text(validation)
                        .font(.system(size: 11))
                }
                .foregroundStyle(ClawColors.accentRed)
                .transition(.opacity)
            }
        }
    }

    private func fieldBorderColor(field: RegisterField, hasError: Bool) -> Color {
        if hasError { return ClawColors.accentRed.opacity(0.8) }
        if focusedField == field { return ClawColors.accent }
        return ClawColors.separator
    }

    private func fieldBorderWidth(field: RegisterField) -> CGFloat {
        focusedField == field ? 1.5 : 0.5
    }

    // MARK: - Action

    private func attemptRegister() {
        guard canSubmit else { return }
        focusedField = nil
        isLoading = true
        errorMessage = nil

        _Concurrency.Task { @MainActor in
            do {
                try await appStore.register(
                    name: name.trimmingCharacters(in: .whitespaces),
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password,
                    inviteCode: inviteCode.trimmingCharacters(in: .whitespacesAndNewlines)
                )
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
    NavigationStack {
        RegisterView()
            .environmentObject(AppStore.preview)
            .environment(AppCoordinator.preview)
    }
}
