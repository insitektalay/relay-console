import { AgentService } from "./agent.service";

describe("AgentService runtime model catalog", () => {
  function buildService(catalog: any, observedAt = new Date()) {
    const service = Object.create(AgentService.prototype) as AgentService;
    (service as any).resourceAccessService = {
      ensureWorkspaceAccess: jest.fn(async () => undefined),
    };
    (service as any).bridgeDeviceRepo = {
      findOne: jest.fn(async () =>
        catalog
          ? {
              runtimeModelCatalog: catalog,
              runtimeModelCatalogObservedAt: observedAt,
            }
          : null,
      ),
    };
    return service;
  }

  it("returns the latest Hermes-observed models in runtime order", async () => {
    const service = buildService({
      runtimeType: "hermes",
      defaultModel: "gpt-5.5",
      models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.5"],
      source: "hermes-codex-discovery",
      observedAt: "2026-07-25T07:16:00Z",
    });

    const result = await service.modelOptionsForWorkspace(
      "workspace-1",
      "user-1",
    );

    expect(result.source).toBe("hermes-codex-discovery");
    expect(result.stale).toBe(false);
    expect(result.harnesses.hermes).toEqual(
      expect.objectContaining({
        defaultModel: "gpt-5.5",
        models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.5"],
      }),
    );
  });

  it("preserves a safe Hermes model that arrived before catalog refresh", () => {
    const service = buildService(null);
    expect((service as any).resolveTestedModel("hermes", "gpt-5.6-sol")).toBe(
      "gpt-5.6-sol",
    );
    expect((service as any).resolveTestedModel("openclaw", "gpt-5.6-sol")).toBe(
      "gpt-5.5",
    );
  });
});
