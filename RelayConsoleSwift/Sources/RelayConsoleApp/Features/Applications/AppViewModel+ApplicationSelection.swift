import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func clearMarketplaceSelection() {
    applicationsSelectedAppId = ""
    Task { await refreshApplicationsState() }
  }
}
