import SwiftUI

enum MoatMoreMenuIconOrientation {
    case vertical
    case horizontal
}

/// Standard more-menu trigger — three ink dots with no surrounding circle.
struct MoatMoreMenuIcon: View {
    var dotDiameter: CGFloat = 4
    var orientation: MoatMoreMenuIconOrientation = .vertical

    var body: some View {
        Group {
            switch orientation {
            case .vertical:
                VStack(spacing: 3) { dots }
            case .horizontal:
                HStack(spacing: 3) { dots }
            }
        }
        .frame(width: 20, height: 20)
        .frame(minWidth: 32, minHeight: 32)
        .contentShape(Rectangle())
        .accessibilityLabel("More")
    }

    @ViewBuilder
    private var dots: some View {
        ForEach(0..<3, id: \.self) { _ in
            Circle()
                .fill(MoatTheme.ColorToken.ink)
                .frame(width: dotDiameter, height: dotDiameter)
        }
    }
}

#Preview {
    HStack(spacing: 24) {
        MoatMoreMenuIcon()
        MoatMoreMenuIcon(orientation: .horizontal)
        MoatMoreMenuIcon(dotDiameter: 4.5, orientation: .horizontal)
    }
    .padding()
    .moatPageBackground()
}
