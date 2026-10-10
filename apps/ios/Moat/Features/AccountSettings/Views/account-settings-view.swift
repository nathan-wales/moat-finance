import SwiftUI
import UIKit

struct AccountSettingsView: View {
    @StateObject private var viewModel = AccountSettingsViewModel()
    @State private var profileName = ""
    @State private var twoFactorToken = ""
    @State private var twoFactorPassword = ""
    @State private var deleteEmail = ""
    @State private var deleteEmailError: String?
    @State private var sheetError: String?
    @State private var isDeletingAccount = false
    @State private var activeSheet: AccountSettingsSheet?

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading account...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Account Settings")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await viewModel.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .sheet(item: $activeSheet) { sheet in
            sheetContent(sheet)
        }
        .sheet(item: actionMessageBinding) { message in
            MoatActionResultSheet(
                title: message.title,
                message: message.message
            ) {
                viewModel.clearActionMessage()
            }
        }
        .task { await viewModel.load() }
    }

    private var actionMessageBinding: Binding<AccountSettingsActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: MoatTheme.Spacing.large) {
                AccountProfileCard(
                    name: viewModel.profileName,
                    email: viewModel.email
                ) {
                    let identity = AccountProfileIdentity(
                        name: viewModel.profileName,
                        email: viewModel.email
                    )
                    profileName = viewModel.profileName ?? identity.displayName
                    sheetError = nil
                    activeSheet = .profile
                }

                AppearanceSettingsCard()

                SecuritySettingsCard()

                if let snapshot = viewModel.snapshot {
                    TwoFactorSettingsCard(status: snapshot.twoFactorStatus, onGenerate: {
                        sheetError = nil
                        Task { await viewModel.generateTwoFactorSecret() }
                        activeSheet = .twoFactorEnable
                    }, onDisable: {
                        sheetError = nil
                        activeSheet = .twoFactorDisable
                    })
                }

                HouseholdSharingView(presentation: .embedded)

                CommunityTipsSettingsCard()

                DataSettingsCard(onExport: {
                    Task {
                        if await viewModel.exportData() {
                            activeSheet = .dataExport
                        }
                    }
                }, onDelete: {
                    deleteEmail = ""
                    deleteEmailError = nil
                    isDeletingAccount = false
                    activeSheet = .deleteAccount
                })
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }

    @ViewBuilder
    private func sheetContent(_ sheet: AccountSettingsSheet) -> some View {
        switch sheet {
        case .profile:
            MoatGlassSheet(title: "Profile") {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    MoatTextField(placeholder: "Display name", text: $profileName)
                }
            } footer: {
                VStack(spacing: MoatTheme.Spacing.medium) {
                    if let sheetError {
                        sheetErrorText(sheetError)
                    }
                    Button {
                        HapticFeedback.saveOrSubmit()
                        sheetError = nil
                        Task {
                            do {
                                try await viewModel.updateProfile(name: profileName)
                                activeSheet = nil
                            } catch {
                                sheetError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                            }
                        }
                    } label: {
                        Text("Save profile").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatPrimary)
                }
            }
        case .twoFactorEnable:
            MoatGlassSheet(title: "Enable 2FA") {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    if let secret = viewModel.generatedTwoFactorSecret {
                        TwoFactorQRCodeView(secret: secret)
                    } else {
                        ProgressView()
                    }

                    MoatTextField(
                        placeholder: "Verification code",
                        text: $twoFactorToken,
                        keyboardType: .numberPad
                    )
                }
            } footer: {
                VStack(spacing: MoatTheme.Spacing.medium) {
                    if let sheetError {
                        sheetErrorText(sheetError)
                    }
                    Button {
                        sheetError = nil
                        Task {
                            do {
                                try await viewModel.enableTwoFactor(token: twoFactorToken)
                                twoFactorToken = ""
                                activeSheet = .backupCodes
                            } catch {
                                sheetError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                            }
                        }
                    } label: {
                        Text("Enable 2FA").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatPrimary)
                }
            }
        case .backupCodes:
            MoatGlassSheet(title: "Backup Codes") {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    Text("Save these now. They are only shown once.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    BackupCodeGrid(codes: viewModel.backupCodes)

                    ShareLink(item: viewModel.backupCodes.joined(separator: "\n")) {
                        Label("Share backup codes", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)
                }
            } footer: {
                Button {
                    activeSheet = nil
                } label: {
                    Text("Done").frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatPrimary)
            }
        case .dataExport:
            MoatGlassSheet(title: "Data Export") {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    Text("Your export is ready to share or save.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if let exportedDataText = viewModel.exportedDataText {
                        ScrollView {
                            Text(exportedDataText)
                                .font(.caption.monospaced())
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(MoatTheme.Spacing.medium)
                        }
                        .frame(maxHeight: 260)
                        .background(MoatTheme.ColorToken.elevatedSurface)
                        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
                    }
                }
            } footer: {
                if let exportedDataText = viewModel.exportedDataText {
                    ShareLink(item: exportedDataText) {
                        Label("Share export", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatPrimary)
                }
            }
        case .twoFactorDisable:
            MoatGlassSheet(title: "Disable 2FA") {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    MoatSecureField(placeholder: "Password", text: $twoFactorPassword)
                }
            } footer: {
                VStack(spacing: MoatTheme.Spacing.medium) {
                    if let sheetError {
                        sheetErrorText(sheetError)
                    }
                    Button(role: .destructive) {
                        sheetError = nil
                        Task {
                            do {
                                try await viewModel.disableTwoFactor(password: twoFactorPassword)
                                activeSheet = nil
                            } catch {
                                sheetError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                            }
                        }
                    } label: {
                        Text("Disable 2FA").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatDestructive)
                }
            }
        case .deleteAccount:
            MoatGlassSheet(title: "Delete Account") {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    Text("Permanently delete your account and all associated data.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Text("Once you delete your account, there is no going back. This will immediately and permanently delete all your:")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        ForEach(Self.deleteAccountConsequences, id: \.self) { item in
                            HStack(alignment: .firstTextBaseline, spacing: MoatTheme.Spacing.small) {
                                Text("•")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                Text(item)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    if let supportURL = URL(string: "mailto:support@moatfinance.ai") {
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text("Questions before deleting?")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Link("support@moatfinance.ai", destination: supportURL)
                                .font(.caption)
                        }
                    }
                }
            } footer: {
                VStack(spacing: MoatTheme.Spacing.medium) {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Type your email to confirm permanent deletion.")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        MoatTextField(
                            placeholder: "Email",
                            text: $deleteEmail,
                            keyboardType: .emailAddress,
                            autocapitalization: .never,
                            disabled: isDeletingAccount
                        )
                        .onChange(of: deleteEmail) { _ in
                            deleteEmailError = nil
                        }

                        if let deleteEmailError {
                            Text(deleteEmailError)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(MoatTheme.ColorToken.destructive)
                                .padding(.horizontal, MoatTheme.Spacing.medium)
                                .padding(.vertical, MoatTheme.Spacing.small)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(MoatTheme.ColorToken.destructiveSoft)
                                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
                        }
                    }

                    Button(role: .destructive) {
                        Task { await deleteAccount() }
                    } label: {
                        if isDeletingAccount {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Delete account").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.moatDestructive)
                    .disabled(isDeletingAccount || deleteEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func sheetErrorText(_ message: String) -> some View {
        Text(message)
            .font(.caption.weight(.medium))
            .foregroundStyle(MoatTheme.ColorToken.destructive)
            .padding(.horizontal, MoatTheme.Spacing.medium)
            .padding(.vertical, MoatTheme.Spacing.small)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(MoatTheme.ColorToken.destructiveSoft)
            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
    }

    private func deleteAccount() async {
        guard !isDeletingAccount else { return }
        isDeletingAccount = true
        deleteEmailError = nil
        defer { isDeletingAccount = false }
        do {
            try await viewModel.deleteAccount(confirmationEmail: deleteEmail)
            activeSheet = nil
        } catch {
            deleteEmailError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private static let deleteAccountConsequences = [
        "Transaction history and imported data",
        "Connected bank accounts (Plaid connections)",
        "Investment portfolios and real estate tracking",
        "Transaction rules and automations",
        "Categories, hashtags, and settings",
    ]
}

private enum AccountSettingsSheet: Identifiable {
    case profile
    case twoFactorEnable
    case backupCodes
    case twoFactorDisable
    case dataExport
    case deleteAccount

    var id: String {
        switch self {
        case .profile:
            return "profile"
        case .twoFactorEnable:
            return "two-factor-enable"
        case .backupCodes:
            return "backup-codes"
        case .twoFactorDisable:
            return "two-factor-disable"
        case .dataExport:
            return "data-export"
        case .deleteAccount:
            return "delete-account"
        }
    }
}

private struct AccountProfileCard: View {
    let name: String?
    let email: String
    let onEdit: () -> Void

    var body: some View {
        let profile = AccountProfileIdentity(name: name, email: email)

        VStack(spacing: MoatTheme.Spacing.medium) {
            Button(action: onEdit) {
                ZStack(alignment: .bottomTrailing) {
                    ZStack {
                        Circle()
                            .fill(profile.avatarColor)
                            .frame(width: 84, height: 84)

                        Text(profile.initials)
                            .font(.system(size: 30, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white)
                    }

                    Image(systemName: "pencil")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                        .frame(width: 28, height: 28)
                        .background(MoatTheme.ColorToken.surface)
                        .clipShape(Circle())
                        .overlay {
                            Circle()
                                .stroke(MoatTheme.ColorToken.appBackground, lineWidth: 2)
                        }
                        .offset(x: 4, y: 4)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Edit profile name")

            VStack(spacing: 4) {
                Text(profile.displayName)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    .multilineTextAlignment(.center)

                if !email.isEmpty {
                    Text(email)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.small)
    }
}

private struct AccountProfileIdentity {
    let displayName: String
    let initials: String
    let avatarColor: Color

    init(name: String?, email: String?) {
        let trimmedName = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let trimmedEmail = email?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if !trimmedName.isEmpty {
            let tokens = trimmedName
                .split(separator: " ")
                .map(String.init)
                .filter { !$0.isEmpty }
            displayName = trimmedName
            if tokens.count >= 2 {
                initials = tokens
                    .prefix(2)
                    .compactMap { $0.first.map(String.init) }
                    .joined()
                    .uppercased()
            } else {
                initials = String(trimmedName.prefix(2)).uppercased()
            }
            avatarColor = Self.avatarColor(for: trimmedEmail.isEmpty ? trimmedName : trimmedEmail)
            return
        }

        if trimmedEmail.isEmpty {
            displayName = "Account"
            initials = "M"
            avatarColor = MoatTheme.ColorToken.accent
            return
        }

        let localPart = trimmedEmail.split(separator: "@").first.map(String.init) ?? trimmedEmail
        let tokens = localPart
            .replacingOccurrences(of: ".", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .split(separator: " ")
            .map(String.init)
            .filter { !$0.isEmpty }

        if tokens.count >= 2 {
            displayName = tokens
                .prefix(3)
                .map { $0.capitalized }
                .joined(separator: " ")
            initials = tokens
                .prefix(2)
                .compactMap { $0.first.map(String.init) }
                .joined()
                .uppercased()
        } else if let single = tokens.first {
            displayName = single.capitalized
            initials = String(single.prefix(2)).uppercased()
        } else {
            displayName = trimmedEmail
            initials = String(trimmedEmail.prefix(2)).uppercased()
        }

        avatarColor = Self.avatarColor(for: trimmedEmail)
    }

    private static func avatarColor(for seed: String) -> Color {
        let palette: [Color] = [
            Color(red: 0.93, green: 0.45, blue: 0.58),
            Color(red: 0.24, green: 0.39, blue: 0.87),
            Color(red: 0.18, green: 0.62, blue: 0.56),
            Color(red: 0.90, green: 0.55, blue: 0.24),
            Color(red: 0.52, green: 0.36, blue: 0.82),
        ]
        let hash = seed.unicodeScalars.reduce(into: 0) { partial, scalar in
            partial = (partial &+ Int(scalar.value) &* 31)
        }
        let index = abs(hash) % palette.count
        return palette[index]
    }
}

private struct AppearanceSettingsCard: View {
    @AppStorage(MoatAppearance.storageKey) private var appearanceRawValue = MoatAppearance.system.rawValue

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                SettingsSectionHeader(title: "Appearance", systemImage: "circle.lefthalf.filled")

                Picker("Appearance", selection: $appearanceRawValue) {
                    ForEach(MoatAppearance.allCases) { appearance in
                        Text(appearance.title).tag(appearance.rawValue)
                    }
                }
                .pickerStyle(.segmented)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct TwoFactorQRCodeView: View {
    let secret: TwoFactorSecretResponse

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            if let image = secret.qrImage {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 220)
                    .padding(MoatTheme.Spacing.medium)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
                    .frame(maxWidth: .infinity)
            }

            Text(secret.secret)
                .font(.footnote.monospaced())
                .textSelection(.enabled)
                .padding(MoatTheme.Spacing.medium)
                .background(MoatTheme.ColorToken.elevatedSurface)
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
        }
    }
}

private struct BackupCodeGrid: View {
    let codes: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MoatTheme.Spacing.small) {
            ForEach(codes, id: \.self) { code in
                Text(code)
                    .font(.footnote.monospaced().weight(.semibold))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity)
                    .padding(MoatTheme.Spacing.small)
                    .background(MoatTheme.ColorToken.elevatedSurface)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
            }
        }
    }
}

private extension TwoFactorSecretResponse {
    var qrImage: UIImage? {
        let base64: String
        if let commaIndex = qrCode.firstIndex(of: ",") {
            base64 = String(qrCode[qrCode.index(after: commaIndex)...])
        } else {
            base64 = qrCode
        }

        guard let data = Data(base64Encoded: base64) else { return nil }
        return UIImage(data: data)
    }
}

private struct TwoFactorSettingsCard: View {
    let status: TwoFactorStatus
    let onGenerate: () -> Void
    let onDisable: () -> Void

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                SettingsSectionHeader(title: "Two-Factor", systemImage: "lock.shield.fill")
                SettingsFact(title: "Enabled", value: status.twoFactorEnabled ? "Yes" : "No")
                SettingsFact(title: "Verified", value: status.twoFactorVerified ? "Yes" : "No")

                if status.twoFactorEnabled {
                    Button(role: .destructive, action: onDisable) {
                        Label("Disable 2FA", systemImage: "lock.open")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatDestructive)
                } else {
                    Button(action: onGenerate) {
                        Label("Set up 2FA", systemImage: "lock.badge.clock")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatPrimary)
                }
            }
        }
    }
}

private struct DataSettingsCard: View {
    let onExport: () -> Void
    let onDelete: () -> Void

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                SettingsSectionHeader(title: "Data", systemImage: "externaldrive.fill")
                Button(action: onExport) {
                    Label("Export data", systemImage: "square.and.arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)

                Button(role: .destructive, action: onDelete) {
                    Label("Delete account", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatDestructive)
            }
        }
    }
}

private struct SettingsSectionHeader: View {
    let title: String
    let systemImage: String

    var body: some View {
        HStack {
            Image(systemName: systemImage)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            Text(title)
                .font(.headline)
        }
    }
}

private struct SettingsFact: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

private struct CommunityTipsSettingsCard: View {
    @State private var showOnTransactions = true
    @State private var isLoading = true
    private let service = CommunityTipsService()

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                SettingsSectionHeader(title: "Community Tips", systemImage: "lightbulb.fill")

                if !isLoading {
                    Toggle("Show tips on transactions", isOn: $showOnTransactions)
                        .font(.subheadline)
                        .moatToggleStyle()
                        .onChange(of: showOnTransactions) { newValue in
                            Task { await saveSettings(newValue) }
                        }
                    Text("See relevant community saving tips when viewing your transactions.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .task {
            await loadSettings()
        }
    }

    private func loadSettings() async {
        do {
            let settings = try await service.getSettings()
            showOnTransactions = settings.showCommunityTipsOnTransactions
        } catch {
            AppLogger.warn(
                "Failed to load community tip settings",
                metadata: ["error": error.localizedDescription]
            )
        }
        isLoading = false
    }

    private func saveSettings(_ show: Bool) async {
        do {
            _ = try await service.setSettings(showCommunityTipsOnTransactions: show)
        } catch {
            AppLogger.warn(
                "Failed to save community tip settings",
                metadata: ["error": error.localizedDescription]
            )
        }
    }
}