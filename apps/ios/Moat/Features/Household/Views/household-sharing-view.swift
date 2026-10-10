import SwiftUI

enum HouseholdPresentation {
    case page
    case embedded
}

struct HouseholdSharingView: View {
    var presentation: HouseholdPresentation = .page

    @StateObject private var viewModel = HouseholdViewModel()
    @State private var inviteName = ""
    @State private var inviteEmail = ""
    @State private var showInviteSheet = false
    @State private var showRemoveAccessSheet = false

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                if presentation == .page {
                    LoadingView("Loading household...")
                } else {
                    embeddedLoadingCard
                }
            case .loaded, .refreshing:
                if presentation == .page {
                    pageLoadedContent
                } else {
                    embeddedLoadedCard
                }
            case .error(let error):
                if presentation == .page {
                    ErrorStateView(error: error) {
                        Task { await viewModel.refresh() }
                    }
                } else {
                    embeddedErrorCard(error)
                }
            }
        }
        .modifier(HouseholdNavigationChrome(presentation: presentation))
        .sheet(isPresented: $showInviteSheet) {
            inviteSheet
        }
        .sheet(isPresented: $showRemoveAccessSheet) {
            removeAccessSheet
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

    private var actionMessageBinding: Binding<HouseholdActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var pageLoadedContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                pageHeader
                householdContent
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }

    private var pageHeader: some View {
        HStack(alignment: .center) {
            Text("Household")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Spacer(minLength: MoatTheme.Spacing.large)

            if viewModel.canInvite {
                FinancialProfileSectionActionButton(title: "Member", action: openInviteSheet)
            }
        }
        .padding(.top, MoatTheme.Spacing.xLarge)
    }

    private var embeddedLoadingCard: some View {
        MoatCard {
            HStack(spacing: MoatTheme.Spacing.medium) {
                ProgressView()
                Text("Loading household...")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var embeddedLoadedCard: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                householdContent
            }
        }
    }

    @ViewBuilder
    private var householdContent: some View {
        if presentation == .embedded {
            HouseholdSectionHeader(
                title: "Household",
                systemImage: "person.2.fill",
                canInvite: viewModel.canInvite,
                onInvite: openInviteSheet
            )
        }

        if let household = viewModel.household {
            if presentation == .page {
                MoatCard {
                    householdMembersCardContent(household: household)
                }
            } else {
                householdMembersCardContent(household: household)
            }

            if household.canManage, household.membership != nil {
                Text("You can only have one other person right now.")
                    .font(.caption)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
    }

    @ViewBuilder
    private func householdMembersCardContent(household: HouseholdState) -> some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            if presentation == .page {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    Label("Members", systemImage: "person.2.fill")
                        .font(.headline)
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    Text("Share your financial dashboard with your household.")
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                }
            }

            VStack(spacing: 0) {
                HouseholdOwnerRow(owner: household.owner)

                if let membership = household.membership {
                    Divider().padding(.vertical, MoatTheme.Spacing.small)
                    HouseholdMemberRow(
                        membership: membership,
                        canManage: household.canManage,
                        onRemove: { showRemoveAccessSheet = true }
                    )
                } else if let invite = household.pendingInvite {
                    Divider().padding(.vertical, MoatTheme.Spacing.small)
                    HouseholdInviteRow(
                        invite: invite,
                        canManage: household.canManage,
                        onResend: { Task { await viewModel.resendInvite() } },
                        onRevoke: { Task { await viewModel.revokeInvite() } }
                    )
                } else if household.canManage {
                    Divider().padding(.vertical, MoatTheme.Spacing.small)
                    HouseholdEmptyMemberSlot()
                }
            }
        }
    }

    @ViewBuilder
    private var removeAccessSheet: some View {
        if let membership = viewModel.household?.membership {
            MoatGlassSheet(title: "Remove access") {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    Text(membership.member.displayName)
                        .font(.headline)
                    Text("This removes their access to your financial dashboard. You can invite someone again later.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
            } footer: {
                MoatSheetActionBar {
                    Button {
                        showRemoveAccessSheet = false
                    } label: {
                        Text("Cancel").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)
                    .disabled(isRefreshing)

                    Button(role: .destructive) {
                        Task {
                            await viewModel.removeMember()
                            if viewModel.actionMessage?.title == "Access removed" {
                                showRemoveAccessSheet = false
                            }
                        }
                    } label: {
                        Group {
                            if isRefreshing {
                                ProgressView()
                            } else {
                                Text("Remove Access")
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatDestructive)
                    .disabled(isRefreshing)
                }
            }
        }
    }

    private var inviteSheet: some View {
        MoatGlassSheet(title: "Invite household member") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Text("Invite one household member to access the dashboard.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                MoatTextField(
                    placeholder: "Name",
                    text: $inviteName,
                    textContentType: .name
                )

                MoatTextField(
                    placeholder: "Email",
                    text: $inviteEmail,
                    keyboardType: .emailAddress,
                    textContentType: .emailAddress,
                    autocapitalization: .never,
                    autocorrectionDisabled: true
                )
            }
        } footer: {
            MoatSheetActionBar {
                Button {
                    showInviteSheet = false
                } label: {
                    Text("Cancel").frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)

                Button {
                    HapticFeedback.saveOrSubmit()
                    Task {
                        await viewModel.invite(name: inviteName, email: inviteEmail)
                        if viewModel.actionMessage?.title == "Invite sent" {
                            showInviteSheet = false
                        }
                    }
                } label: {
                    Group {
                        if case .refreshing = viewModel.state {
                            ProgressView()
                        } else {
                            Text("Send Invite")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatPrimary)
                .disabled(!viewModel.canInvite || isRefreshing)
            }
        }
    }

    private var isRefreshing: Bool {
        if case .refreshing = viewModel.state { return true }
        return false
    }

    private func openInviteSheet() {
        inviteName = ""
        inviteEmail = ""
        showInviteSheet = true
    }

    private func embeddedErrorCard(_ error: Error) -> some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HouseholdSectionHeader(
                    title: "Household",
                    systemImage: "person.2.fill",
                    canInvite: false,
                    onInvite: {}
                )
                Text(error.localizedDescription)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.destructive)
                Button {
                    Task { await viewModel.refresh() }
                } label: {
                    Label("Retry", systemImage: "arrow.clockwise")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)
            }
        }
    }
}

private struct HouseholdNavigationChrome: ViewModifier {
    let presentation: HouseholdPresentation

    @ViewBuilder
    func body(content: Content) -> some View {
        if presentation == .page {
            content
                .navigationTitle("")
                .navigationBarTitleDisplayMode(.inline)
                .toolbarBackground(MoatTheme.ColorToken.appBackground, for: .navigationBar)
                .toolbarBackground(.visible, for: .navigationBar)
        } else {
            content
        }
    }
}

private struct HouseholdSectionHeader: View {
    let title: String
    let systemImage: String
    let canInvite: Bool
    let onInvite: () -> Void

    var body: some View {
        HStack {
            Image(systemName: systemImage)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            Text(title)
                .font(.headline)

            Spacer()

            if canInvite {
                FinancialProfileSectionActionButton(title: "Member", action: onInvite)
            }
        }
    }
}

private struct HouseholdOwnerRow: View {
    let owner: HouseholdOwnerSummary

    private var displayName: String {
        if let name = owner.name, !name.isEmpty { return name }
        return "You"
    }

    var body: some View {
        HouseholdPersonRow(
            name: displayName,
            email: owner.email,
            badge: "Owner",
            badgeTint: MoatTheme.ColorToken.textSecondary,
            systemImage: "crown.fill"
        )
    }
}

private struct HouseholdPersonRow<Trailing: View>: View {
    let name: String
    let email: String?
    let badge: String?
    let badgeTint: Color
    let systemImage: String
    let trailing: Trailing

    init(
        name: String,
        email: String?,
        badge: String?,
        badgeTint: Color,
        systemImage: String,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.name = name
        self.email = email
        self.badge = badge
        self.badgeTint = badgeTint
        self.systemImage = systemImage
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .frame(width: 40, height: 40)
                .background(MoatTheme.ColorToken.mutedSurface)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .center, spacing: MoatTheme.Spacing.small) {
                    Text(name)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Spacer(minLength: MoatTheme.Spacing.small)
                    if let badge {
                        HouseholdStatusBadge(label: badge, tint: badgeTint)
                    }
                }

                if let email, !email.isEmpty {
                    Text(email)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            trailing
        }
        .padding(.vertical, MoatTheme.Spacing.xSmall)
    }
}

extension HouseholdPersonRow where Trailing == EmptyView {
    init(name: String, email: String?, badge: String?, badgeTint: Color, systemImage: String) {
        self.init(
            name: name,
            email: email,
            badge: badge,
            badgeTint: badgeTint,
            systemImage: systemImage
        ) {
            EmptyView()
        }
    }
}

private struct HouseholdEmptyMemberSlot: View {
    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: "person.badge.plus")
                .font(.body.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .frame(width: 40, height: 40)
                .background(MoatTheme.ColorToken.mutedSurface)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text("No member yet")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                Text("Invite someone to share your dashboard.")
                    .font(.caption)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, MoatTheme.Spacing.xSmall)
    }
}

private struct HouseholdStatusBadge: View {
    let label: String
    let tint: Color

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, MoatTheme.Spacing.small)
            .padding(.vertical, MoatTheme.Spacing.xSmall)
            .background(tint.opacity(0.12))
            .clipShape(Capsule())
    }
}

private struct HouseholdMemberRow: View {
    let membership: HouseholdMembershipSummary
    let canManage: Bool
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            HouseholdPersonRow(
                name: membership.member.displayName,
                email: membership.member.email,
                badge: "Full Access",
                badgeTint: MoatTheme.ColorToken.positive,
                systemImage: "checkmark.seal.fill"
            ) {
                if canManage {
                    Menu {
                        Button(role: .destructive, action: onRemove) {
                            Label("Remove", systemImage: "trash")
                        }
                    } label: {
                        MoatMoreMenuIcon(orientation: .horizontal)
                    }
                    .accessibilityLabel("Member actions")
                }
            }

            Text("Full dashboard access since \(DateFormatterProvider.fullDate(membership.createdAt)).")
                .font(.caption)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .padding(.leading, 52)
        }
    }
}

private struct HouseholdInviteRow: View {
    let invite: HouseholdInviteSummary
    let canManage: Bool
    let onResend: () -> Void
    let onRevoke: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                HouseholdPersonRow(
                    name: invite.inviteeName,
                    email: invite.inviteeEmail,
                    badge: "Pending",
                    badgeTint: MoatTheme.ColorToken.warning,
                    systemImage: "envelope.badge"
                )

                Text("Expires \(DateFormatterProvider.fullDate(invite.expiresAt))")
                    .font(.caption)
                    .foregroundStyle(MoatTheme.ColorToken.warning)
                    .padding(.leading, 52)
            }

            if canManage {
                HStack(spacing: MoatTheme.Spacing.small) {
                    Button(action: onResend) {
                        Label("Resend", systemImage: "arrow.clockwise")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)

                    Button(role: .destructive, action: onRevoke) {
                        Label("Revoke", systemImage: "xmark")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatDestructive)
                }
            }
        }
    }
}
