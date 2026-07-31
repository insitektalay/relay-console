import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct SettingsSidebarPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 10) {
      SidebarSectionHeader(title: "Settings", icon: "gearshape")
      ForEach(SettingsPanelKey.visiblePanels) { panel in
        SettingsNavRow(
          title: panel.navigationTitle,
          subtitle: nil,
          icon: panel.icon,
          selected: model.settingsPanel == panel
        ) {
          model.selectSettingsPanel(panel)
        }
      }
      Spacer()
    }
    .sidebarPanelChrome()
  }
}
