import { BadRequestException } from "@nestjs/common";
import type { BridgeService } from "../../../bridge/bridge.service";
import { RoamResearchCliAdapter } from "./roam-research-cli.adapter";
import { ROAM_RESEARCH_CONNECTOR_MANIFEST } from "./roam-research.connector";

describe("Roam Research local CLI connector", () => {
  const credentials = {
    sourceHostId: "host-1",
    sourceHostType: "hermes_bridge" as const,
    graph: "work graph",
  };

  it("publishes four fixed, approval-gated tools and a complete Dangerous profile", () => {
    expect(ROAM_RESEARCH_CONNECTOR_MANIFEST.connectorType).toBe("local_script");
    expect(ROAM_RESEARCH_CONNECTOR_MANIFEST.auth).toEqual(
      expect.objectContaining({ type: "custom" }),
    );
    expect(
      ROAM_RESEARCH_CONNECTOR_MANIFEST.tools.map((tool) => tool.functionName),
    ).toEqual([
      "roam_research_search",
      "roam_research_get_page",
      "roam_research_get_block",
      "roam_research_append_daily_note",
    ]);
    expect(
      ROAM_RESEARCH_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
    expect(
      ROAM_RESEARCH_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (action) => action.id,
      ),
    ).toEqual([
      "roam_research_search",
      "roam_research_get_page",
      "roam_research_get_block",
      "roam_research_append_daily_note",
    ]);
  });

  it("reads graph guidelines before bounded search and uses argv arrays", async () => {
    const bridge = {
      callMarketplaceLocalCli: jest
        .fn()
        .mockResolvedValueOnce({
          requestId: "request-1",
          status: "ok",
          exitCode: 0,
          stdout: "Keep project notes concise.",
        })
        .mockResolvedValueOnce({
          requestId: "request-2",
          status: "ok",
          exitCode: 0,
          stdout: "bounded results",
        }),
    } as unknown as BridgeService;
    const adapter = new RoamResearchCliAdapter(bridge);

    const result = await adapter.execute({
      workspaceId: "ws-1",
      toolName: "roam_research_search",
      credentials,
      payload: { query: "relay", scope: "blocks", limit: 5 },
    });

    expect(bridge.callMarketplaceLocalCli).toHaveBeenNthCalledWith(1, {
      workspaceId: "ws-1",
      appSlug: "roam-research",
      sourceHostId: "host-1",
      sourceHostType: "hermes_bridge",
      executable: "roam",
      argv: ["get-graph-guidelines", "--graph", "work graph"],
      timeoutMs: 15_000,
      maxOutputBytes: 16_384,
    });
    expect(bridge.callMarketplaceLocalCli).toHaveBeenNthCalledWith(2, {
      workspaceId: "ws-1",
      appSlug: "roam-research",
      sourceHostId: "host-1",
      sourceHostType: "hermes_bridge",
      executable: "roam",
      argv: [
        "search",
        "--query",
        "relay",
        "--scope",
        "blocks",
        "--offset",
        "0",
        "--limit",
        "5",
        "--include-path",
        "true",
        "--max-depth",
        "0",
        "--graph",
        "work graph",
      ],
      timeoutMs: 15_000,
      maxOutputBytes: 49_152,
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        data: {
          guidelines: "Keep project notes concise.",
          content: "bounded results",
        },
      }),
    );
  });

  it.each([
    ["roam_research_get_block", { uid: "bad uid!" }],
    ["roam_research_search", { query: "relay", scope: "raw" }],
    [
      "roam_research_append_daily_note",
      { markdown: "note", date: "2026-07-17" },
    ],
  ])("rejects invalid bounded input for %s", async (toolName, payload) => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn(),
    } as unknown as BridgeService;
    const adapter = new RoamResearchCliAdapter(bridge);
    await expect(
      adapter.execute({
        workspaceId: "ws-1",
        toolName,
        credentials,
        payload,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bridge.callMarketplaceLocalCli).not.toHaveBeenCalled();
  });

  it("only exposes the append-only daily-note mutation", () => {
    const toolNames = ROAM_RESEARCH_CONNECTOR_MANIFEST.tools.map(
      (tool) => tool.functionName,
    );
    expect(toolNames).toContain("roam_research_append_daily_note");
    expect(
      toolNames.some((name) => /delete|move|update|raw|datalog/.test(name)),
    ).toBe(false);
  });
});
