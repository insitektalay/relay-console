import Foundation
import RelayConsoleSourceTestSupport

struct AttributionTestFailure: Error, CustomStringConvertible {
    let description: String
}

@main
enum RelayConsoleAttributionTests {
    static func main() throws {
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let views = try read(root, "Sources/RelayConsoleApp/Views.swift")
        let components = try read(root, "Sources/RelayConsoleApp/UIComponents.swift")
        let manager = try read(root, "Sources/RelayConsoleCore/HarnessInstallManager.swift")
        let utilities = try read(root, "Sources/RelayConsoleCore/HarnessInstallUtilities.swift")
        let disclosure = try read(root, "docs/PUBLIC_BETA_ATTRIBUTION.md")

        try expect(views.contains("handles OpenAI sign-in"), "Harness UI must attribute sign-in to the selected runtime")
        try expect(views.contains("OpenAI controls account, plan, workspace, usage-limit, rollout, and model eligibility"), "Harness UI must disclose eligibility variability")
        try expect(views.contains("tested default"), "Harness UI must disclose retired-model fallback")
        try expect(views.contains("Official \\(record.displayName) installation instructions"), "Runtime setup must link to official installation instructions")
        try expect(manager.contains("Authenticate with your model provider in Hermes Agent"), "Hermes setup must name the auth owner")
        try expect(manager.contains("Authenticate with your model provider and start the gateway in OpenClaw"), "OpenClaw setup must name the auth owner")
        try expect(utilities.contains("Sign in to OpenAI through Hermes Agent"), "Hermes auth recovery must name the runtime")
        try expect(utilities.contains("Authenticate in OpenClaw"), "OpenClaw auth recovery must name the runtime")
        try expect(
            disclosure.contains("Do not promise that buying or holding a named ChatGPT subscription") &&
                disclosure.contains("access through Hermes Agent or OpenClaw"),
            "Website contract must ban subscription guarantees"
        )
        try expect(
            disclosure.contains("Model support") && disclosure.contains("varies by runtime version"),
            "Website contract must disclose runtime-version variability"
        )

        let production = [views, components, manager, utilities].joined(separator: "\n")
        for stale in ["Connect ChatGPT before chat is enabled.", "Finish signing in with ChatGPT", "requires ChatGPT/OpenAI authentication"] {
            try expect(!production.contains(stale), "Production wording still contains stale claim: \(stale)")
        }

        print("RelayConsoleAttributionTests passed")
    }

    private static func read(_ root: URL, _ path: String) throws -> String {
        try RelayConsoleSourceTestSupport.read(root: root, path: path)
    }

    private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        guard condition() else { throw AttributionTestFailure(description: message) }
    }
}
