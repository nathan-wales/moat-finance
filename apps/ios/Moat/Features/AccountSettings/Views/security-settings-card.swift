import SwiftUI

struct SecuritySettingsCard: View {
    @ObservedObject private var appLockManager = AppLockManager.shared

    @State private var isUpdatingToggle = false
    @State private var errorMessage: String?

    private let biometricService = BiometricAuthService.shared

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HStack {
                    Image(systemName: "faceid")
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    Text("Security")
                        .font(.headline)
                }

                if biometricService.canAuthenticate() {
                    Toggle(isOn: biometricToggleBinding) {
                        Text(appLockManager.settingsToggleTitle)
                            .font(.body)
                    }
                    .moatToggleStyle()
                    .disabled(isUpdatingToggle)

                    if appLockManager.isEnabled {
                        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                            Text("Require after")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            Picker("Require after", selection: timeoutBinding) {
                                ForEach(AppLockTimeout.allCases) { timeout in
                                    Text(timeout.title).tag(timeout)
                                }
                            }
                            .pickerStyle(.segmented)
                        }
                    }
                } else {
                    Text(unavailableMessage)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var unavailableMessage: String {
        switch biometricService.biometryType {
        case .none:
            return "Set up a device passcode to use biometric unlock."
        default:
            return "Biometric unlock is not available on this device."
        }
    }

    private var biometricToggleBinding: Binding<Bool> {
        Binding(
            get: { appLockManager.isEnabled },
            set: { newValue in
                Task { await updateBiometricUnlock(enabled: newValue) }
            }
        )
    }

    private var timeoutBinding: Binding<AppLockTimeout> {
        Binding(
            get: { appLockManager.lockTimeout },
            set: { appLockManager.lockTimeout = $0 }
        )
    }

    private func updateBiometricUnlock(enabled: Bool) async {
        guard !isUpdatingToggle else { return }

        isUpdatingToggle = true
        errorMessage = nil
        defer { isUpdatingToggle = false }

        do {
            if enabled {
                try await appLockManager.enableBiometricUnlock()
            } else {
                try await appLockManager.disableBiometricUnlock()
            }
        } catch let error as BiometricAuthError {
            switch error {
            case .userCancelled, .userFallback, .systemCancelled:
                break
            default:
                errorMessage = error.errorDescription
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
