import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  ProductPlanApiAdapter,
  ProductPlanApiError,
} from "./productplan-api.adapter";
import { PRODUCTPLAN_CONNECTOR_MANIFEST } from "./productplan.connector";

const credentials = { apiToken: "a".repeat(64) };
const roadmap = {
  id: 42,
  name: "Platform",
  description: "Shared roadmap",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-18T00:00:00Z",
};
const bar = {
  id: 99,
  name: "Authentication",
  description: "Ship access controls",
  starts_on: "2026-07-01",
  ends_on: "2026-08-01",
  percent_done: 30,
  parked: true,
  is_container: false,
  roadmap_id: 42,
  updated_at: "2026-07-18T00:00:00Z",
};

describe("ProductPlan connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers seven approval-gated fixed ProductPlan tools", () => {
    expect(new MarketplaceConnectorRegistry().get("productplan")).toBe(
      PRODUCTPLAN_CONNECTOR_MANIFEST,
    );
    expect(PRODUCTPLAN_CONNECTOR_MANIFEST.tools).toHaveLength(7);
    expect(
      PRODUCTPLAN_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("pins bounded filtered reads to the documented API V2 origin", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ roadmaps: [roadmap, roadmap] }), {
        status: 200,
      }),
    );
    const result = await new ProductPlanApiAdapter().listRoadmaps(credentials, {
      limit: 1,
      nameContains: "Platform",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://app.productplan.com/api/v2/roadmaps?q[name_cont]=Platform&q[s]=id+asc",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
    expect(result).toEqual(
      expect.objectContaining({ count: 1, truncated: true }),
    );
  });

  it("creates only a parked non-container bar", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(bar), { status: 201 }));
    await new ProductPlanApiAdapter().createParkedBar(credentials, {
      roadmapId: 42,
      name: "Authentication",
      description: "Ship access controls",
      percentDone: 30,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      roadmap_id: 42,
      name: "Authentication",
      parked: true,
      is_container: false,
      description: "Ship access controls",
      percent_done: 30,
    });
  });

  it("updates only the supported bounded metadata fields", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(bar), { status: 200 }));
    await new ProductPlanApiAdapter().updateBar(credentials, {
      barId: 99,
      name: "Authentication",
      percentDone: 30,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://app.productplan.com/api/v2/bars/99",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "Authentication",
      percent_done: 30,
    });
  });

  it("requires a fresh exact-name match before deletion", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(bar), { status: 200 }),
      );
    await expect(
      new ProductPlanApiAdapter().deleteBar(credentials, {
        barId: 99,
        expectedName: "Changed name",
      }),
    ).rejects.toMatchObject<Partial<ProductPlanApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects arbitrary identifiers before a request", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new ProductPlanApiAdapter().getBar(credentials, { barId: "../admin" }),
    ).rejects.toMatchObject<Partial<ProductPlanApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns secret-safe provider errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: credentials.apiToken }), {
        status: 401,
      }),
    );
    const promise = new ProductPlanApiAdapter().listRoadmaps(credentials, {});
    await expect(promise).rejects.toThrow(
      "ProductPlan rejected the fixed API request.",
    );
    await expect(promise).rejects.not.toThrow(credentials.apiToken);
  });
});
