import SwiftUI

struct DemoModeBanner: View {
    @ObservedObject var viewModel: DemoModeViewModel

    var body: some View {
        HStack {
            Text("You're in demo mode")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)

            Spacer()

            Button {
                Task { await viewModel.exitDemoMode() }
            } label: {
                Text("Leave")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, MoatTheme.Spacing.medium)
                    .padding(.vertical, MoatTheme.Spacing.xSmall)
            }
            .background(MoatTheme.ColorToken.accentStrong)
            .clipShape(Capsule())
            .buttonStyle(.plain)
        }
        .padding(.horizontal, MoatTheme.Spacing.large)
        .padding(.top, MoatTheme.Spacing.small)
        .padding(.bottom, MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.accentSoft)
    }
}
