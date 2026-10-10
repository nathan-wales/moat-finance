import SwiftUI

struct AIAccessCompactActionButton: View {
    let title: String
    let systemImage: String
    let isLoading: Bool
    let isDisabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            if isLoading {
                ProgressView()
                    .frame(width: 20, height: 20)
            } else {
                Label(title, systemImage: systemImage)
                    .labelStyle(.titleAndIcon)
            }
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .frame(height: 36)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(Capsule())
        .overlay {
            Capsule().strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
        }
        .opacity(isDisabled ? 0.4 : 1)
        .buttonStyle(.plain)
        .disabled(isDisabled)
    }
}
