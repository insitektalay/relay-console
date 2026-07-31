import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  PlanviewAgilePlaceApiAdapter,
  PlanviewAgilePlaceApiError,
  type PlanviewAgilePlaceCredentials,
} from "./planview-agileplace-api.adapter";

describe("Planview AgilePlace connector", () => {
  const credentials: PlanviewAgilePlaceCredentials = {
    apiToken: "agileplace-secret-token",
    accountHostname: "relay-synthetic.leankit.com",
  };

  afterEach(() => jest.restoreAllMocks());

  it("registers seven fixed approval-gated tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("planview-agileplace")?.tools).toHaveLength(7);
    expect(
      registry.get("planview-agileplace")?.approvalProfiles[0]
        .approvalRequiredActions,
    ).toHaveLength(7);
  });

  it("pins bounded board reads to the selected leankit tenant and bearer token", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          boards: [
            {
              id: "1234",
              title: "Delivery",
              description: "private",
              version: "7",
              accessLevel: "manager",
              users: [{ emailAddress: "private@example.com" }],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new PlanviewAgilePlaceApiAdapter().listBoards(
      credentials,
      { keyword: "deliver", limit: 2 },
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "https://relay-synthetic.leankit.com/io/board?",
    );
    expect(String(url)).toContain("search=deliver");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${credentials.apiToken}`,
    );
    expect(result.rows[0]).toEqual({
      id: "1234",
      title: "Delivery",
      version: "7",
      isArchived: false,
      accessLevel: "manager",
    });
    expect(result.rows[0]).not.toHaveProperty("description");
    expect(result.rows[0]).not.toHaveProperty("users");
  });

  it("bounds and redacts card lists", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          cards: [
            {
              id: "4321",
              title: "Ship",
              version: "9",
              description: "private body",
              assignedUsers: [{ emailAddress: "private@example.com" }],
              board: { id: "1234", title: "Delivery" },
              lane: { id: "55", title: "Doing" },
              type: { id: "66", title: "Feature" },
              blockedStatus: { isBlocked: false, reason: "private" },
            },
          ],
          pageMeta: { totalRecords: 22 },
        }),
        { status: 200 },
      ),
    );
    const result = await new PlanviewAgilePlaceApiAdapter().listCards(
      credentials,
      { boardId: "1234", keyword: "ship", limit: 1 },
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=1");
    expect(String(fetchMock.mock.calls[0][0])).toContain("board=1234");
    expect(result.truncated).toBe(true);
    expect(result.rows[0]).not.toHaveProperty("description");
    expect(result.rows[0]).not.toHaveProperty("assignedUsers");
    expect(result.rows[0]).toMatchObject({
      id: "4321",
      title: "Ship",
      version: "9",
      board: { id: "1234", title: "Delivery" },
      isBlocked: false,
    });
  });

  it("creates only a minimal card on the exact board", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "4321",
          title: "New card",
          version: "1",
          board: { id: "1234", title: "Delivery" },
        }),
        { status: 201 },
      ),
    );
    await new PlanviewAgilePlaceApiAdapter().createCard(credentials, {
      boardId: "1234",
      title: "New card",
      description: "ignored",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      destination: { boardId: "1234" },
      title: "New card",
    });
  });

  it("uses a resource-version test for collision-safe renames", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "4321", title: "Old", version: "9" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "4321", title: "New", version: "10" }), {
          status: 200,
        }),
      );
    await new PlanviewAgilePlaceApiAdapter().updateCard(credentials, {
      cardId: "4321",
      expectedTitle: "Old",
      expectedVersion: "9",
      title: "New",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://relay-synthetic.leankit.com/io/card/4321?excludeComments=true",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual([
      { op: "test", path: "/version", value: "9" },
      { op: "replace", path: "/title", value: "New" },
    ]);
  });

  it("requires title and version matches before deletion", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "4321", title: "Current", version: "8" }), {
        status: 200,
      }),
    );
    await expect(
      new PlanviewAgilePlaceApiAdapter().deleteCard(credentials, {
        cardId: "4321",
        expectedTitle: "Stale",
        expectedVersion: "7",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects arbitrary origins and returns secret-safe provider errors", async () => {
    const adapter = new PlanviewAgilePlaceApiAdapter();
    await expect(
      adapter.listBoards(
        { ...credentials, accountHostname: "attacker.example.com" },
        {},
      ),
    ).rejects.toBeInstanceOf(PlanviewAgilePlaceApiError);
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: credentials.apiToken }), {
        status: 401,
      }),
    );
    const promise = adapter.listBoards(credentials, {});
    await expect(promise).rejects.toThrow(
      "Planview AgilePlace rejected the API token.",
    );
    await expect(promise).rejects.not.toThrow(credentials.apiToken);
  });
});
