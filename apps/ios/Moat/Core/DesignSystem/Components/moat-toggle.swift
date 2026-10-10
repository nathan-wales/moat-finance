import SwiftUI
import UIKit

/// Switch styling that overrides the app-wide ink tint.
/// ON = saturated blue (`toggleOn`); OFF = system empty track. Required on every `Toggle`.
struct MoatSwitchToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Toggle(isOn: configuration.$isOn) {
            configuration.label
        }
        .toggleStyle(.switch)
        .tint(MoatTheme.ColorToken.toggleOn)
    }
}

extension ToggleStyle where Self == MoatSwitchToggleStyle {
    static var moatSwitch: MoatSwitchToggleStyle { MoatSwitchToggleStyle() }
}

extension View {
    func moatToggleStyle() -> some View {
        toggleStyle(.moatSwitch)
    }
}

enum MoatToggleAppearance {
    static func configure() {
        UISwitch.appearance().onTintColor = UIColor(MoatTheme.ColorToken.toggleOn)
    }
}
