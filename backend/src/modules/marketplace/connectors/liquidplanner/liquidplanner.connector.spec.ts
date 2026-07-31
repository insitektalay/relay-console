import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  LiquidPlannerApiAdapter,
  LiquidPlannerApiError,
  type LiquidPlannerCredentials,
} from "./liquidplanner-api.adapter";

describe("LiquidPlanner connector", () => {
  const credentials: LiquidPlannerCredentials = {
    apiToken: "synthetic-liquidplanner-token",
  };

  afterEach(() => jest.restoreAllMocks());

  it("registers five fixed approval-gated tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("liquidplanner")?.tools).toHaveLength(5);
    expect(
      registry.get("liquidplanner")?.approvalProfiles[0]
        .approvalRequiredActions,
    ).toHaveLength(5);
  });

  it("pins bounded workspace reads to LiquidPlanner New", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          recordLimit: 2,
          recordCount: 1,
          data: [{ id: 21, organizationId: 99, name: "Delivery" }],
        }),
        { status: 200 },
      ),
    );
    const result = await new LiquidPlannerApiAdapter().listWorkspaces(
      credentials,
      { limit: 2 },
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://next.liquidplanner.com/api/workspaces/v1?limit=2",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${credentials.apiToken}`,
    );
    expect(result.rows[0]).toEqual({ id: "21", name: "Delivery" });
    expect(result.rows[0]).not.toHaveProperty("organizationId");
  });

  it("bounds, filters and redacts plan-item lists", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          recordLimit: 1,
          recordCount: 1,
          continuationToken: 42,
          data: [
            {
              id: 41,
              name: "Ship",
              itemType: "tasks",
              workspaceId: 21,
              parentId: 31,
              description: "private",
              customFieldValues: [{ name: "Secret", value: "private" }],
              userId: 77,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new LiquidPlannerApiAdapter().listItems(credentials, {
      workspaceId: "21",
      parentId: "31",
      itemType: "tasks",
      limit: 1,
    });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/workspaces/21/items/v1?");
    expect(url).toContain("itemType%5Bis%5D=tasks");
    expect(url).toContain("parentId%5Bis%5D=31");
    expect(result.truncated).toBe(true);
    expect(result.rows[0]).toMatchObject({
      id: "41",
      name: "Ship",
      itemType: "tasks",
      workspaceId: "21",
      parentId: "31",
    });
    expect(result.rows[0]).not.toHaveProperty("description");
    expect(result.rows[0]).not.toHaveProperty("customFieldValues");
    expect(result.rows[0]).not.toHaveProperty("userId");
  });

  it("creates only a minimal task under the exact parent", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 41,
          name: "New task",
          itemType: "tasks",
          workspaceId: 21,
          parentId: 31,
        }),
        { status: 201 },
      ),
    );
    await new LiquidPlannerApiAdapter().createTask(credentials, {
      workspaceId: "21",
      parentId: "31",
      name: "New task",
      description: "ignored",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      workspaceId: 21,
      parentId: 31,
      itemType: "tasks",
      name: "New task",
    });
  });

  it("requires an exact current name before a name-only update", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ id: 41, name: "Old", itemType: "tasks" }] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 41, name: "New", itemType: "tasks" }), {
          status: 200,
        }),
      );
    await new LiquidPlannerApiAdapter().renameItem(credentials, {
      workspaceId: "21",
      itemId: "41",
      expectedName: "Old",
      name: "New",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("id%5Bis%5D=41");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      name: "New",
    });
  });

  it("returns secret-safe provider errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: credentials.apiToken }), {
        status: 401,
      }),
    );
    const promise = new LiquidPlannerApiAdapter().listWorkspaces(
      credentials,
      {},
    );
    await expect(promise).rejects.toBeInstanceOf(LiquidPlannerApiError);
    await expect(promise).rejects.toThrow("LiquidPlanner rejected the API token.");
    await expect(promise).rejects.not.toThrow(credentials.apiToken);
  });
});
