import SwiftUI

private struct SheetContentHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

struct MoatGlassSheet<Content: View, Footer: View>: View {
    let title: String
    let showsCloseButton: Bool
    let includesFooter: Bool
    let verticallyCentersContent: Bool
    let keyboardSuggestions: [String]
    let onSelectKeyboardSuggestion: ((String) -> Void)?
    let content: Content
    let footer: Footer

    @SwiftUI.Environment(\.dismiss) private var dismiss

    init(
        title: String,
        showsCloseButton: Bool = false,
        includesFooter: Bool = true,
        verticallyCentersContent: Bool = false,
        keyboardSuggestions: [String] = [],
        onSelectKeyboardSuggestion: ((String) -> Void)? = nil,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        self.title = title
        self.showsCloseButton = showsCloseButton
        self.includesFooter = includesFooter
        self.verticallyCentersContent = verticallyCentersContent
        self.keyboardSuggestions = keyboardSuggestions
        self.onSelectKeyboardSuggestion = onSelectKeyboardSuggestion
        self.content = content()
        self.footer = footer()
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if verticallyCentersContent {
                    content
                        .padding(.horizontal, MoatTheme.Spacing.large)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                } else {
                    ScrollView {
                        content
                            .padding(.horizontal, MoatTheme.Spacing.large)
                            .padding(.top, MoatTheme.Spacing.medium)
                            .padding(.bottom, MoatTheme.Spacing.medium)
                    }
                }

                if includesFooter {
                    footer
                        .padding(.horizontal, MoatTheme.Spacing.large)
                        .padding(.top, MoatTheme.Spacing.medium)
                        .padding(.bottom, MoatTheme.Spacing.xLarge)
                }
            }
            .frame(maxHeight: .infinity, alignment: verticallyCentersContent ? .center : .top)
            .background(MoatTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(title.isEmpty && !showsCloseButton ? .hidden : .automatic, for: .navigationBar)
            .toolbar {
                if showsCloseButton {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Close") { dismiss() }
                    }
                }
                MoatKeyboardDismissToolbar(
                    suggestions: keyboardSuggestions,
                    onSelectSuggestion: onSelectKeyboardSuggestion
                )
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .moatSheetCornerRadius(36)
    }
}

extension MoatGlassSheet where Footer == EmptyView {
    init(
        title: String,
        showsCloseButton: Bool = false,
        verticallyCentersContent: Bool = false,
        keyboardSuggestions: [String] = [],
        onSelectKeyboardSuggestion: ((String) -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.showsCloseButton = showsCloseButton
        self.includesFooter = false
        self.verticallyCentersContent = verticallyCentersContent
        self.keyboardSuggestions = keyboardSuggestions
        self.onSelectKeyboardSuggestion = onSelectKeyboardSuggestion
        self.content = content()
        self.footer = EmptyView()
    }
}

struct MoatFittedGlassSheet<Content: View, Footer: View>: View {
    let title: String
    let extraDetentHeight: CGFloat
    let includesFooter: Bool
    let content: Content
    let footer: Footer

    @State private var detentHeight: CGFloat = 320

    init(
        title: String,
        extraDetentHeight: CGFloat = 0,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        self.title = title
        self.extraDetentHeight = extraDetentHeight
        self.includesFooter = true
        self.content = content()
        self.footer = footer()
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                content
                    .padding(.horizontal, MoatTheme.Spacing.large)
                    .padding(.top, MoatTheme.Spacing.medium)
                    .padding(.bottom, includesFooter ? MoatTheme.Spacing.medium : MoatTheme.Spacing.large)

                if includesFooter {
                    footer
                        .padding(.horizontal, MoatTheme.Spacing.large)
                        .padding(.top, MoatTheme.Spacing.medium)
                        .padding(.bottom, MoatTheme.Spacing.large)
                }
            }
            .background {
                GeometryReader { proxy in
                    Color.clear
                        .preference(key: SheetContentHeightKey.self, value: proxy.size.height)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(title.isEmpty ? .hidden : .automatic, for: .navigationBar)
            .moatKeyboardDismissToolbar()
        }
        .background(MoatTheme.ColorToken.appBackground.ignoresSafeArea())
        .onPreferenceChange(SheetContentHeightKey.self) { height in
            guard height > 0 else { return }
            let navigationBarAllowance: CGFloat = title.isEmpty ? 8 : 52
            detentHeight = height + navigationBarAllowance + extraDetentHeight
        }
        .presentationDetents([.height(detentHeight)])
        .presentationDragIndicator(.visible)
        .moatSheetCornerRadius(36)
    }
}

extension MoatFittedGlassSheet where Footer == EmptyView {
    init(title: String, extraDetentHeight: CGFloat = 0, @ViewBuilder content: () -> Content) {
        self.title = title
        self.extraDetentHeight = extraDetentHeight
        self.includesFooter = false
        self.content = content()
        self.footer = EmptyView()
    }
}

struct MoatSheetActionBar<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            content
        }
    }
}

private extension View {
    @ViewBuilder
    func moatSheetCornerRadius(_ radius: CGFloat) -> some View {
        if #available(iOS 16.4, *) {
            presentationCornerRadius(radius)
        } else {
            self
        }
    }
}
