import SwiftUI

struct CommunityTipsView: View {
    @ObservedObject private var navigation = AppNavigationCoordinator.shared
    @StateObject private var viewModel = CommunityTipsViewModel()
    @State private var selectedTipId: String?
    @State private var showMyTips = false
    @State private var showSubmit = false

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
                LoadingView("Loading tips...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Community Tips")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $viewModel.searchText, prompt: "Search tips…")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: MoatTheme.Spacing.small) {
                    Button {
                        showMyTips = true
                    } label: {
                        Text("My Tips")
                            .font(.subheadline)
                    }
                    Button {
                        showSubmit = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .navigationDestination(isPresented: isTipSelected) {
            if let selectedTipId {
                CommunityTipDetailView(tipId: selectedTipId)
            }
        }
        .navigationDestination(isPresented: $showMyTips) {
            MyCommunityTipsView()
        }
        .sheet(isPresented: $showSubmit) {
            CommunityTipSubmitView {
                showSubmit = false
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
            consumePendingSearch()
            await viewModel.load()
        }
        .onChange(of: navigation.communityTipsPendingSearch) { _ in
            consumePendingSearch()
        }
    }

    private func consumePendingSearch() {
        guard let pending = navigation.communityTipsPendingSearch else { return }
        viewModel.searchText = pending
        navigation.communityTipsPendingSearch = nil
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                headerSection
                sortPicker

                if viewModel.filteredTips.isEmpty {
                    Text("No tips found. Be the first to share one!")
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, MoatTheme.Spacing.xLarge)
                } else {
                    LazyVStack(spacing: MoatTheme.Spacing.medium) {
                        ForEach(viewModel.filteredTips) { tip in
                            Button {
                                selectedTipId = tip.id
                            } label: {
                                CommunityTipCardView(
                                    tip: tip,
                                    onLike: {
                                        Task { await viewModel.like(tipId: tip.id) }
                                    },
                                    onUnlike: {
                                        Task { await viewModel.unlike(tipId: tip.id) }
                                    }
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.medium)
            .padding(.bottom, MoatTheme.Spacing.xLarge)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            Text("Money-saving tips shared by the Moat community.")
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
        }
    }

    private var sortPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: MoatTheme.Spacing.small) {
                ForEach(CommunityTipFeedSort.allCases) { sort in
                    Button {
                        Task { await viewModel.applySort(sort) }
                    } label: {
                        Text(sort.displayTitle)
                            .font(.subheadline.weight(.medium))
                            .padding(.horizontal, MoatTheme.Spacing.medium)
                            .padding(.vertical, MoatTheme.Spacing.small)
                            .background(
                                viewModel.activeSort == sort
                                    ? MoatTheme.ColorToken.accent
                                    : MoatTheme.ColorToken.mutedSurface
                            )
                            .foregroundStyle(
                                viewModel.activeSort == sort
                                    ? Color.white
                                    : MoatTheme.ColorToken.textPrimary
                            )
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }
}

private struct CommunityTipCardView: View {
    let tip: CommunityTipPublicSummary
    let onLike: () -> Void
    let onUnlike: () -> Void

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                        Text(tip.title)
                            .font(.headline)
                            .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                            .lineLimit(2)
                        if let potentialBenefit = tip.potentialBenefit {
                            Text(potentialBenefit)
                                .font(.caption)
                                .foregroundStyle(MoatTheme.ColorToken.positive)
                        }
                    }
                    Spacer(minLength: MoatTheme.Spacing.small)
                    likeButton
                }

                Text(tip.bodyPreview)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .lineLimit(3)

                if !tip.tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: MoatTheme.Spacing.xSmall) {
                            ForEach(tip.tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption.weight(.medium))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(MoatTheme.ColorToken.mutedSurface)
                                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }

                HStack(spacing: MoatTheme.Spacing.medium) {
                    if tip.personallyTested {
                        Label("Tested", systemImage: "checkmark.seal.fill")
                            .font(.caption)
                            .foregroundStyle(MoatTheme.ColorToken.positive)
                    }
                    if let author = tip.author, tip.attribution == .public {
                        Text("by \(author.displayName)")
                            .font(.caption)
                            .foregroundStyle(MoatTheme.ColorToken.textTertiary)
                    } else if tip.attribution == .anonymous {
                        Text("Anonymous member")
                            .font(.caption)
                            .foregroundStyle(MoatTheme.ColorToken.textTertiary)
                    }
                }
            }
        }
    }

    private var likeButton: some View {
        Button {
            if tip.likedByCurrentUser {
                onUnlike()
            } else {
                onLike()
            }
        } label: {
            VStack(spacing: 2) {
                Image(systemName: tip.likedByCurrentUser ? "heart.fill" : "heart")
                    .font(.system(size: 16))
                    .foregroundStyle(tip.likedByCurrentUser ? MoatTheme.ColorToken.destructive : MoatTheme.ColorToken.textSecondary)
                Text("\(tip.likeCount)")
                    .font(.caption2)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }
        }
        .buttonStyle(.plain)
        .frame(minWidth: 36)
    }
}

#Preview {
    NavigationStack {
        CommunityTipsView()
    }
}
