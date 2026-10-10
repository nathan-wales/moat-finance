import SwiftUI

struct McpLogsSection: View {
    @ObservedObject var viewModel: AIAccessViewModel
    let onSelect: (McpLogEntry) -> Void

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                VStack(alignment: .leading, spacing: 4) {
                    Label("MCP logs", systemImage: "waveform.path.ecg")
                        .font(.headline)
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    Text("Recent tool calls and activity from MCP clients.")
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                }

                filters

                switch viewModel.logsState {
                case .idle, .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, MoatTheme.Spacing.large)
                case .error(let message):
                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, MoatTheme.Spacing.medium)
                case .loaded where viewModel.logs.isEmpty:
                    emptyState
                case .loaded:
                    VStack(spacing: 0) {
                        ForEach(viewModel.logs) { log in
                            Button {
                                onSelect(log)
                            } label: {
                                McpLogRow(log: log)
                            }
                            .buttonStyle(.plain)

                            if log.id != viewModel.logs.last?.id {
                                Divider()
                            }
                        }
                    }

                    if viewModel.logsNextCursor != nil {
                        Button {
                            Task { await viewModel.loadMoreLogs() }
                        } label: {
                            HStack {
                                if viewModel.isLoadingMoreLogs {
                                    ProgressView()
                                    Text("Loading…")
                                } else {
                                    Image(systemName: "chevron.down")
                                    Text("Load more")
                                }
                            }
                            .font(.subheadline)
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.moatSecondary)
                        .disabled(viewModel.isLoadingMoreLogs)
                        .padding(.top, MoatTheme.Spacing.small)
                    }
                }
            }
        }
    }

    private var filters: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            MoatTextField(
                placeholder: "Search tool…",
                text: $viewModel.logSearchDraft,
                onSubmit: { viewModel.commitLogSearch() }
            )

            HStack(spacing: MoatTheme.Spacing.small) {
                Picker(
                    "Status",
                    selection: Binding(
                        get: { viewModel.logFilters.status.isEmpty ? "all" : viewModel.logFilters.status },
                        set: { viewModel.setLogStatusFilter($0 == "all" ? "" : $0) }
                    )
                ) {
                    Text("All statuses").tag("all")
                    Text("Success").tag("success")
                    Text("Error").tag("error")
                    Text("Denied").tag("denied")
                    Text("Rate limited").tag("rate_limited")
                }
                .pickerStyle(.menu)

                Picker(
                    "Auth type",
                    selection: Binding(
                        get: { viewModel.logFilters.authType.isEmpty ? "all" : viewModel.logFilters.authType },
                        set: { viewModel.setLogAuthTypeFilter($0 == "all" ? "" : $0) }
                    )
                ) {
                    Text("All types").tag("all")
                    Text("PAT").tag("PAT")
                    Text("OAuth").tag("OAuth")
                }
                .pickerStyle(.menu)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: MoatTheme.Spacing.small) {
            Image(systemName: "waveform.path.ecg")
                .font(.title2)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary.opacity(0.5))
            Text("No logs found.")
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xLarge)
    }
}

private struct McpLogRow: View {
    let log: McpLogEntry

    var body: some View {
        HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
            VStack(alignment: .leading, spacing: 4) {
                Text(log.toolName)
                    .font(.system(.caption, design: .monospaced))
                    .fontWeight(.semibold)
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    .lineLimit(1)
                Text(log.clientDisplayName)
                    .font(.caption)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }

            Spacer(minLength: 0)

            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 4) {
                    statusIcon
                    Text(log.statusLabel)
                        .font(.caption)
                }
                Text(log.authTypeLabel)
                    .font(.caption2)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                Text("\(log.durationMs)ms")
                    .font(.caption2)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                Text(AIAccessDateFormatting.relative(log.createdAt))
                    .font(.caption2)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }
        }
        .padding(.vertical, MoatTheme.Spacing.small)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var statusIcon: some View {
        switch log.status {
        case "success":
            Image(systemName: "checkmark")
                .foregroundStyle(MoatTheme.ColorToken.positive)
        case "denied":
            Image(systemName: "exclamationmark.shield.fill")
                .foregroundStyle(.yellow)
        default:
            Image(systemName: "xmark")
                .foregroundStyle(MoatTheme.ColorToken.destructive)
        }
    }
}
