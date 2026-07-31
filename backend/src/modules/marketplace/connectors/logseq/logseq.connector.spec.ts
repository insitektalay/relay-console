import { BadRequestException } from "@nestjs/common";
import type { BridgeService } from "../../../bridge/bridge.service";
import { LogseqCliAdapter } from "./logseq-cli.adapter";
import { LOGSEQ_CONNECTOR_MANIFEST } from "./logseq.connector";

describe("Logseq local CLI connector", () => {
  const credentials = {
    sourceHostId: "host-1",
    sourceHostType: "hermes_bridge" as const,
    graph: "work graph",
  };

  it("publishes five fixed, approval-gated tools and a complete Dangerous profile", () => {
    expect(LOGSEQ_CONNECTOR_MANIFEST.connectorType).toBe("local_script");
    expect(
      LOGSEQ_CONNECTOR_MANIFEST.tools.map((tool) => tool.functionName),
    ).toEqual([
      "logseq_list_pages",
      "logseq_list_tasks",
      "logseq_show_page",
      "logseq_show_block",
      "logseq_append_block",
    ]);
    expect(
      LOGSEQ_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
    expect(
      LOGSEQ_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (action) => action.id,
      ),
    ).toEqual([
      "logseq_list_pages",
      "logseq_list_tasks",
      "logseq_show_page",
      "logseq_show_block",
      "logseq_append_block",
    ]);
    expect(
      LOGSEQ_CONNECTOR_MANIFEST.approvalProfiles[1].blockedActions.map(
        (action) => action.id,
      ),
    ).toEqual(["logseq_raw_command"]);
  });

  it("uses exact-graph bounded JSON argv for recent pages", async () => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn().mockResolvedValue({
        requestId: "request-1",
        status: "ok",
        exitCode: 0,
        stdout: '{"status":"ok","data":{"items":[]}}',
      }),
    } as unknown as BridgeService;
    const adapter = new LogseqCliAdapter(bridge);

    const result = await adapter.execute({
      workspaceId: "ws-1",
      toolName: "logseq_list_pages",
      credentials,
      payload: { limit: 5 },
    });

    expect(bridge.callMarketplaceLocalCli).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      appSlug: "logseq",
      sourceHostId: "host-1",
      sourceHostType: "hermes_bridge",
      executable: "logseq",
      argv: [
        "list",
        "page",
        "--limit",
        "5",
        "--offset",
        "0",
        "--sort",
        "updated-at",
        "--order",
        "desc",
        "--graph",
        "work graph",
        "--output",
        "json",
      ],
      timeoutMs: 15_000,
      maxOutputBytes: 65_536,
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        data: { status: "ok", data: { items: [] } },
      }),
    );
  });

  it.each([
    ["logseq_show_block", { uuid: "not-a-uuid" }],
    ["logseq_show_page", { page: "Page", level: 4 }],
    ["logseq_list_tasks", { limit: 21 }],
  ])("rejects invalid bounded input for %s", async (toolName, payload) => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn(),
    } as unknown as BridgeService;
    const adapter = new LogseqCliAdapter(bridge);
    await expect(
      adapter.execute({ workspaceId: "ws-1", toolName, credentials, payload }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bridge.callMarketplaceLocalCli).not.toHaveBeenCalled();
  });

  it("only exposes a last-child create mutation", async () => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn().mockResolvedValue({
        requestId: "request-1",
        status: "ok",
        exitCode: 0,
        stdout: '{"status":"ok","data":{"result":[123]}}',
      }),
    } as unknown as BridgeService;
    const adapter = new LogseqCliAdapter(bridge);
    await adapter.execute({
      workspaceId: "ws-1",
      toolName: "logseq_append_block",
      credentials,
      payload: { page: "Inbox", content: "Captured note" },
    });
    const argv = (bridge.callMarketplaceLocalCli as jest.Mock).mock.calls[0][0]
      .argv as string[];
    expect(argv).toContain("last-child");
    expect(
      argv.some((value) => /remove|move|sync|login|path/.test(value)),
    ).toBe(false);
  });
});
