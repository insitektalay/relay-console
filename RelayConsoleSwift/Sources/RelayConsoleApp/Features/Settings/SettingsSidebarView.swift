import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct SettingsSidebarPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 10) {
      SidebarSectionHeader(title: "Settings", icon: "gearshape")
      ScrollView {
        VStack(alignment: .leading, spacing: 14) {
          ForEach(SettingsPanelKey.visibleGroups) { group in
            VStack(alignment: .leading, spacing: 6) {
              Text(group.title.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(RCTheme.muted)
                .padding(.horizontal, 10)
                .accessibilityAddTraits(.isHeader)
              ForEach(group.panels) { panel in
                SettingsNavRow(
                  title: panel.navigationTitle,
                  subtitle: nil,
                  icon: panel.icon,
                  selected: model.settingsPanel == panel
                ) {
                  model.selectSettingsPanel(panel)
                }
              }
            }
          }
        }
      }
      Spacer()
    }
    .sidebarPanelChrome()
  }
}
