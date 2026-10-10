import SwiftUI

struct CommunityTipDetailView: View {
    let tipId: String
    @State private var tip: CommunityTipPublicDetail?
    @State private var isLoading = true
    @State private var likeCount = 0
    @State private var likedByCurrentUser = false
    @State private var errorMessage: String?

    private let service = CommunityTipsService()

    var body: some View {
        Group {
            if isLoading {
                LoadingView("Loading tip...")
            } else if let tip {
                ScrollView {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                        titleSection(tip: tip)
                        bodySection(tip: tip)
                        metaSection(tip: tip)
                        likeSection(tip: tip)
                    }
                    .padding(.horizontal, MoatTheme.Spacing.large)
                    .padding(.vertical, MoatTheme.Spacing.large)
                }
                .moatPageBackground()
                .refreshable { await loadTip(showLoading: false) }
            } else {
                Text("Tip not found.")
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .moatPageBackground()
            }
        }
        .navigationTitle("Community Tip")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Error", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .task {
            await loadTip()
        }
    }

    private func titleSection(tip: CommunityTipPublicDetail) -> some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            Text(tip.title)
                .font(.title2.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)

            HStack(spacing: MoatTheme.Spacing.medium) {
                if let author = tip.author, tip.attribution == .public {
                    Text("by \(author.displayName)")
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                } else {
                    Text("Anonymous member")
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                }
                if tip.personallyTested {
                    Label("Personally tested", systemImage: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(MoatTheme.ColorToken.positive)
                }
            }

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
        }
    }

    @ViewBuilder
    private func bodySection(tip: CommunityTipPublicDetail) -> some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            Text(tip.body)
                .font(.body)
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)

            if let url = tip.externalUrl, let parsedUrl = URL(string: url) {
                Link(destination: parsedUrl) {
                    Label("Learn more", systemImage: "arrow.up.right.square")
                        .font(.subheadline)
                }
                .foregroundStyle(MoatTheme.ColorToken.accent)
            }
        }
    }

    @ViewBuilder
    private func metaSection(tip: CommunityTipPublicDetail) -> some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            if let potentialBenefit = tip.potentialBenefit {
                metaRow(label: "Potential benefit", value: potentialBenefit)
            }
            if let savings = tip.estimatedSavingsPercent {
                metaRow(label: "Est. savings", value: "\(Int(savings))%")
            }
            if let savingsAmount = tip.estimatedSavingsAmount {
                metaRow(label: "Est. savings amount", value: CurrencyFormatter.format(savingsAmount))
            }
            if !tip.requirements.isEmpty {
                metaRow(label: "Requirements", value: tip.requirements.joined(separator: ", "))
            }
        }
    }

    private func metaRow(label: String, value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .frame(width: 140, alignment: .leading)
            Text(value)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
            Spacer()
        }
    }

    private func likeSection(tip: CommunityTipPublicDetail) -> some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Label("\(likeCount)", systemImage: likedByCurrentUser ? "heart.fill" : "heart")
                .font(.subheadline)
                .foregroundStyle(likedByCurrentUser ? MoatTheme.ColorToken.destructive : MoatTheme.ColorToken.textSecondary)

            Button {
                Task { await toggleLike() }
            } label: {
                Text(likedByCurrentUser ? "Liked" : "Like")
                    .font(.subheadline.weight(.medium))
                    .padding(.horizontal, MoatTheme.Spacing.medium)
                    .padding(.vertical, MoatTheme.Spacing.small)
                    .background(likedByCurrentUser ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.mutedSurface)
                    .foregroundStyle(likedByCurrentUser ? Color.white : MoatTheme.ColorToken.textPrimary)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
    }

    private func loadTip(showLoading: Bool = true) async {
        if showLoading {
            isLoading = true
        }
        do {
            let loaded = try await service.get(tipId: tipId)
            tip = loaded
            likeCount = loaded.likeCount
            likedByCurrentUser = loaded.likedByCurrentUser
        } catch {
            AppLogger.error(
                "Failed to load community tip detail",
                metadata: ["tipId": tipId, "error": error.localizedDescription]
            )
        }
        if showLoading {
            isLoading = false
        }
    }

    private func toggleLike() async {
        do {
            if likedByCurrentUser {
                likeCount = max(0, likeCount - 1)
                likedByCurrentUser = false
                let updated = try await service.unlike(tipId: tipId)
                likeCount = updated.likeCount
                likedByCurrentUser = updated.likedByCurrentUser
            } else {
                likeCount += 1
                likedByCurrentUser = true
                let updated = try await service.like(tipId: tipId)
                likeCount = updated.likeCount
                likedByCurrentUser = updated.likedByCurrentUser
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        CommunityTipDetailView(tipId: "preview-id")
    }
}
