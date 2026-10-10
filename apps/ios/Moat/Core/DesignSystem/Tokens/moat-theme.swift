import SwiftUI

extension Color {
    /// Adaptive color that resolves per trait collection, enabling first-class light/dark support.
    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}

enum MoatAppearance: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    static let storageKey = "moat.appearance"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }

    var systemImage: String {
        switch self {
        case .system: return "circle.lefthalf.filled"
        case .light: return "sun.max"
        case .dark: return "moon"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

enum MoatTheme {
    enum Spacing {
        static let xSmall: CGFloat = 4
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
        static let xLarge: CGFloat = 24
        static let xxLarge: CGFloat = 32
        static let xxxLarge: CGFloat = 40
    }

    enum Radius {
        static let small: CGFloat = 10
        static let medium: CGFloat = 14
        static let large: CGFloat = 20
        static let xLarge: CGFloat = 24
        static let pill: CGFloat = 999
    }

    enum Size {
        static let buttonHeight: CGFloat = 52
        static let buttonHeightSmall: CGFloat = 41
        static let buttonHeightCompact: CGFloat = 34
        static let inputHeight: CGFloat = 44
    }

    enum ColorToken {
        // Ink — the near-monochrome primary action color (black in light, white in dark)
        static let ink = Color(
            light: Color(red: 0.09, green: 0.09, blue: 0.11),
            dark: Color(red: 0.96, green: 0.96, blue: 0.97)
        )
        static let inkInverse = Color(
            light: .white,
            dark: Color(red: 0.07, green: 0.07, blue: 0.08)
        )
        /// Neutral swipe-action fill — dark enough in both modes that white glyphs stay legible.
        static let swipeNeutral = Color(
            light: Color(red: 0.09, green: 0.09, blue: 0.11),
            dark: Color(red: 0.30, green: 0.30, blue: 0.34)
        )

        // Brand accent — used sparingly for focus, links, and chart emphasis
        static let accent = Color(
            light: Color(red: 0.24, green: 0.39, blue: 0.87),
            dark: Color(red: 0.48, green: 0.60, blue: 0.97)
        )
        static let accentStrong = Color(
            light: Color(red: 0.16, green: 0.30, blue: 0.76),
            dark: Color(red: 0.58, green: 0.68, blue: 0.98)
        )
        static let accentSoft = Color(
            light: Color(red: 0.91, green: 0.93, blue: 0.99),
            dark: Color(red: 0.14, green: 0.17, blue: 0.28)
        )
        /// Toggle ON track — same saturated blue in light and dark so the active state is always obvious.
        static let toggleOn = Color(red: 0.24, green: 0.39, blue: 0.87)

        // Semantic
        static let positive = Color(
            light: Color(red: 0.10, green: 0.55, blue: 0.33),
            dark: Color(red: 0.24, green: 0.77, blue: 0.52)
        )
        static let positiveSoft = Color(
            light: Color(red: 0.90, green: 0.96, blue: 0.92),
            dark: Color(red: 0.09, green: 0.20, blue: 0.14)
        )
        static let warning = Color(
            light: Color(red: 0.83, green: 0.50, blue: 0.05),
            dark: Color(red: 0.96, green: 0.69, blue: 0.26)
        )
        static let destructive = Color(
            light: Color(red: 0.83, green: 0.20, blue: 0.24),
            dark: Color(red: 0.95, green: 0.41, blue: 0.42)
        )
        static let destructiveSoft = Color(
            light: Color(red: 0.99, green: 0.93, blue: 0.93),
            dark: Color(red: 0.24, green: 0.10, blue: 0.10)
        )

        // Text
        static let textPrimary = Color(
            light: Color(red: 0.09, green: 0.09, blue: 0.11),
            dark: Color(red: 0.95, green: 0.95, blue: 0.96)
        )
        static let textSecondary = Color(
            light: Color(red: 0.42, green: 0.42, blue: 0.46),
            dark: Color(red: 0.63, green: 0.63, blue: 0.67)
        )
        static let textTertiary = Color(
            light: Color(red: 0.58, green: 0.58, blue: 0.62),
            dark: Color(red: 0.47, green: 0.47, blue: 0.51)
        )

        // Surfaces
        static let appBackground = Color(
            light: Color(red: 0.972, green: 0.972, blue: 0.976),
            dark: Color(red: 0.051, green: 0.051, blue: 0.059)
        )
        static let surface = Color(
            light: .white,
            dark: Color(red: 0.094, green: 0.094, blue: 0.106)
        )
        // Used as a chip / inset background inside cards — slightly offset from `surface`
        static let elevatedSurface = Color(
            light: Color(red: 0.953, green: 0.953, blue: 0.957),
            dark: Color(red: 0.137, green: 0.137, blue: 0.149)
        )
        static let mutedSurface = Color(
            light: Color(red: 0.945, green: 0.945, blue: 0.951),
            dark: Color(red: 0.137, green: 0.137, blue: 0.149)
        )
        /// Soft grey in light mode, charcoal in dark — Airbnb-style loading placeholders.
        static let skeleton = Color(
            light: Color(red: 0.910, green: 0.910, blue: 0.922),
            dark: Color(red: 0.165, green: 0.165, blue: 0.180)
        )

        // Hairline borders
        static let border = Color(
            light: Color.black.opacity(0.08),
            dark: Color.white.opacity(0.10)
        )
        static let softBorder = Color(
            light: Color.black.opacity(0.05),
            dark: Color.white.opacity(0.06)
        )
        static let gray200 = Color(
            light: Color(red: 0.898, green: 0.906, blue: 0.922),
            dark: Color(red: 0.122, green: 0.161, blue: 0.216)
        )
        static let focusRing = Color(
            light: Color(red: 0.749, green: 0.859, blue: 0.996),
            dark: Color(red: 0.34, green: 0.44, blue: 0.78)
        )

        // Charts
        static let chartPrimary = accent
        static let chartPositive = positive
        static let chartNegative = destructive
        static let chartSelection = accent
        static let chartSecondaryText = textTertiary
        static let chartSecondary = Color(
            light: Color(red: 0.55, green: 0.66, blue: 0.97),
            dark: Color(red: 0.34, green: 0.44, blue: 0.78)
        )
        static let chartMuted = Color(
            light: Color.black.opacity(0.10),
            dark: Color.white.opacity(0.12)
        )
        static let chartGrid = Color(
            light: Color.black.opacity(0.05),
            dark: Color.white.opacity(0.06)
        )
        static let chartNeutral = chartMuted
    }

    enum Shadow {
        static let card = Color(
            light: Color.black.opacity(0.05),
            dark: Color.black.opacity(0.30)
        )
        static let soft = Color(
            light: Color.black.opacity(0.03),
            dark: Color.black.opacity(0.20)
        )
        static let glass = Color(
            light: Color.black.opacity(0.08),
            dark: Color.black.opacity(0.40)
        )
    }
}

// MARK: - Surface modifiers

struct MoatCardBackground: ViewModifier {
    let cornerRadius: CGFloat
    let shadow: Bool
    let borderColor: Color
    let borderWidth: CGFloat

    func body(content: Content) -> some View {
        content
            .background(MoatTheme.ColorToken.surface)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(borderColor, lineWidth: borderWidth)
            }
            .shadow(
                color: shadow ? MoatTheme.Shadow.soft : .clear,
                radius: shadow ? 1 : 0,
                x: 0,
                y: shadow ? 1 : 0
            )
            .shadow(
                color: shadow ? MoatTheme.Shadow.card : .clear,
                radius: shadow ? 16 : 0,
                x: 0,
                y: shadow ? 8 : 0
            )
    }
}

struct MoatGlassBackground: ViewModifier {
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        #if __IPHONE_26_0
        if #available(iOS 26.0, *) {
            content.moatGlassEffect(in: shape)
        } else {
            legacyGlassEffect(content: content, shape: shape)
        }
        #else
        legacyGlassEffect(content: content, shape: shape)
        #endif
    }

    @ViewBuilder
    private func legacyGlassEffect(content: Content, shape: RoundedRectangle) -> some View {
        content
            .background(.ultraThinMaterial)
            .clipShape(shape)
            .overlay {
                shape.strokeBorder(
                    Color(
                        light: Color.white.opacity(0.45),
                        dark: Color.white.opacity(0.12)
                    ),
                    lineWidth: 1
                )
            }
            .shadow(color: MoatTheme.Shadow.glass, radius: 20, x: 0, y: 10)
    }
}

#if __IPHONE_26_0
@available(iOS 26.0, *)
private extension View {
    func moatGlassEffect(in shape: RoundedRectangle) -> some View {
        glassEffect(.regular, in: shape)
    }
}
#endif

extension View {
    func moatCard(
        cornerRadius: CGFloat = MoatTheme.Radius.large,
        shadow: Bool = true,
        borderColor: Color = MoatTheme.ColorToken.border,
        borderWidth: CGFloat = 1
    ) -> some View {
        modifier(
            MoatCardBackground(
                cornerRadius: cornerRadius,
                shadow: shadow,
                borderColor: borderColor,
                borderWidth: borderWidth
            )
        )
    }

    func moatGlass(cornerRadius: CGFloat = MoatTheme.Radius.large) -> some View {
        modifier(MoatGlassBackground(cornerRadius: cornerRadius))
    }

    func moatPageBackground() -> some View {
        background(MoatTheme.ColorToken.appBackground.ignoresSafeArea())
    }

    /// Keeps vertical rubber-banding, but disables horizontal bounce when content
    /// is only as wide as the viewport (prevents accidental overflow-x scrolling).
    @ViewBuilder
    func scrollBounceBehaviorIfAvailable() -> some View {
        if #available(iOS 16.4, *) {
            self.scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        } else {
            self
        }
    }
}

// MARK: - Button styles

enum MoatButtonSize {
    case `default`
    case small
    case compact

    var height: CGFloat {
        switch self {
        case .default: MoatTheme.Size.buttonHeight
        case .small: MoatTheme.Size.buttonHeightSmall
        case .compact: MoatTheme.Size.buttonHeightCompact
        }
    }

    var font: Font {
        switch self {
        case .default: .body
        case .small: .subheadline
        case .compact: .caption
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .default: MoatTheme.Spacing.large
        case .small: MoatTheme.Spacing.medium
        case .compact: MoatTheme.Spacing.small
        }
    }
}

struct MoatPrimaryButtonStyle: ButtonStyle {
    var size: MoatButtonSize = .default
    @SwiftUI.Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font.weight(.semibold))
            .foregroundStyle(MoatTheme.ColorToken.inkInverse)
            .padding(.horizontal, size.horizontalPadding)
            .frame(maxWidth: .infinity)
            .frame(height: size.height)
            .background(MoatTheme.ColorToken.ink.opacity(isEnabled ? 1 : 0.35))
            .clipShape(Capsule())
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

struct MoatSecondaryButtonStyle: ButtonStyle {
    var size: MoatButtonSize = .default
    @SwiftUI.Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font.weight(.medium))
            .foregroundStyle(MoatTheme.ColorToken.textPrimary)
            .padding(.horizontal, size.horizontalPadding)
            .frame(maxWidth: .infinity)
            .frame(height: size.height)
            .background(MoatTheme.ColorToken.surface)
            .clipShape(Capsule())
            .overlay {
                Capsule().strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
            }
            .opacity(isEnabled ? 1 : 0.4)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

struct MoatDestructiveButtonStyle: ButtonStyle {
    var size: MoatButtonSize = .default
    @SwiftUI.Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font.weight(.semibold))
            .foregroundStyle(MoatTheme.ColorToken.destructive)
            .padding(.horizontal, size.horizontalPadding)
            .frame(maxWidth: .infinity)
            .frame(height: size.height)
            .background(MoatTheme.ColorToken.destructiveSoft)
            .clipShape(Capsule())
            .overlay {
                Capsule().strokeBorder(MoatTheme.ColorToken.destructive.opacity(0.25), lineWidth: 1)
            }
            .opacity(isEnabled ? 1 : 0.4)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == MoatPrimaryButtonStyle {
    static var moatPrimary: MoatPrimaryButtonStyle { MoatPrimaryButtonStyle() }
    static var moatPrimarySmall: MoatPrimaryButtonStyle { MoatPrimaryButtonStyle(size: .small) }
    static var moatPrimaryCompact: MoatPrimaryButtonStyle { MoatPrimaryButtonStyle(size: .compact) }
}

extension ButtonStyle where Self == MoatSecondaryButtonStyle {
    static var moatSecondary: MoatSecondaryButtonStyle { MoatSecondaryButtonStyle() }
    static var moatSecondarySmall: MoatSecondaryButtonStyle { MoatSecondaryButtonStyle(size: .small) }
    static var moatSecondaryCompact: MoatSecondaryButtonStyle { MoatSecondaryButtonStyle(size: .compact) }
}

extension ButtonStyle where Self == MoatDestructiveButtonStyle {
    static var moatDestructive: MoatDestructiveButtonStyle { MoatDestructiveButtonStyle() }
    static var moatDestructiveSmall: MoatDestructiveButtonStyle { MoatDestructiveButtonStyle(size: .small) }
    static var moatDestructiveCompact: MoatDestructiveButtonStyle { MoatDestructiveButtonStyle(size: .compact) }
}
