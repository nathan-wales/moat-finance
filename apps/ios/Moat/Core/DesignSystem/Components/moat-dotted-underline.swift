import SwiftUI

/// Draws a subtle dotted line under the text it is applied to. Applied to the
/// words themselves — never to a tappable container — so it never reads as a
/// border around a box.
struct MoatDottedUnderline: ViewModifier {
    var color: Color
    var isActive: Bool

    private var dash: [CGFloat] { isActive ? [] : [1, 2.5] }

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            UnderlineShape()
                .stroke(
                    color,
                    style: StrokeStyle(lineWidth: 1, lineCap: .round, dash: dash)
                )
                .frame(height: 1)
                .offset(y: 3)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }

    private struct UnderlineShape: Shape {
        func path(in rect: CGRect) -> Path {
            var path = Path()
            path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            return path
        }
    }
}

extension View {
    func moatDottedUnderline(
        color: Color = MoatTheme.ColorToken.textTertiary,
        isActive: Bool = false
    ) -> some View {
        modifier(MoatDottedUnderline(color: color, isActive: isActive))
    }
}
