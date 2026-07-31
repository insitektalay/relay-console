import { MarketplaceConnectorRegistry } from "../connector-registry";
import { WebexCallingApiAdapter } from "./webex-calling-api.adapter";
import {
  WEBEX_CALLING_CONNECTOR_MANIFEST,
  WEBEX_CALLING_REQUIRED_SCOPES,
} from "./webex-calling.connector";

describe("Webex Calling Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers exact-scope rotating OAuth and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("webex-calling")).toBe(
      WEBEX_CALLING_CONNECTOR_MANIFEST,
    );
    expect(WEBEX_CALLING_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      requiredScopes: [...WEBEX_CALLING_REQUIRED_SCOPES],
      pkce: true,
      supportsRefresh: true,
    });
    expect(
      WEBEX_CALLING_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["webex_calling_safe", "dangerously_skip_permissions"]);
  });

  it("pins one bounded organization-number request", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ items: [] })));
    await new WebexCallingApiAdapter().listNumbers("access-fixture", {
      limit: 999,
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://webexapis.com/v1/telephony/config/numbers",
    );
    expect(url.searchParams.get("max")).toBe("25");
    expect(Array.from(url.searchParams.keys())).toEqual(["max"]);
  });

  it("returns masked non-identifying number state", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              phoneNumber: "+442079460123",
              extension: "94567",
              routingPrefix: "private-routing",
              esn: "private-esn",
              state: "ACTIVE",
              phoneNumberType: "PRIMARY",
              includedTelephonyTypes: ["PSTN_NUMBER"],
              mainNumber: true,
              tollFreeNumber: false,
              isServiceNumber: true,
              elinEnabled: false,
              isReservedNumber: true,
              location: { id: "private-location", name: "Private office" },
              owner: { id: "private-owner", firstName: "Private" },
              mobileNetwork: "private-network",
              routingProfile: "private-profile",
            },
          ],
        }),
      ),
    );
    const result = await new WebexCallingApiAdapter().listNumbers(
      "access-fixture",
      {},
    );
    expect(result.numbers[0]).toEqual({
      maskedNumber: "••••23",
      maskedExtension: "••••67",
      state: "ACTIVE",
      phoneNumberType: "PRIMARY",
      includedTelephonyTypes: ["PSTN_NUMBER"],
      mainNumber: true,
      tollFreeNumber: false,
      serviceNumber: true,
      emergencyLocationIdentificationNumber: false,
      reservedNumber: true,
      locationAssigned: true,
      ownerAssigned: true,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("442079460123");
    expect(serialized).not.toContain("94567");
  });

  it("maps denied admin scope to a safe error", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("forbidden", { status: 403 }));
    await expect(
      new WebexCallingApiAdapter().listNumbers("access-fixture", {}),
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      statusCode: 403,
    });
  });
});
