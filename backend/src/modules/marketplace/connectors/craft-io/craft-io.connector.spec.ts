import { MarketplaceConnectorRegistry } from "../connector-registry";
import { CraftIoApiAdapter, CraftIoApiError } from "./craft-io-api.adapter";
import { CRAFT_IO_CONNECTOR_MANIFEST } from "./craft-io.connector";

const credentials = {
  apiKey: "craft_" + "x".repeat(40),
  accountId: "2305843010000000001",
  region: "us",
};
const workspace = { id: "2305843010000000002", name: "Platform" };
const item = {
  id: "2305843010000000003",
  shortId: "CRK-42",
  type: "Feature",
  workspaceId: workspace.id,
  title: "Authentication",
  status: { id: "1", name: "In progress" },
  importance: { id: "2", name: "High" },
  updatedAt: "2026-07-18T00:00:00Z",
};
const feedback = {
  id: "2305843010000000004",
  portalId: "2305843010000000005",
  shortId: "CRK-51",
  title: "Add SSO",
  status: "New",
  category: { id: "6", name: "Feature request" },
};

describe("Craft.io connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers eight approval-gated fixed Craft.io tools", () => {
    expect(new MarketplaceConnectorRegistry().get("craft-io")).toBe(
      CRAFT_IO_CONNECTOR_MANIFEST,
    );
    expect(CRAFT_IO_CONNECTOR_MANIFEST.tools).toHaveLength(8);
    expect(
      CRAFT_IO_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("pins bounded item reads to the documented US origin and API-key header", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [item],
          pagination: { hasMore: true },
        }),
        { status: 200 },
      ),
    );
    const result = await new CraftIoApiAdapter().listItems(credentials, {
      workspaceId: workspace.id,
      keyword: "Auth",
      limit: 1,
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `https://api.craft.io/workspace/${workspace.id}/items?`,
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain("page=1&limit=1");
    expect(String(fetchMock.mock.calls[0][0])).toContain("keyword=Auth");
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ "x-api-key": credentials.apiKey }),
    );
    expect(result).toEqual(
      expect.objectContaining({ count: 1, truncated: true }),
    );
  });

  it("uses only the documented EU origin when selected", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([workspace]), { status: 200 }),
      );
    await new CraftIoApiAdapter().listWorkspaces(
      { ...credentials, region: "eu" },
      { limit: 1 },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api-eu.craft.io/workspaces/${credentials.accountId}`,
    );
  });

  it("submits only the documented plain-feedback allowlist", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: feedback.id,
          shortId: feedback.shortId,
          link: "https://portal.example.craft.io/CRK-51",
        }),
        { status: 200 },
      ),
    );
    await new CraftIoApiAdapter().submitPlainFeedback(credentials, {
      portalId: feedback.portalId,
      workspaceId: workspace.id,
      categoryId: "6",
      title: feedback.title,
      description: "Enterprise authentication",
      submitterEmail: "synthetic@example.com",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      workspaceId: workspace.id,
      title: feedback.title,
      description: "Enterprise authentication",
      owner: "synthetic@example.com",
      categoryId: "6",
    });
  });

  it("rejects arbitrary regions and identifiers before a request", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new CraftIoApiAdapter().getItem(
        { ...credentials, region: "custom" },
        { itemId: "1" },
      ),
    ).rejects.toMatchObject<Partial<CraftIoApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      new CraftIoApiAdapter().getItem(credentials, { itemId: "../admin" }),
    ).rejects.toMatchObject<Partial<CraftIoApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns bounded metadata without descriptions or submitter identities", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ...feedback,
          description: "private feedback",
          owner: "person@example.com",
        }),
        { status: 200 },
      ),
    );
    const result = await new CraftIoApiAdapter().getFeedbackItem(credentials, {
      feedbackItemId: feedback.id,
    });
    expect(result).toEqual(expect.objectContaining({ id: feedback.id }));
    expect(JSON.stringify(result)).not.toContain("private feedback");
    expect(JSON.stringify(result)).not.toContain("person@example.com");
  });

  it("returns secret-safe provider errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: credentials.apiKey }), {
        status: 401,
      }),
    );
    const promise = new CraftIoApiAdapter().listWorkspaces(credentials, {});
    await expect(promise).rejects.toThrow(
      "Craft.io rejected the fixed API request.",
    );
    await expect(promise).rejects.not.toThrow(credentials.apiKey);
  });
});
