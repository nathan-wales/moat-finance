import SwiftUI

struct AIAccessView: View {
    @StateObject private var viewModel = AIAccessViewModel()
    @State private var selectedTab: AIAccessTab = .connect
    @State private var showCreateToken = false
    @State private var connectionPendingDisconnect: McpOAuthClientConnection?
    @State private var tokenPendingRevoke: McpPersonalAccessToken?
    @State private var selectedLog: McpLogEntry?

    var body: some View {
        Group {
            switch viewModel.pageState {
            case .idle, .loading:
                LoadingView("Loading AI access...")
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            case .loaded, .refreshing:
                loadedContent
            }
        }
        .navigationTitle("AI Access")
        .navigationBarTitleDisplayMode(.large)
        .onAppear {
            Analytics.capture(
                "mcp_ai_access_viewed",
                properties: [
                    "surface": "ios",
                    "tab": selectedTab.rawValue
                ]
            )
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await viewModel.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .sheet(isPresented: $showCreateToken) {
            CreateMcpTokenSheet(viewModel: viewModel)
        }
        .sheet(item: $selectedLog) { log in
            McpLogDetailsSheet(log: log)
        }
        .sheet(item: actionMessageBinding) { message in
            MoatActionResultSheet(
                title: message.title,
                message: message.message
            ) {
                viewModel.clearActionMessage()
            }
        }
        .confirmationDialog(
            "Disconnect this OAuth connection?",
            isPresented: Binding(
                get: { connectionPendingDisconnect != nil },
                set: { if !$0 { connectionPendingDisconnect = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Disconnect", role: .destructive) {
                guard let connection = connectionPendingDisconnect else { return }
                connectionPendingDisconnect = nil
                Task { await viewModel.disconnectOAuth(connection) }
            }
            Button("Cancel", role: .cancel) {
                connectionPendingDisconnect = nil
            }
        }
        .confirmationDialog(
            "Revoke this personal access token?",
            isPresented: Binding(
                get: { tokenPendingRevoke != nil },
                set: { if !$0 { tokenPendingRevoke = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Revoke", role: .destructive) {
                guard let token = tokenPendingRevoke else { return }
                tokenPendingRevoke = nil
                Task { await viewModel.revokeToken(token) }
            }
            Button("Cancel", role: .cancel) {
                tokenPendingRevoke = nil
            }
        }
        .task { await viewModel.load() }
    }

    private var actionMessageBinding: Binding<AIAccessActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Text("Connect Moat to your personal AI assistant, or manage advanced MCP settings.")
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)

                Picker("AI access tab", selection: $selectedTab) {
                    ForEach(AIAccessTab.allCases) { tab in
                        Text(tab.title).tag(tab)
                    }
                }
                .pickerStyle(.segmented)

                switch selectedTab {
                case .connect:
                    AIAssistantConnectCard()
                case .settings:
                    settingsContent
                }
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.medium)
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }

    private var settingsContent: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
            OAuthConnectionsSection(viewModel: viewModel) { connection in
                connectionPendingDisconnect = connection
            }

            PersonalAccessTokensSection(
                viewModel: viewModel,
                onCreate: { showCreateToken = true },
                onRevoke: { token in tokenPendingRevoke = token }
            )

            McpLogsSection(viewModel: viewModel) { log in
                selectedLog = log
            }
        }
    }
}

private enum AIAccessTab: String, CaseIterable, Identifiable {
    case connect
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .connect: "Connect"
        case .settings: "Settings"
        }
    }
}

#Preview {
    NavigationStack {
        AIAccessView()
    }
}
