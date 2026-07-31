import Foundation
import StoreKit
import UIKit

struct RelaySignedDocument<Payload: Decodable & Sendable>: Decodable, Sendable {
    let payload: Payload
    let signature: String
    let algorithm: String
    let keyId: String
}

struct RelayCloudEntitlementLifecycle: Decodable, Sendable {
    let trialEndsAt: Date?
    let graceEndsAt: Date?
    let readOnlyAt: Date?
    let deletionEligibleAt: Date?
}

struct RelayCloudEntitlements: Decodable, Sendable {
    let schemaVersion: String
    let workspaceId: String
    let plan: String
    let status: String
    let mode: String
    let provider: String?
    let currentPeriodEndsAt: Date?
    let cancelAtPeriodEnd: Bool?
    let lifecycle: RelayCloudEntitlementLifecycle?
    let issuedAt: Date
    let expiresAt: Date?
}

@MainActor
final class RelayCloudSubscriptionStore: ObservableObject {
    enum State: Equatable {
        case loading
        case subscriptionRequired
        case purchasing
        case pending
        case active
        case grace
        case readOnly
        case unavailable
        case failed

        var title: String {
            switch self {
            case .loading: return "Checking Relay"
            case .subscriptionRequired: return "Relay available"
            case .purchasing: return "Completing purchase"
            case .pending: return "Purchase pending"
            case .active: return "Relay active"
            case .grace: return "Payment grace period"
            case .readOnly: return "Relay read-only"
            case .unavailable: return "App Store purchase unavailable"
            case .failed: return "Billing needs attention"
            }
        }
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var product: Product?
    @Published private(set) var entitlements: RelayCloudEntitlements?
    @Published private(set) var errorMessage: String?

    var subscriptionPeriodText: String? {
        guard let period = product?.subscription?.subscriptionPeriod else { return nil }
        let unit: String
        switch period.unit {
        case .day: unit = "day"
        case .week: unit = "week"
        case .month: unit = "month"
        case .year: unit = "year"
        @unknown default: return nil
        }
        return period.value == 1 ? unit : "\(period.value) \(unit)s"
    }

    private var workspaceId: String?
    private var updatesTask: _Concurrency.Task<Void, Never>?

    init() {
        updatesTask = _Concurrency.Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard let self else { return }
                await self.handle(transactionResult: result)
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    static var configuredProductID: String? {
        guard
            let value = Bundle.main.object(forInfoDictionaryKey: "RelayCloudProductID") as? String
        else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.hasPrefix("$(") else { return nil }
        return trimmed
    }

    func load(workspaceId: String) async {
        self.workspaceId = workspaceId
        state = .loading
        errorMessage = nil
        async let serverLoad: Void = loadServerEntitlements(workspaceId: workspaceId)
        async let productLoad: Void = loadProduct()
        _ = await (serverLoad, productLoad)
        applyServerState()
    }

    func purchase() async {
        guard let workspaceId, let workspaceUUID = UUID(uuidString: workspaceId) else {
            fail("The selected workspace cannot be linked to an App Store purchase.")
            return
        }
        guard let product else {
            fail("The Relay subscription is not currently available from the App Store.")
            return
        }
        guard entitlements?.provider != "stripe" else {
            fail("This subscription is managed through Relay web billing.")
            return
        }

        state = .purchasing
        errorMessage = nil
        do {
            let result = try await product.purchase(options: [.appAccountToken(workspaceUUID)])
            switch result {
            case .success(let verification):
                let transaction = try verified(verification)
                try await submit(
                    signedTransaction: verification.jwsRepresentation,
                    workspaceId: workspaceId
                )
                await transaction.finish()
            case .pending:
                state = .pending
            case .userCancelled:
                applyServerState()
            @unknown default:
                fail("The App Store returned an unsupported purchase result.")
            }
        } catch {
            fail(Self.message(for: error))
        }
    }

    func restorePurchases() async {
        guard let workspaceId else { return }
        state = .loading
        errorMessage = nil
        do {
            try await StoreKit.AppStore.sync()
            var restored = false
            for await result in StoreKit.Transaction.currentEntitlements {
                let transaction = try verified(result)
                guard transaction.productID == Self.configuredProductID else { continue }
                try await submit(
                    signedTransaction: result.jwsRepresentation,
                    workspaceId: workspaceId
                )
                await transaction.finish()
                restored = true
            }
            if !restored {
                await loadServerEntitlements(workspaceId: workspaceId)
                applyServerState()
            }
        } catch {
            fail(Self.message(for: error))
        }
    }

    func showManageSubscriptions() async {
        guard entitlements?.provider == "apple" else {
            fail("This subscription is not managed by the App Store.")
            return
        }
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive })
        else {
            fail("Relay Console could not open App Store subscription management.")
            return
        }
        do {
            try await StoreKit.AppStore.showManageSubscriptions(in: scene)
            if let workspaceId { await loadServerEntitlements(workspaceId: workspaceId) }
            applyServerState()
        } catch {
            fail(Self.message(for: error))
        }
    }

    private func loadProduct() async {
        guard let productID = Self.configuredProductID else {
            product = nil
            return
        }
        do {
            product = try await Product.products(for: [productID]).first
        } catch {
            product = nil
            if entitlements?.mode != "read_write" {
                errorMessage = Self.message(for: error)
            }
        }
    }

    private func loadServerEntitlements(workspaceId: String) async {
        do {
            let response: RelaySignedDocument<RelayCloudEntitlements> = try await APIClient.shared.request(
                .billingStatus(workspaceId: workspaceId)
            )
            guard response.payload.workspaceId == workspaceId else {
                throw RelayCloudBillingError.workspaceMismatch
            }
            entitlements = response.payload
        } catch {
            fail(Self.message(for: error))
        }
    }

    private func handle(
        transactionResult: VerificationResult<StoreKit.Transaction>
    ) async {
        guard let workspaceId else { return }
        do {
            let transaction = try verified(transactionResult)
            guard transaction.productID == Self.configuredProductID else { return }
            try await submit(
                signedTransaction: transactionResult.jwsRepresentation,
                workspaceId: workspaceId
            )
            await transaction.finish()
        } catch {
            fail(Self.message(for: error))
        }
    }

    private func submit(
        signedTransaction: String,
        workspaceId: String
    ) async throws {
        let response: RelaySignedDocument<RelayCloudEntitlements> = try await APIClient.shared.request(
            .submitAppleTransaction(
                workspaceId: workspaceId,
                signedTransaction: signedTransaction
            )
        )
        guard response.payload.workspaceId == workspaceId else {
            throw RelayCloudBillingError.workspaceMismatch
        }
        entitlements = response.payload
        applyServerState()
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value): return value
        case .unverified: throw RelayCloudBillingError.unverifiedTransaction
        }
    }

    private func applyServerState() {
        guard let entitlements else {
            state = product == nil ? .unavailable : .subscriptionRequired
            return
        }
        switch entitlements.status {
        case "active", "trial", "trialing": state = .active
        case "grace": state = .grace
        case "subscription_required", "cancelled":
            state = product == nil ? .unavailable : .subscriptionRequired
        case "past_due", "read_only", "deletion_scheduled": state = .readOnly
        default: state = entitlements.mode == "read_write" ? .active : .readOnly
        }
    }

    private func fail(_ message: String) {
        errorMessage = message
        state = .failed
    }

    private static func message(for error: any Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}

private enum RelayCloudBillingError: LocalizedError {
    case unverifiedTransaction
    case workspaceMismatch

    var errorDescription: String? {
        switch self {
        case .unverifiedTransaction:
            return "The App Store transaction could not be verified. Relay was not unlocked."
        case .workspaceMismatch:
            return "The billing response did not match the selected workspace."
        }
    }
}
