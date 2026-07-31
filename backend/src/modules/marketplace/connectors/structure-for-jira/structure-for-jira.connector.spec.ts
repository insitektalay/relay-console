import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  StructureForJiraApiAdapter,
  StructureForJiraApiError,
} from "./structure-for-jira-api.adapter";
import { STRUCTURE_FOR_JIRA_CONNECTOR_MANIFEST } from "./structure-for-jira.connector";

const credentials = {
  personalAccessToken: "pat_" + "x".repeat(40),
  region: "americas",
};
const structure = {
  id: 10,
  name: "Portfolio",
  description: "Plan",
  accessLevel: "control",
  label: "c7452595-1185-4a4b-9c4b-9021ccead10b",
};
const view = {
  id: "497f6eca-6276-4890-abcd-ef1234567890",
  name: "Delivery",
  description: "View",
  accessLevel: "use",
  specification: {
    columnDisplayMode: "AUTO_FIT",
    rowDisplayMode: "ONE_LINE",
    showBorders: false,
    columns: [{ key: "main" }, { key: "key", params: { compact: false } }],
  },
};

describe("Structure for Jira connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers five approval-gated fixed Structure Cloud tools", () => {
    expect(new MarketplaceConnectorRegistry().get("structure-for-jira")).toBe(
      STRUCTURE_FOR_JIRA_CONNECTOR_MANIFEST,
    );
    expect(STRUCTURE_FOR_JIRA_CONNECTOR_MANIFEST.tools).toHaveLength(5);
    expect(
      STRUCTURE_FOR_JIRA_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("pins bounded lists to the documented Americas origin", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            structures: [structure],
            offset: 0,
            limit: 1,
            hasMore: true,
          }),
          { status: 200 },
        ),
      );
    const result = await new StructureForJiraApiAdapter().listStructures(
      credentials,
      { limit: 1 },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.structure.app/api/v1/structures?offset=0&limit=1",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
    expect(result).toEqual(
      expect.objectContaining({ count: 1, truncated: true }),
    );
  });

  it("uses only the documented Europe origin when selected", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(structure), { status: 200 }),
      );
    await new StructureForJiraApiAdapter().getStructure(
      { ...credentials, region: "europe" },
      { structureId: 10 },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.prod-eu-central-1.structure.app/api/v1/structures/10",
    );
  });

  it("creates only an empty private structure", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(structure), { status: 201 }),
      );
    await new StructureForJiraApiAdapter().createPrivateStructure(credentials, {
      name: "Portfolio",
      description: "Plan",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "Portfolio",
      description: "Plan",
      permissions: [],
    });
  });

  it("returns bounded view layout without column parameters", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(view), { status: 200 }));
    const result = await new StructureForJiraApiAdapter().getView(credentials, {
      viewId: view.id,
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: view.id,
        layout: expect.objectContaining({ columnKeys: ["main", "key"] }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain("compact");
  });

  it("rejects arbitrary regions and identifiers before a request", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new StructureForJiraApiAdapter().getStructure(
        { ...credentials, region: "custom" },
        { structureId: 1 },
      ),
    ).rejects.toMatchObject<Partial<StructureForJiraApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      new StructureForJiraApiAdapter().getView(credentials, {
        viewId: "../admin",
      }),
    ).rejects.toMatchObject<Partial<StructureForJiraApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns secret-safe provider errors", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: credentials.personalAccessToken }),
          { status: 401 },
        ),
      );
    const promise = new StructureForJiraApiAdapter().listStructures(
      credentials,
      {},
    );
    await expect(promise).rejects.toThrow(
      "Structure Cloud rejected the fixed API request.",
    );
    await expect(promise).rejects.not.toThrow(credentials.personalAccessToken);
  });
});
