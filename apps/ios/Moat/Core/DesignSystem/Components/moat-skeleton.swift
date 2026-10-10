import SwiftUI

/// Soft placeholder bar used for Airbnb-style loading skeletons.
/// Opacity pulses in place via TimelineView — never use SwiftUI `.animation` /
/// `withAnimation` for the pulse, or trailing bars slide as their width/position
/// interpolate during parent appear transitions.
struct MoatSkeleton: View {
    var width: CGFloat? = nil
    var height: CGFloat? = 12
    var cornerRadius: CGFloat = MoatTheme.Radius.small

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(MoatTheme.ColorToken.skeleton)
                .opacity(MoatSkeletonPulse.opacity(at: context.date))
                .frame(width: width, height: height)
                .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
        }
        .fixedSize(horizontal: width != nil, vertical: height != nil)
        .moatSkeletonStaticLayout()
        .accessibilityHidden(true)
    }
}

struct MoatSkeletonCircle: View {
    var size: CGFloat

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
            Circle()
                .fill(MoatTheme.ColorToken.skeleton)
                .opacity(MoatSkeletonPulse.opacity(at: context.date))
                .frame(width: size, height: size)
        }
        .fixedSize()
        .moatSkeletonStaticLayout()
        .accessibilityHidden(true)
    }
}

private enum MoatSkeletonPulse {
    static let period: TimeInterval = 2.2
    static let minimumOpacity = 0.55

    static func opacity(at date: Date) -> Double {
        let elapsed = date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: period)
        let wave = 0.5 - 0.5 * cos((elapsed / period) * 2 * .pi)
        return 1.0 - ((1.0 - minimumOpacity) * wave)
    }
}

struct MoatSkeletonFadeIn: ViewModifier {
    @State private var isVisible = false

    func body(content: Content) -> some View {
        content
            // Composite first so the fade only affects a single layer and cannot
            // drive child layout (trailing amount bars sliding on appear).
            .compositingGroup()
            .opacity(isVisible ? 1 : 0)
            .animation(.easeOut(duration: 0.45), value: isVisible)
            .onAppear {
                DispatchQueue.main.async {
                    isVisible = true
                }
            }
    }
}

extension View {
    func moatSkeletonFadeIn() -> some View {
        modifier(MoatSkeletonFadeIn())
    }

    /// Blocks inherited appear/transition animations so skeleton frames stay put.
    func moatSkeletonStaticLayout() -> some View {
        transaction { transaction in
            transaction.animation = nil
            transaction.disablesAnimations = true
        }
    }
}

#Preview("Light") {
    VStack(alignment: .leading, spacing: 12) {
        MoatSkeleton(width: 72, height: 12)
        MoatSkeleton(width: 220, height: 44, cornerRadius: MoatTheme.Radius.medium)
        MoatSkeletonCircle(size: 38)
        MoatSkeleton(width: 140, height: 26, cornerRadius: MoatTheme.Radius.pill)
        MoatSkeleton(height: nil, cornerRadius: MoatTheme.Radius.large)
            .aspectRatio(1.1, contentMode: .fit)
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .moatPageBackground()
    .preferredColorScheme(.light)
}

#Preview("Dark") {
    VStack(alignment: .leading, spacing: 12) {
        MoatSkeleton(width: 72, height: 12)
        MoatSkeleton(width: 220, height: 44, cornerRadius: MoatTheme.Radius.medium)
        MoatSkeletonCircle(size: 38)
        MoatSkeleton(width: 140, height: 26, cornerRadius: MoatTheme.Radius.pill)
        MoatSkeleton(height: nil, cornerRadius: MoatTheme.Radius.large)
            .aspectRatio(1.1, contentMode: .fit)
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .moatPageBackground()
    .preferredColorScheme(.dark)
}
