import SwiftUI

struct MoreMenuView: View {
    @ObservedObject private var navigation = AppNavigationCoordinator.shared
    @State private var path: [AppDestination] = []
    @State private var isFeedbackSheetPresented = false

    var body: some View {
        NavigationStack(path: $path) {
            moreMenuRoot
                .navigationTitle("More")
                .navigationBarTitleDisplayMode(.inline)
                .navigationDestination(for: AppDestination.self) { destination in
                    AppDestinationView(destination: destination)
                }
                .sheet(isPresented: $isFeedbackSheetPresented) {
                    FeedbackSheet(route: "more")
                }
        }
        .onAppear {
            consumePendingDestination()
        }
        .onChange(of: navigation.morePendingDestination) { _ in
            consumePendingDestination()
        }
    }

    private var moreMenuRoot: some View {
        List {
            ForEach(MoreMenuSection.allCases) { section in
                Section {
                    ForEach(section.destinations) { destination in
                        NavigationLink(value: destination) {
                            moreMenuRow(
                                title: destination.title,
                                systemImage: destination.systemImage
                            )
                        }
                        .listRowBackground(MoatTheme.ColorToken.surface)
                    }

                    if section == .settings {
                        Button {
                            isFeedbackSheetPresented = true
                        } label: {
                            moreMenuRow(
                                title: "Send Feedback",
                                systemImage: "bubble.left.and.bubble.right",
                                showsChevron: true
                            )
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(MoatTheme.ColorToken.surface)
                    }
                } header: {
                    moreMenuSectionHeader(section.title)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(MoatTheme.ColorToken.appBackground.ignoresSafeArea())
    }

    private func moreMenuSectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.footnote.weight(.regular))
            .foregroundStyle(MoatTheme.ColorToken.textTertiary)
            .textCase(nil)
    }

    private func moreMenuRow(
        title: String,
        systemImage: String,
        showsChevron: Bool = false
    ) -> some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: systemImage)
                .font(.body)
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                .frame(width: 28, alignment: .center)

            Text(title)
                .font(.body)
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)

            Spacer(minLength: 0)

            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(MoatTheme.ColorToken.textTertiary)
            }
        }
        .padding(.vertical, 2)
    }

    private func consumePendingDestination() {
        guard let destination = navigation.morePendingDestination else { return }
        path = [destination]
        navigation.morePendingDestination = nil
    }
}

struct AppDestinationView: View {
    let destination: AppDestination

    var body: some View {
        switch destination {
        case .accounts:
            FinancialProfileView()
        case .budget:
            BudgetView()
        case .rules:
            RulesView()
        case .notifications:
            NotificationsView()
        case .insights:
            InsightsView()
        case .categories:
            CategoriesView()
        case .whatIf:
            WhatIfView()
        case .investments:
            InvestmentsView()
        case .retirement:
            RetirementView()
        case .taxes:
            if ProductFlags.taxesEnabled {
                TaxesView()
            } else {
                TaxesUnavailableView()
            }
        case .mileage:
            MileageView()
        case .scenarios:
            ScenariosView()
        case .demoMode:
            DemoModeView()
        case .household:
            HouseholdSharingView()
        case .prompts:
            PromptsView()
        case .communityTips:
            CommunityTipsView()
        case .aiAccess:
            AIAccessView()
        case .accountSettings:
            AccountSettingsView()
        case .transactions:
            TransactionsView()
        }
    }
}

#Preview {
    MoreMenuView()
}
