import Foundation
import RelayConsoleCore
import RelayConsoleSourceTestSupport

private struct ModelSelectionTestFailure: Error, CustomStringConvertible { let description: String }

@main
struct RelayConsoleModelSelectionTests {
    static func main() throws {
        let hermes = HarnessModelSelectionService.options(for: .hermes)
        let openClaw = HarnessModelSelectionService.options(for: .openclaw)
        try expect(hermes.contains { $0.id == "gpt-5.6-sol" } && hermes.contains { $0.id == "gpt-5.4-mini" }, "Hermes offline fallback models should be discoverable")
        try expect(openClaw.first?.id == "gpt-5.5" && !openClaw.contains { $0.id == "gpt-5.4-mini" }, "OpenClaw should expose its narrower tested catalog")
        try expect(try HarnessModelSelectionService.resolve("gpt-5.4", for: .hermes).selected == "gpt-5.4", "valid override should survive validation")
        HarnessModelSelectionService.updateObservedCatalog(
            HarnessRuntimeModelCatalog(
                runtimeType: .hermes,
                defaultModel: "gpt-5.5",
                models: ["gpt-5.6-sol", "gpt-5.5"],
                source: "hermes-codex-discovery",
                observedAt: "2026-07-25T07:16:00Z"
            )
        )
        try expect(
            HarnessModelSelectionService.options(for: .hermes).map(\.id)
                == ["gpt-5.6-sol", "gpt-5.5"],
            "Hermes runtime discovery should replace the offline picker catalog")
        try expect(
            try HarnessModelSelectionService.resolve("gpt-5.6-sol", for: .hermes).selected
                == "gpt-5.6-sol",
            "a Hermes-discovered GPT-5.6 model should survive validation")
        let retired = try HarnessModelSelectionService.resolve("retired-model", for: .openclaw)
        try expect(retired.selected == "gpt-5.5" && retired.fallbackApplied, "retired model should fall back to Harness default")

        let root = FileManager.default.temporaryDirectory.appendingPathComponent("relay-model-selection-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let services = try RelayConsoleServices(userDataPath: root, secretStore: MemorySecretStore(), refreshInstalledHarnessesOnLaunch: false, startRuntimeBrokerServer: false, openExternal: { _ in })
        defer { services.database.close() }
        guard let workspace = try services.data.getAppState().activeWorkspace else { throw ModelSelectionTestFailure(description: "workspace missing") }
        let harness = try services.data.upsertHarness(runtimeType: .openclaw, displayName: "OpenClaw", mode: .appManaged, config: [:])
        let agent = try services.data.createAgent(workspaceId: workspace.id, name: "Model Agent", model: "gpt-5.4", harnessId: harness.id, config: ["model": .string("gpt-5.4")])
        try expect(agent.model == "gpt-5.4" && agent.binding.config["model"] == .string("gpt-5.4"), "model should persist on agent and runtime binding")
        let updated = try services.data.updateAgent(agentId: agent.id, model: retired.selected, config: ["model": .string(retired.selected), "modelFallbackApplied": .bool(true)])
        try expect(updated.model == "gpt-5.5" && updated.binding.config["modelFallbackApplied"] == .bool(true), "retirement fallback should persist")

        let manager = try String(contentsOfFile: "Sources/RelayConsoleCore/HarnessInstallManager.swift", encoding: .utf8)
        let views = try RelayConsoleSourceTestSupport.viewSource(
            root: URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        )
        let components = try String(contentsOfFile: "Sources/RelayConsoleApp/UIComponents.swift", encoding: .utf8)
        let cloudRuntime = try String(contentsOfFile: "Sources/RelayConsoleCore/CloudRuntimeDeviceTransport.swift", encoding: .utf8)
        try expect(manager.contains("args += [\"--model\", model.selected]"), "OpenClaw provision and dispatch should receive the resolved model")
        try expect(manager.contains("ensureHermesOpenAICodexProvider(") && manager.contains("model: model.selected"), "Hermes profile setup should receive the resolved model")
        try expect(views.contains("modelSelection: composerModelSelection") && views.contains("model.updateAgentModel(agent, model: selectedModel)"), "direct-chat composer should expose the persisted agent model update path")
        try expect(
            components.contains("struct ComposerModelMenu: View")
                && components.contains("Text(selection ?? \"Runtime default\")")
                && components.contains("systemImage: option.id == selection ? \"checkmark\" : \"circle\"")
                && !components.contains(".disabled(option.id == selection)"),
            "composer should show the current model and a full-contrast selection checkmark")
        try expect(cloudRuntime.contains("dispatch[\"model\"] as? String") && cloudRuntime.contains("agent.binding = binding"), "cloud runtime dispatches should honor Railway's selected model")
        print("RelayConsoleModelSelectionTests passed")
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else { throw ModelSelectionTestFailure(description: message) }
    }
}
