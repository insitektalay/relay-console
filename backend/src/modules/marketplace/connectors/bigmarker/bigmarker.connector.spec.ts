import { MarketplaceConnectorRegistry } from "../connector-registry";
import { BigMarkerApiAdapter } from "./bigmarker-api.adapter";
import { BIGMARKER_CONNECTOR_MANIFEST } from "./bigmarker.connector";

describe("BigMarker Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers an encrypted API key and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("bigmarker")).toBe(
      BIGMARKER_CONNECTOR_MANIFEST,
    );
    expect(BIGMARKER_CONNECTOR_MANIFEST.auth.credentialSchema[0]).toMatchObject(
      {
        name: "BIGMARKER_API_KEY",
        secret: true,
        storedIn: "encrypted_secret",
      },
    );
    expect(
      BIGMARKER_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["bigmarker_safe", "dangerously_skip_permissions"]);
  });

  it("pins the fixed first-page future-conference request", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ conferences: [], total_entries: 0, total_pages: 0 }),
        ),
      );
    await new BigMarkerApiAdapter().countFutureConferences(
      { apiKey: "key-fixture" },
      { limit: 999 },
    );
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://www.bigmarker.com/api/v1/conferences/",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "1",
      per_page: "25",
      role: "all",
      type: "future",
    });
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "API-KEY": "key-fixture",
    });
  });

  it("returns aggregate inventory metadata without conference records", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          current_page: 1,
          per_page: 25,
          total_pages: 2,
          total_entries: 30,
          conferences: [
            {
              id: "private-id",
              title: "Private title",
              conference_address: "https://private.example",
              purpose: "Private purpose",
            },
          ],
        }),
      ),
    );
    const result = await new BigMarkerApiAdapter().countFutureConferences(
      { apiKey: "key-fixture" },
      {},
    );
    expect(result).toEqual({
      observedPageCount: 1,
      reportedTotalEntries: 30,
      reportedTotalPages: 2,
      currentPage: 1,
      contentExcluded: true,
      completeInventory: false,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("private-id");
    expect(JSON.stringify(result)).not.toContain("private.example");
  });

  it("fails closed for missing credentials and unexpected payloads", async () => {
    await expect(
      new BigMarkerApiAdapter().countFutureConferences({ apiKey: "" }, {}),
    ).rejects.toMatchObject({ code: "credential_missing" });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ unknown: true })));
    await expect(
      new BigMarkerApiAdapter().countFutureConferences(
        { apiKey: "key-fixture" },
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
