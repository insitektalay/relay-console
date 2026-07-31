import {
  CloudinaryMcpAdapter,
  CloudinaryMcpError,
} from "./cloudinary-mcp.adapter";

const rpc = (id: number, result: unknown, status = 200) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { status });
const initialize = () => rpc(1, { capabilities: { tools: {} } });
const tools = () =>
  rpc(2, {
    tools: [
      {
        name: "search_assets",
        description: "Search authorized assets.",
        inputSchema: { type: "object" },
        annotations: { readOnlyHint: true },
      },
      {
        name: "upload_asset",
        description: "Upload an asset.",
        inputSchema: { type: "object" },
        annotations: { readOnlyHint: false },
      },
    ],
  });

describe("CloudinaryMcpAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins Cloudinary's Asset Management MCP and invokes a live-discovered read tool", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(tools())
      .mockResolvedValueOnce(
        rpc(3, { content: [{ type: "text", text: "asset" }] }),
      );
    await expect(
      new CloudinaryMcpAdapter().callRead("oauth-token", {
        toolName: "search_assets",
        arguments: {},
      }),
    ).resolves.toEqual({ content: [{ type: "text", text: "asset" }] });
    expect(
      fetchMock.mock.calls.every(
        (call) =>
          String(call[0]) === "https://asset-management.mcp.cloudinary.com/mcp",
      ),
    ).toBe(true);
  });

  it("routes mutations through the write action and rejects credentials", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(tools());
    await expect(
      new CloudinaryMcpAdapter().callRead("oauth-token", {
        toolName: "upload_asset",
        arguments: {},
      }),
    ).rejects.toMatchObject<Partial<CloudinaryMcpError>>({
      code: "policy_blocked",
    });
    fetchMock.mockRestore();
    await expect(
      new CloudinaryMcpAdapter().callWrite("oauth-token", {
        toolName: "upload_asset",
        arguments: { apiSecret: "hidden" },
      }),
    ).rejects.toMatchObject<Partial<CloudinaryMcpError>>({
      code: "policy_blocked",
    });
  });

  it("health reports the complete live-discovered read and write surface", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(tools());
    await expect(
      new CloudinaryMcpAdapter().health("oauth-token"),
    ).resolves.toEqual({
      toolCount: 2,
      readToolCount: 1,
      writeToolCount: 1,
      liveToolsVerified: true,
    });
  });

  it("fails closed on oversized results and provider auth errors", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("denied", { status: 401 }));
    await expect(
      new CloudinaryMcpAdapter().health("bad-token"),
    ).rejects.toMatchObject<Partial<CloudinaryMcpError>>({
      code: "credential_missing",
      statusCode: 401,
    });
  });
});
