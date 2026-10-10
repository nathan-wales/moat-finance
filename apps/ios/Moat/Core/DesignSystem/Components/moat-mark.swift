import SwiftUI

/// Rook-and-moat mark. Asset variants match `packages/ui/src/assets/moat-finance-logo*.png`.
struct MoatMark: View {
    var size: CGFloat = 44

    var body: some View {
        Image("MoatMark")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityLabel("Moat Finance")
    }
}

/// Centered logo on the standard app page background, used for launch and lock screens.
struct MoatSplashView: View {
    var logoSize: CGFloat = 104

    var body: some View {
        MoatMark(size: logoSize)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .moatPageBackground()
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 32) {
        MoatMark(size: 44)
        MoatMark(size: 72)
        MoatMark(size: 104)
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .moatPageBackground()
}
