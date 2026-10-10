import SwiftUI

struct DemoModeView: View {
    @StateObject private var viewModel = DemoModeViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading demo mode...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Demo Mode")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await viewModel.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .sheet(item: actionMessageBinding) { message in
            DemoModeActionSheet(message: message) {
                viewModel.clearActionMessage()
            }
        }
        .task { await viewModel.load() }
    }

    private var actionMessageBinding: Binding<DemoModeActionMessage?> {
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
                DemoModeStatusCard(status: viewModel.status)

                VStack(spacing: MoatTheme.Spacing.medium) {
                    Button {
                        Task { await viewModel.enterDemoMode() }
                    } label: {
                        Label("Enter demo mode", systemImage: "play.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatPrimary)
                    .disabled(viewModel.status?.isDemoMode == true)

                    Button {
                        Task { await viewModel.resetDemoOverlay() }
                    } label: {
                        Label("Reset demo changes", systemImage: "arrow.counterclockwise")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)
                    .disabled(viewModel.status?.isDemoMode != true)

                    Button {
                        Task { await viewModel.dismissNotice() }
                    } label: {
                        Label("Dismiss notice", systemImage: "bell.slash")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)
                    .disabled(viewModel.status?.isDemoMode != true)

                    Button(role: .destructive) {
                        Task { await viewModel.exitDemoMode() }
                    } label: {
                        Label("Exit demo mode", systemImage: "xmark")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatDestructive)
                    .disabled(viewModel.status?.isDemoMode != true)
                }
                .padding(MoatTheme.Spacing.large)
                .background(MoatTheme.ColorToken.surface)
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }
}

private struct DemoModeStatusCard: View {
    let status: DemoModeStatus?

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HStack {
                    Image(systemName: status?.isDemoMode == true ? "checkmark.seal.fill" : "person.fill")
                        .foregroundStyle(status?.isDemoMode == true ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.textSecondary)
                    Text(status?.isDemoMode == true ? "Demo mode is active" : "Demo mode is inactive")
                        .font(.headline)
                }

                DemoModeFact(title: "Expires", value: status?.overlayExpiresAt.map(DateFormatterProvider.fullDate) ?? "-")
                DemoModeFact(title: "Unsaved changes", value: status?.hasUnsavedDemoChanges == true ? "Yes" : "No")
                DemoModeFact(title: "Notice dismissed", value: status?.noticeDismissed == true ? "Yes" : "No")
            }
        }
    }
}

private struct DemoModeFact: View {
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
        }
    }
}

struct DemoModeActionSheet: View {
    let message: DemoModeActionMessage
    let onDismiss: () -> Void

    var body: some View {
        MoatActionResultSheet(
            title: message.title,
            message: message.message,
            dismissButtonTitle: confirmButtonTitle,
            onDismiss: onDismiss
        )
    }

    private var confirmButtonTitle: String {
        switch message.title {
        case "Demo mode started", "Demo mode ended":
            return "Got it"
        default:
            return "Done"
        }
    }
}