import Foundation

#if canImport(FinanceKit)
import FinanceKit
#endif

/// Registers for FinanceKit background delivery so Apple Wallet refreshes roughly daily without the
/// app being opened. Requires iOS 26 plus a background delivery extension in a shared App Group;
/// until that App Group is configured, `AppleWalletSharedContainer.isBackgroundDeliverySupported` is
/// false and every call here is a no-op that leaves foreground sync as the only path.
enum AppleFinanceKitBackgroundDelivery {
    static var isSupported: Bool {
        guard AppleWalletSharedContainer.isBackgroundDeliverySupported else { return false }
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            return true
        }
        #endif
        return false
    }

    static func enable() {
        guard isSupported else { return }

        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            FinanceStore.shared.enableBackgroundDelivery(
                for: [.accounts, .accountBalances, .transactions],
                frequency: .daily
            )
            FinanceKitDiagnostics.logSnapshot(operation: "apple_wallet_background_delivery_enabled")
        }
        #endif
    }

    static func disable() {
        guard isSupported else { return }

        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            FinanceStore.shared.disableAllBackgroundDelivery()
            FinanceKitDiagnostics.logSnapshot(operation: "apple_wallet_background_delivery_disabled")
        }
        #endif
    }
}
