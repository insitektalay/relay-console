import Combine
import Foundation

@MainActor
final class FeatureOperationStore: ObservableObject {
  @Published private(set) var activeRequest: String?
  @Published private(set) var loading = false
  @Published private(set) var error: String?

  func begin(_ request: String) {
    activeRequest = request
    loading = true
    error = nil
  }

  func finish() {
    activeRequest = nil
    loading = false
  }

  func fail(_ message: String) {
    activeRequest = nil
    loading = false
    error = message
  }

  func beginRefresh() {
    loading = true
    error = nil
  }

  func finishRefresh() {
    loading = false
  }
}
