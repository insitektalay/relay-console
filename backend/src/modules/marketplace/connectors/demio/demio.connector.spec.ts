import { MarketplaceConnectorRegistry } from "../connector-registry";
import { DemioApiAdapter } from "./demio-api.adapter";
import { DEMIO_CONNECTOR_MANIFEST } from "./demio.connector";

describe("Demio Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers encrypted account credentials and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("demio")).toBe(
      DEMIO_CONNECTOR_MANIFEST,
    );
    expect(
      DEMIO_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => ({
        name: field.name,
        secret: field.secret,
        storedIn: field.storedIn,
      })),
    ).toEqual([
      {
        name: "DEMIO_API_KEY",
        secret: true,
        storedIn: "encrypted_secret",
      },
      {
        name: "DEMIO_API_SECRET",
        secret: true,
        storedIn: "encrypted_secret",
      },
    ]);
    expect(
      DEMIO_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["demio_safe", "dangerously_skip_permissions"]);
  });

  it("pins the exact event-list endpoint and credential headers", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([])));
    await new DemioApiAdapter().countEventInventory({
      apiKey: "key-fixture",
      apiSecret: "secret-fixture",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://my.demio.com/api/v1/events",
    );
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      "Api-Key": "key-fixture",
      "Api-Secret": "secret-fixture",
    });
  });

  it("returns counts while excluding all event records", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 123,
            name: "Private event",
            description: "Private description",
            registration_url: "https://private.example",
            presenters: [{ email: "private@example.com" }],
          },
          { id: 456, name: "Second private event" },
        ]),
      ),
    );
    const result = await new DemioApiAdapter().countEventInventory({
      apiKey: "key-fixture",
      apiSecret: "secret-fixture",
    });
    expect(result).toEqual({
      observedEventCount: 2,
      contentExcluded: true,
      completeInventory: true,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("123");
    expect(JSON.stringify(result)).not.toContain("private.example");
  });

  it("fails closed for missing credentials and unexpected payloads", async () => {
    await expect(
      new DemioApiAdapter().countEventInventory({
        apiKey: "",
        apiSecret: "secret-fixture",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ unknown: true })));
    await expect(
      new DemioApiAdapter().countEventInventory({
        apiKey: "key-fixture",
        apiSecret: "secret-fixture",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
