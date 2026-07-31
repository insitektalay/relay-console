import Foundation
import RelayConsoleSourceTestSupport

struct AccessibilityReleaseTestFailure: Error, CustomStringConvertible {
    let description: String
}

@main
enum RelayConsoleAccessibilityReleaseTests {
    static func main() throws {
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let ui = try read(root, "Sources/RelayConsoleApp/UIComponents.swift")
        let model = try read(root, "Sources/RelayConsoleApp/AppViewModel.swift")
        let visualHarness = try read(root, "Tests/RelayConsoleAppVisualSnapshotHarness/AppVisualSnapshotHarness.swift")
        let accessibilityHarness = try read(root, "Tests/RelayConsoleAppAccessibilityInventoryHarness/AppAccessibilityInventoryHarness.swift")
        let visual = try read(root, "agent-loops/agent-loop-relayconsole-swift-public-beta-launch/loop-runs/001-audit-baseline-and-release-foundation/evidence/BETA-001-018/visual/retained-surface-visual-snapshots.json")
        let accessibility = try read(root, "agent-loops/agent-loop-relayconsole-swift-public-beta-launch/loop-runs/001-audit-baseline-and-release-foundation/evidence/BETA-001-018/accessibility/retained-surface-accessibility-inventory.json")

        let visiblePanels = try declaration(
            named: "static let visiblePanels",
            in: model
        )
        try expect(
            [".account", ".cloud", ".security", ".harnesses", ".runtime"].allSatisfy {
                visiblePanels.contains($0)
            },
            "Security settings are not reachable"
        )
        for required in ["artifacts", "approvals", "settings-security"] {
            try expect(visualHarness.contains("id: \"\(required)\""), "visual capture omits \(required)")
        }
        for required in ["agentops", "insights", "settings-security"] {
            try expect(accessibilityHarness.contains("id: \"\(required)\""), "accessibility capture omits \(required)")
        }
        try expect(visual.contains("\"taskId\" : \"BETA-001-018\"") && visual.contains("\"capturedSnapshotCount\" : 14"), "current visual packet is incomplete or misidentified")
        try expect(accessibility.contains("\"taskId\" : \"BETA-001-018\"") && accessibility.contains("\"retainedSurfaceCount\" : 7"), "current accessibility inventory is incomplete or misidentified")
        try expect(ui.contains("static let muted = Color(red: 0.590, green: 0.600, blue: 0.620)"), "reviewed muted color changed without contrast evidence")

        let colors: [String: RGB] = [
            "page": RGB(0.025, 0.031, 0.036),
            "sidebar": RGB(0.041, 0.051, 0.063),
            "selected": RGB(0.110, 0.184, 0.270),
            "text": RGB(0.862, 0.846, 0.792),
            "muted": RGB(0.590, 0.600, 0.620),
            "blue": RGB(0.314, 0.553, 0.843),
            "green": RGB(0.392, 0.843, 0.553),
            "amber": RGB(0.839, 0.725, 0.404),
            "red": RGB(0.882, 0.435, 0.392),
            "chatCanvas": RGB(0.018, 0.024, 0.028),
            "chatText": RGB(0.805, 0.790, 0.760),
            "chatMuted": RGB(0.570, 0.575, 0.575)
        ]
        for (foreground, background) in [
            ("text", "page"), ("muted", "page"), ("text", "sidebar"),
            ("muted", "sidebar"), ("text", "selected"), ("muted", "selected"),
            ("chatText", "chatCanvas"), ("chatMuted", "chatCanvas"),
            ("blue", "page"), ("green", "page"), ("amber", "page"), ("red", "page")
        ] {
            let ratio = contrast(colors[foreground]!, colors[background]!)
            try expect(ratio >= 4.5, "\(foreground) on \(background) contrast was only \(String(format: "%.2f", ratio)):1")
        }
        print("RelayConsoleAccessibilityReleaseTests passed")
    }

    private struct RGB {
        let red: Double
        let green: Double
        let blue: Double
        init(_ red: Double, _ green: Double, _ blue: Double) {
            self.red = red; self.green = green; self.blue = blue
        }
    }

    private static func contrast(_ first: RGB, _ second: RGB) -> Double {
        let a = luminance(first), b = luminance(second)
        return (max(a, b) + 0.05) / (min(a, b) + 0.05)
    }

    private static func luminance(_ color: RGB) -> Double {
        0.2126 * linear(color.red) + 0.7152 * linear(color.green) + 0.0722 * linear(color.blue)
    }

    private static func linear(_ value: Double) -> Double {
        value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
    }

    private static func read(_ root: URL, _ path: String) throws -> String {
        try RelayConsoleSourceTestSupport.read(root: root, path: path)
    }

    private static func declaration(named name: String, in source: String) throws -> String {
        guard
            let start = source.range(of: name),
            let assignment = source[start.upperBound...].range(of: "="),
            let end = source[assignment.upperBound...].range(of: "]")
        else {
            throw AccessibilityReleaseTestFailure(description: "\(name) declaration is missing")
        }
        return String(source[start.lowerBound..<end.upperBound])
    }

    private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        guard condition() else { throw AccessibilityReleaseTestFailure(description: message) }
    }
}
