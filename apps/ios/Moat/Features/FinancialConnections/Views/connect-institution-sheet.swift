import SafariServices
import SwiftUI

/// Multi-provider institution search + connect sheet (Plaid, MX, Finicity).
///
/// This sheet is intentionally unused. Connect account currently opens native
/// Plaid Link directly. Restore this sheet when MX and Finicity integration
/// needs institution search and provider routing — do not delete it.
struct ConnectInstitutionSheet: View {
    @StateObject private var viewModel = ConnectInstitutionViewModel()
    @State private var showAppleWalletConnect = false
    @FocusState private var isSearchFocused: Bool

    let showPrivacyNotice: Bool
    let isDemoMode: Bool
    /// When true, skip Moat institution search and open Plaid Link immediately.
    ///
    /// TODO: Revisit institution-search / MX / Finicity multi-provider routing when
    /// we have a real user, customer, or business need. Keep the search interstitial
    /// code below — do not delete it.
    let preferDirectPlaid: Bool
    let onSuccess: (ConnectInstitutionSheetCompletion) -> Void
    let onClose: () -> Void

    init(
        showPrivacyNotice: Bool,
        isDemoMode: Bool,
        preferDirectPlaid: Bool = false,
        onSuccess: @escaping (ConnectInstitutionSheetCompletion) -> Void,
        onClose: @escaping () -> Void
    ) {
        self.showPrivacyNotice = showPrivacyNotice
        self.isDemoMode = isDemoMode
        self.preferDirectPlaid = preferDirectPlaid
        self.onSuccess = onSuccess
        self.onClose = onClose
    }

    private var showAppleWalletOption: Bool {
        AppleFinanceKitAvailability.isSupportedOSVersion && !isDemoMode
    }

    private var overlayVisible: Bool {
        viewModel.overlayPhase.showsOverlay
    }

    var body: some View {
        NavigationStack {
            ZStack {
                if viewModel.showSecurity {
                    ConnectSecurityContent()
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .move(edge: .trailing).combined(with: .opacity)
                        ))
                } else {
                    mainContent
                        .transition(.asymmetric(
                            insertion: .move(edge: .leading).combined(with: .opacity),
                            removal: .move(edge: .leading).combined(with: .opacity)
                        ))
                }
            }
            .clipped()
            .animation(.easeInOut(duration: 0.28), value: viewModel.showSecurity)
            .background(MoatTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(viewModel.showSecurity ? "Security & Privacy" : "Add account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if viewModel.showSecurity {
                        Button {
                            viewModel.showSecurity = false
                        } label: {
                            Image(systemName: "chevron.left")
                        }
                    }
                }

                if !viewModel.showSecurity, !overlayVisible {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            viewModel.showSecurity = true
                        } label: {
                            Image(systemName: "shield")
                        }
                        .accessibilityLabel("Security practices")
                    }
                }

                if !overlayVisible, !viewModel.isConnecting {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            closeSheet()
                        } label: {
                            Image(systemName: "xmark")
                        }
                        .accessibilityLabel("Close")
                    }
                }
            }
            .overlay {
                if overlayVisible {
                    ConnectInstitutionImportOverlay(
                        phase: viewModel.overlayPhase,
                        onDone: handleOverlayDone
                    )
                }
            }
        }
        .presentationDetents(overlayVisible ? [.large] : [.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(viewModel.isConnecting || viewModel.overlayPhase.blocksDismiss)
        .moatConnectSheetCornerRadius()
        .sheet(item: $viewModel.externalConnectURL) { item in
            ConnectSafariView(url: item.url)
        }
        .sheet(isPresented: $showAppleWalletConnect) {
            AppleWalletConnectView {
                onSuccess(.message("Apple Wallet accounts are connected. Initial sync is running."))
                showAppleWalletConnect = false
            }
        }
        .onAppear {
            if isDemoMode {
                viewModel.errorMessage = "Demo mode uses sample institutions and transactions. Exit demo mode to connect a real bank account."
                return
            }
            if preferDirectPlaid {
                viewModel.startDirectPlaidConnect()
            }
        }
        .onDisappear {
            guard !viewModel.isConnecting, !viewModel.overlayPhase.showsOverlay else { return }
            viewModel.reset()
        }
        .onChange(of: viewModel.successMessage) { message in
            guard let message else { return }
            onSuccess(.message(message))
        }
        .onChange(of: viewModel.shouldDismissDirectConnect) { shouldDismiss in
            guard shouldDismiss else { return }
            closeSheet()
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        if preferDirectPlaid {
            directPlaidLaunchContent
        } else {
            institutionSearchContent
        }
    }

    private var directPlaidLaunchContent: some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            if let errorMessage = viewModel.errorMessage {
                ConnectInstitutionBanner(
                    message: errorMessage,
                    systemImage: "exclamationmark.triangle.fill",
                    tint: MoatTheme.ColorToken.warning
                )
                .padding(.horizontal, MoatTheme.Spacing.large)

                Button("Close") {
                    closeSheet()
                }
                .buttonStyle(.bordered)
            } else {
                ProgressView()
                Text(viewModel.isConnecting ? "Opening Plaid…" : "Connecting…")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xLarge)
    }

    private var institutionSearchContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                if showPrivacyNotice {
                    privacyNotice
                }

                searchField

                resultsSection

                if let errorMessage = viewModel.errorMessage {
                    ConnectInstitutionBanner(
                        message: errorMessage,
                        systemImage: "exclamationmark.triangle.fill",
                        tint: MoatTheme.ColorToken.warning
                    )
                }

                if let successMessage = viewModel.successMessage {
                    ConnectInstitutionBanner(
                        message: successMessage,
                        systemImage: "checkmark",
                        tint: MoatTheme.ColorToken.positive
                    )
                }
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.medium)
            .padding(.bottom, MoatTheme.Spacing.xLarge)
        }
    }

    private var privacyNotice: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
            Label("Privacy Notice", systemImage: "checkmark.shield")
                .font(.subheadline.weight(.semibold))

            Text("Your credentials are handled by the selected financial data provider and are never stored by Moat.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface.opacity(0.65))
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }

    private var searchField: some View {
        HStack(spacing: MoatTheme.Spacing.small) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("Search institutions", text: Binding(
                get: { viewModel.query },
                set: { viewModel.updateQuery($0) }
            ))
            .textFieldStyle(.plain)
            .textInputAutocapitalization(.words)
            .autocorrectionDisabled()
            .disabled(isDemoMode || viewModel.isConnecting)
            .focused($isSearchFocused)

            if !viewModel.query.isEmpty {
                Button {
                    viewModel.updateQuery("")
                } label: {
                    Image(systemName: "xmark")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, 10)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
        }
        .moatInputFocusRing(isFocused: isSearchFocused, cornerRadius: MoatTheme.Radius.medium)
    }

    @ViewBuilder
    private var resultsSection: some View {
        if isDemoMode {
            EmptyView()
        } else if viewModel.shouldShowPopularGrid {
            TopInstitutionsGrid(
                showAppleWallet: showAppleWalletOption,
                resolvingName: viewModel.resolvingPopularName,
                onSelectAppleWallet: {
                    FinanceKitDiagnostics.logSnapshot(operation: "apple_wallet_tile_tapped")
                    showAppleWalletConnect = true
                },
                onSelect: { viewModel.selectPopularInstitution($0) }
            )
        } else if viewModel.isSearching {
            HStack(spacing: MoatTheme.Spacing.small) {
                ProgressView()
                Text("Searching")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, MoatTheme.Spacing.medium)
        } else if viewModel.searchResults.isEmpty {
            Text("No matching institutions found.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(MoatTheme.Spacing.medium)
                .overlay {
                    RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                        .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4]))
                        .foregroundStyle(MoatTheme.ColorToken.border)
                }
        } else {
            VStack(spacing: MoatTheme.Spacing.small) {
                ForEach(viewModel.searchResults) { institution in
                    InstitutionSearchResultRow(
                        institution: institution,
                        isSelected: viewModel.selectedInstitutionId == institution.canonicalInstitutionId,
                        isLoading: viewModel.isConnecting
                            && viewModel.selectedInstitutionId == institution.canonicalInstitutionId,
                        onSelect: { viewModel.selectInstitution(institution) }
                    )
                    .disabled(viewModel.isConnecting)
                }
            }
        }
    }

    private func handleOverlayDone() {
        guard let success = viewModel.acknowledgeOverlaySuccess() else { return }
        onSuccess(.plaid(success))
        onClose()
    }

    private func closeSheet() {
        onClose()
    }
}

private struct ConnectInstitutionBanner: View {
    let message: String
    let systemImage: String
    let tint: Color

    var body: some View {
        Label(message, systemImage: systemImage)
            .font(.footnote)
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(MoatTheme.Spacing.medium)
            .background(tint.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

struct ConnectSecurityContent: View {
    private struct SecurityItem: Identifiable {
        let id = UUID()
        let title: String
        let message: String
        let systemImage: String
    }

    private let items: [SecurityItem] = [
        SecurityItem(
            title: "AES-256 encryption",
            message: "Sensitive tokens and secrets are encrypted at rest with AES-256-GCM. All data is encrypted in transit with TLS.",
            systemImage: "lock.fill"
        ),
        SecurityItem(
            title: "Read-only access",
            message: "Moat only ever requests read-only access. We cannot move or transfer money.",
            systemImage: "eye.fill"
        ),
        SecurityItem(
            title: "Credentials never stored",
            message: "Your bank login is handled entirely by your chosen financial data provider — Plaid, MX, or Finicity. Moat never sees or stores your credentials.",
            systemImage: "checkmark.shield.fill"
        ),
        SecurityItem(
            title: "Revoke access anytime",
            message: "Disconnect any institution at any time from your accounts page. Access is revoked immediately.",
            systemImage: "arrow.triangle.2.circlepath"
        ),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Label("How we protect your data", systemImage: "checkmark.shield.fill")
                    .font(.headline)

                ForEach(items) { item in
                    HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
                        Image(systemName: item.systemImage)
                            .foregroundStyle(.secondary)
                            .frame(width: 20)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title)
                                .font(.subheadline.weight(.semibold))
                            Text(item.message)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.medium)
            .padding(.bottom, MoatTheme.Spacing.xLarge)
        }
    }
}

struct ConnectSafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

private extension View {
    @ViewBuilder
    func moatConnectSheetCornerRadius() -> some View {
        if #available(iOS 16.4, *) {
            presentationCornerRadius(36)
        } else {
            self
        }
    }
}
