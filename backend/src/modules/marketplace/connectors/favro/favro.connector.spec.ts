import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  FavroApiAdapter,
  FavroApiError,
  type FavroCredentials,
} from "./favro-api.adapter";

describe("Favro connector", () => {
  const credentials: FavroCredentials = {
    email: "relay-test@example.com",
    apiToken: "favro-secret-token",
  };
  const organizationId = "organization123";
  const collectionId = "collection123";
  const widgetCommonId = "widgetCommon123";
  const cardId = "cardIdentifier123";

  afterEach(() => jest.restoreAllMocks());

  it("registers ten approval-gated fixed Favro tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("favro")?.tools).toHaveLength(10);
    expect(
      registry.get("favro")?.approvalProfiles[0].approvalRequiredActions,
    ).toHaveLength(10);
  });

  it("pins bounded organization reads to Favro and HTTP Basic token auth", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          pages: 2,
          entities: [
            {
              organizationId,
              name: "Synthetic organization",
              sharedToUsers: [{ email: "private@example.com" }],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new FavroApiAdapter().listOrganizations(credentials, {
      limit: 2,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://favro.com/api/v1/organizations?limit=2&page=0",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString("base64")}`,
    );
    expect(result.truncated).toBe(true);
    expect(result.rows[0]).toEqual({
      organizationId,
      name: "Synthetic organization",
    });
  });

  it("fixes card listing to one exact organization and collection", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          pages: 1,
          entities: [
            {
              cardId,
              organizationId,
              widgetCommonId,
              name: "Synthetic card",
              description: "private description",
              customFields: [{ value: "private" }],
              createdByUserId: "private-user",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new FavroApiAdapter().listCards(credentials, {
      organizationId,
      collectionId,
      limit: 4,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      `https://favro.com/api/v1/cards?collectionId=${collectionId}&unique=true&archived=false&descriptionFormat=plaintext&limit=4&page=0`,
    );
    expect((init?.headers as Record<string, string>).organizationId).toBe(
      organizationId,
    );
    expect(result.rows[0]).not.toHaveProperty("description");
    expect(result.rows[0]).not.toHaveProperty("customFields");
    expect(result.rows[0]).not.toHaveProperty("createdByUserId");
  });

  it("creates only a minimal named card on an exact widget", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            cardId,
            organizationId,
            widgetCommonId,
            name: "New",
          }),
          { status: 200 },
        ),
      );
    await new FavroApiAdapter().createCard(credentials, {
      organizationId,
      widgetCommonId,
      name: "New",
      description: "ignored",
      customFields: [{ hidden: true }],
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "New",
      widgetCommonId,
    });
  });

  it("allowlists a collision-checked rename", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cardId, organizationId, name: "Old" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cardId, organizationId, name: "New" }), {
          status: 200,
        }),
      );
    await new FavroApiAdapter().updateCard(credentials, {
      organizationId,
      cardId,
      expectedName: "Old",
      name: "New",
      archive: true,
      customFields: [{ hidden: true }],
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      name: "New",
    });
  });

  it("deletes one confirmed card instance with everywhere fixed false", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ cardId, organizationId, name: "Delete me" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([cardId]), { status: 200 }),
      );
    const result = await new FavroApiAdapter().deleteCard(credentials, {
      organizationId,
      cardId,
      expectedName: "Delete me",
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      `https://favro.com/api/v1/cards/${cardId}?everywhere=false`,
    );
    expect(result).toEqual({ deleted: true, cardId, deletedIds: [cardId] });
  });

  it("rejects invalid IDs, ambiguous filters and stale confirmations", async () => {
    const adapter = new FavroApiAdapter();
    await expect(
      adapter.getCollection(credentials, {
        organizationId: "../bad",
        collectionId,
      }),
    ).rejects.toBeInstanceOf(FavroApiError);
    await expect(
      adapter.listCards(credentials, {
        organizationId,
        collectionId,
        widgetCommonId,
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ cardId, organizationId, name: "Current" }),
          { status: 200 },
        ),
      );
    await expect(
      adapter.deleteCard(credentials, {
        organizationId,
        cardId,
        expectedName: "Stale",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("returns secret-safe provider errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: credentials.apiToken }), {
        status: 401,
      }),
    );
    const promise = new FavroApiAdapter().listOrganizations(credentials, {});
    await expect(promise).rejects.toThrow(
      "Favro rejected the account email or API token.",
    );
    await expect(promise).rejects.not.toThrow(credentials.apiToken);
  });
});
