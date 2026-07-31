import { BadRequestException } from "@nestjs/common";
import type { BridgeService } from "../../../bridge/bridge.service";
import { ObsidianCliAdapter } from "./obsidian-cli.adapter";
import { OBSIDIAN_CONNECTOR_MANIFEST } from "./obsidian.connector";

describe("Obsidian local CLI connector", () => {
  const credentials = {
    sourceHostId: "host-1",
    sourceHostType: "hermes_bridge" as const,
    vault: "Work Notes",
  };

  it("publishes four fixed, approval-gated tools and a complete Dangerous profile", () => {
    expect(OBSIDIAN_CONNECTOR_MANIFEST.connectorType).toBe("local_script");
    expect(OBSIDIAN_CONNECTOR_MANIFEST.auth).toEqual(
      expect.objectContaining({ type: "custom" }),
    );
    expect(
      OBSIDIAN_CONNECTOR_MANIFEST.tools.map((tool) => tool.functionName),
    ).toEqual([
      "obsidian_search",
      "obsidian_read_note",
      "obsidian_create_note",
      "obsidian_append_note",
    ]);
    expect(
      OBSIDIAN_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
    expect(
      OBSIDIAN_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (action) => action.id,
      ),
    ).toEqual([
      "obsidian_search",
      "obsidian_read_note",
      "obsidian_create_note",
      "obsidian_append_note",
    ]);
  });

  it("sends an argv array for exact-vault bounded search without a shell string", async () => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn().mockResolvedValue({
        requestId: "request-1",
        status: "ok",
        exitCode: 0,
        stdout: '[{"path":"Projects/Relay.md"}]',
      }),
    } as unknown as BridgeService;
    const adapter = new ObsidianCliAdapter(bridge);

    const result = await adapter.execute({
      workspaceId: "ws-1",
      toolName: "obsidian_search",
      credentials,
      payload: { query: "relay", folder: "Projects", limit: 5 },
    });

    expect(bridge.callMarketplaceLocalCli).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      appSlug: "obsidian",
      sourceHostId: "host-1",
      sourceHostType: "hermes_bridge",
      executable: "obsidian",
      argv: [
        "vault=Work Notes",
        "search",
        "query=relay",
        "limit=5",
        "format=json",
        "path=Projects",
      ],
      timeoutMs: 15_000,
      maxOutputBytes: 65_536,
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        data: { matches: [{ path: "Projects/Relay.md" }] },
      }),
    );
  });

  it.each([
    "../Secrets.md",
    "/absolute.md",
    ".obsidian/plugins.md",
    ".trash/deleted.md",
    "folder/../../escape.md",
  ])("rejects a note path outside the selected vault: %s", async (path) => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn(),
    } as unknown as BridgeService;
    const adapter = new ObsidianCliAdapter(bridge);
    await expect(
      adapter.execute({
        workspaceId: "ws-1",
        toolName: "obsidian_read_note",
        credentials,
        payload: { path },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bridge.callMarketplaceLocalCli).not.toHaveBeenCalled();
  });

  it("never adds overwrite when creating a note", async () => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn().mockResolvedValue({
        requestId: "request-1",
        status: "ok",
        exitCode: 0,
        stdout: "Created Projects/New.md",
      }),
    } as unknown as BridgeService;
    const adapter = new ObsidianCliAdapter(bridge);
    await adapter.execute({
      workspaceId: "ws-1",
      toolName: "obsidian_create_note",
      credentials,
      payload: { path: "Projects/New.md", content: "# New" },
    });
    const argv = (bridge.callMarketplaceLocalCli as jest.Mock).mock.calls[0][0]
      .argv as string[];
    expect(argv).toEqual([
      "vault=Work Notes",
      "create",
      "path=Projects/New.md",
      "content=# New",
    ]);
    expect(argv).not.toContain("overwrite");
  });
});
