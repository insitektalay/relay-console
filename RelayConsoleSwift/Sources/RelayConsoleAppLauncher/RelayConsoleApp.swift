import AppKit
import RelayConsoleAppUI
import SwiftUI

@main
struct RelayConsoleApp: App {
    @NSApplicationDelegateAdaptor(RelayConsoleAppDelegate.self) private var appDelegate
    @StateObject private var controller = RelayConsoleAppController()

    var body: some Scene {
        WindowGroup("Relay Console") {
            RelayConsoleRootView(controller: controller)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1700, height: 1180)
        .commands {
            CommandGroup(after: .appInfo) {
                Button("Check for Updates…") {
                    controller.updateController.checkForUpdates()
                }
                .disabled(!controller.updateController.canCheckForUpdates)
            }
            CommandGroup(replacing: .newItem) {
                Button("New Chat") {
                    controller.startNewChat()
                }
                .keyboardShortcut("n", modifiers: [.command])
            }
            CommandGroup(after: .help) {
                Button("Privacy Policy") {
                    openRelayPage("/privacy")
                }
                Button("Terms") {
                    openRelayPage("/terms")
                }
                Button("Acceptable Use") {
                    openRelayPage("/acceptable-use")
                }
                Divider()
                Button("Relay Support") {
                    openRelayPage("/support")
                }
                Button("Service Status") {
                    openRelayPage("/status")
                }
                Divider()
                Button("Third-Party Notices") {
                    openRelayPage("/third-party-notices")
                }
            }
        }
    }

    private func openRelayPage(_ path: String) {
        guard let url = URL(string: "https://relayconsole.work\(path)") else { return }
        NSWorkspace.shared.open(url)
    }
}

@MainActor
final class RelayConsoleAppDelegate: NSObject, NSApplicationDelegate {
    private var recoveryController: RelayConsoleAppController?
    private var recoveryWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.applicationIconImage = RelayConsoleAppAssets.applicationIcon()
        NSApplication.shared.activate(ignoringOtherApps: true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.ensureVisibleWindow()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        RelayConsoleAppController.flushTelemetry()
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        if urls.contains(where: { DesktopMarketplaceOAuthSession.shared.receiveOAuthCallback($0) }) {
            ensureVisibleWindow()
            application.activate(ignoringOtherApps: true)
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if flag {
            RelayConsoleWindowPresenter.present(sender.windows.first(where: \.isVisible) ?? sender.windows.first)
        } else {
            ensureVisibleWindow()
        }
        sender.activate(ignoringOtherApps: true)
        return true
    }

    private func ensureVisibleWindow() {
        if let visible = NSApplication.shared.windows.first(where: { $0.isVisible }) {
            RelayConsoleWindowPresenter.present(visible)
            return
        }
        let controller = recoveryController ?? RelayConsoleAppController()
        recoveryController = controller
        let content = NSHostingController(rootView: RelayConsoleRootView(controller: controller))
        let window = recoveryWindow ?? NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1464, height: 853),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Relay Console"
        window.contentViewController = content
        window.center()
        window.setFrameAutosaveName("RelayConsoleRecoveryWindow")
        recoveryWindow = window
        RelayConsoleWindowPresenter.present(window)
    }
}

enum RelayConsoleWindowPresenter {
    static func present(_ window: NSWindow?) {
        guard let window else { return }
        if window.isMiniaturized {
            window.deminiaturize(nil)
        }
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
}
