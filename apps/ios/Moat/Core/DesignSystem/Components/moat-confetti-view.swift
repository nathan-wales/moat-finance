import SwiftUI

struct MoatSideConfettiView: View {
    @State private var origin = Date()

    private let duration: TimeInterval = 2.8
    private let gravity: Double = 540

    private let colors: [Color] = [
        MoatTheme.ColorToken.accent,
        MoatTheme.ColorToken.positive,
        MoatTheme.ColorToken.warning,
        MoatTheme.ColorToken.chartSecondary,
        Color(red: 0.95, green: 0.42, blue: 0.52),
        Color(red: 0.55, green: 0.84, blue: 0.96),
    ]

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let elapsed = timeline.date.timeIntervalSince(origin)
                guard elapsed >= 0, elapsed <= duration else { return }

                for index in 0..<Self.particleCount {
                    drawParticle(
                        context: &context,
                        size: size,
                        index: index,
                        elapsed: elapsed,
                        fromLeft: true
                    )
                    drawParticle(
                        context: &context,
                        size: size,
                        index: index,
                        elapsed: elapsed,
                        fromLeft: false
                    )
                }
            }
        }
        .allowsHitTesting(false)
        .onAppear {
            origin = Date()
        }
    }

    private static let particleCount = 56

    private func drawParticle(
        context: inout GraphicsContext,
        size: CGSize,
        index: Int,
        elapsed: TimeInterval,
        fromLeft: Bool
    ) {
        let seed = Double(index * 2 + (fromLeft ? 0 : 1))
        let launchY = size.height * seededValue(seed: seed, range: 0.14...0.30)
        let launchDelay = seededValue(seed: seed + 0.3, range: 0...0.4)
        let t = elapsed - launchDelay
        guard t > 0 else { return }

        let originX = fromLeft ? -10.0 : size.width + 10.0
        let horizontalSpeed = fromLeft
            ? seededValue(seed: seed + 1, range: 140...300)
            : -seededValue(seed: seed + 1, range: 140...300)
        let verticalSpeed = -seededValue(seed: seed + 2, range: 200...440)

        let x = originX + horizontalSpeed * t
        let y = launchY + verticalSpeed * t + 0.5 * gravity * t * t

        guard y < size.height + 48, x > -48, x < size.width + 48 else { return }

        let particleWidth = seededValue(seed: seed + 4, range: 6...10)
        let particleHeight = seededValue(seed: seed + 5, range: 10...16)
        let rotation = Angle(
            degrees: seededValue(seed: seed + 6, range: 0...360)
                + t * seededValue(seed: seed + 7, range: 140...320)
        )
        let color = colors[index % colors.count]
        let opacity = fadeOpacity(elapsed: elapsed)

        var pieceContext = context
        pieceContext.translateBy(x: x, y: y)
        pieceContext.rotate(by: rotation)

        let rect = CGRect(
            x: -particleWidth / 2,
            y: -particleHeight / 2,
            width: particleWidth,
            height: particleHeight
        )

        let shape = seededValue(seed: seed + 8, range: 0...1) > 0.35
        if shape {
            pieceContext.fill(
                Path(roundedRect: rect, cornerRadius: 2, style: .continuous),
                with: .color(color.opacity(opacity))
            )
        } else {
            pieceContext.fill(
                Path(ellipseIn: rect),
                with: .color(color.opacity(opacity))
            )
        }
    }

    private func fadeOpacity(elapsed: TimeInterval) -> Double {
        let fadeStart = duration - 0.9
        guard elapsed > fadeStart else { return 1 }
        return max(0, 1 - (elapsed - fadeStart) / 0.9)
    }

    private func seededValue(seed: Double, range: ClosedRange<Double>) -> Double {
        let value = sin(seed * 127.1 + 311.7) * 43_758.5453
        let normalized = value - floor(value)
        return range.lowerBound + normalized * (range.upperBound - range.lowerBound)
    }
}
