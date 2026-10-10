import SwiftUI

struct MyCommunityTipsView: View {
    @StateObject private var viewModel = MyCommunityTipsViewModel()
    @State private var selectedTipId: String?
    @State private var showSubmit = false
    @State private var showEditTip: CommunityTipOwnerDetail?

    private var isTipSelected: Binding<Bool> {
        Binding(
            get: { selectedTipId != nil },
            set: { if !$0 { selectedTipId = nil } }
        )
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading your tips...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("My Tips")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showSubmit = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .navigationDestination(isPresented: isTipSelected) {
            if let selectedTipId {
                CommunityTipDetailView(tipId: selectedTipId)
            }
        }
        .sheet(isPresented: $showSubmit) {
            CommunityTipSubmitView {
                showSubmit = false
                Task { await viewModel.refresh() }
            }
        }
        .sheet(item: $showEditTip) { tip in
            CommunityTipEditView(tip: tip) {
                showEditTip = nil
                Task { await viewModel.refresh() }
            }
        }
        .alert(item: $viewModel.actionMessage) { message in
            Alert(
                title: Text(message.title),
                message: Text(message.message),
                dismissButton: .default(Text("OK")) {
                    viewModel.clearActionMessage()
                }
            )
        }
        .task {
            await viewModel.load()
        }
    }

    private var loadedContent: some View {
        Group {
            if viewModel.myTips.isEmpty {
                ScrollView {
                    VStack(spacing: MoatTheme.Spacing.large) {
                        Spacer(minLength: 120)
                        Image(systemName: "lightbulb")
                            .font(.system(size: 48))
                            .foregroundStyle(MoatTheme.ColorToken.textTertiary)
                        Text("You haven't shared any tips yet.")
                            .font(.subheadline)
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        Button {
                            showSubmit = true
                        } label: {
                            Text("Share a tip").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.moatPrimary)
                        .padding(.horizontal, MoatTheme.Spacing.xLarge)
                        Spacer(minLength: 120)
                    }
                    .frame(maxWidth: .infinity)
                }
                .moatPageBackground()
            } else {
                List {
                    ForEach(viewModel.myTips) { tip in
                        MyTipRow(
                            tip: tip,
                            onView: { selectedTipId = tip.id },
                            onEdit: { showEditTip = tip },
                            onDelete: {
                                Task { await viewModel.delete(tipId: tip.id) }
                            }
                        )
                        .listRowBackground(MoatTheme.ColorToken.surface)
                    }
                }
                .scrollContentBackground(.hidden)
                .moatPageBackground()
            }
        }
        .refreshable { await viewModel.refresh() }
    }
}

private struct MyTipRow: View {
    let tip: CommunityTipOwnerDetail
    let onView: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void

    @State private var showDeleteConfirm = false

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(tip.title)
                        .font(.headline)
                        .lineLimit(2)
                    Text(tip.status.displayLabel)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(statusColor.opacity(0.15))
                        .foregroundStyle(statusColor)
                        .clipShape(Capsule())
                }
                Spacer()
            }

            if let reason = tip.moderationReason {
                Text(reason)
                    .font(.caption)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .padding(MoatTheme.Spacing.small)
                    .background(MoatTheme.ColorToken.mutedSurface)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small))
            }

            HStack(spacing: MoatTheme.Spacing.small) {
                Button("View", action: onView)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                Button("Edit", action: onEdit)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                Button(role: .destructive) {
                    showDeleteConfirm = true
                } label: {
                    Text("Delete")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(.vertical, MoatTheme.Spacing.small)
        .confirmationDialog(
            "Delete this tip?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive, action: onDelete)
            Button("Cancel", role: .cancel) {}
        }
    }

    private var statusColor: Color {
        switch tip.status {
        case .approved: return MoatTheme.ColorToken.positive
        case .rejected, .archived, .expired: return MoatTheme.ColorToken.destructive
        case .changesRequired: return MoatTheme.ColorToken.warning
        default: return MoatTheme.ColorToken.textSecondary
        }
    }
}

private struct CommunityTipEditView: View {
    let tip: CommunityTipOwnerDetail
    let onSuccess: () -> Void

    @SwiftUI.Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var tipBody: String
    @State private var attribution: CommunityTipAttribution
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private let service = CommunityTipsService()

    init(tip: CommunityTipOwnerDetail, onSuccess: @escaping () -> Void) {
        self.tip = tip
        self.onSuccess = onSuccess
        _title = State(initialValue: tip.title)
        _tipBody = State(initialValue: tip.body)
        _attribution = State(initialValue: tip.attribution)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Title").font(.headline)
                        MoatTextField(
                            placeholder: "A short, descriptive title",
                            text: $title,
                            autocapitalization: .sentences
                        )
                    }

                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Tip").font(.headline)
                        TextEditor(text: $tipBody)
                            .frame(minHeight: 120)
                            .padding(MoatTheme.Spacing.small)
                            .background(MoatTheme.ColorToken.mutedSurface)
                            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                                    .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
                            }
                    }

                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Attribution").font(.headline)
                        Picker("Attribution", selection: $attribution) {
                            ForEach(CommunityTipAttribution.allCases) { option in
                                Text(option.displayTitle).tag(option)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.subheadline)
                            .foregroundStyle(MoatTheme.ColorToken.destructive)
                            .padding(MoatTheme.Spacing.medium)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(MoatTheme.ColorToken.destructiveSoft)
                            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
                    }

                    Button {
                        Task { await saveEdits() }
                    } label: {
                        if isSubmitting {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Save changes").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.moatPrimary)
                    .disabled(isSubmitting)
                }
                .padding(.horizontal, MoatTheme.Spacing.large)
                .padding(.top, MoatTheme.Spacing.large)
                .padding(.bottom, 112)
            }
            .moatPageBackground()
            .navigationTitle("Edit Tip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func saveEdits() async {
        isSubmitting = true
        errorMessage = nil
        do {
            _ = try await service.update(UpdateCommunityTipRequest(
                tipId: tip.id,
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                body: tipBody.trimmingCharacters(in: .whitespacesAndNewlines),
                attribution: attribution.rawValue
            ))
            onSuccess()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSubmitting = false
    }
}

#Preview {
    NavigationStack {
        MyCommunityTipsView()
    }
}
