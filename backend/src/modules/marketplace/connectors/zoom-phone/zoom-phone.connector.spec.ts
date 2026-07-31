import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  ZoomPhoneApiAdapter,
  type ZoomPhoneCredentials,
} from "./zoom-phone-api.adapter";
import {
  ZOOM_PHONE_CONNECTOR_MANIFEST,
  ZOOM_PHONE_REQUIRED_SCOPE,
} from "./zoom-phone.connector";

const credentials: ZoomPhoneCredentials = {
  accountId: "zoom-phone-account-fixture",
  clientId: "zoom-phone-client-fixture",
  clientSecret: "zoom-phone-secret-fixture",
};

describe("Zoom Phone Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("registers customer-owned S2S credentials and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("zoom-phone")).toBe(
      ZOOM_PHONE_CONNECTOR_MANIFEST,
    );
    expect(
      ZOOM_PHONE_CONNECTOR_MANIFEST.healthChecks[0].requiredScopes,
    ).toEqual([ZOOM_PHONE_REQUIRED_SCOPE]);
    expect(
      ZOOM_PHONE_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["zoom_phone_safe", "dangerously_skip_permissions"]);
  });
  it("uses only fixed token and number-inventory endpoints", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "zoom-phone-access-fixture",
            expires_in: 3600,
            scope: ZOOM_PHONE_REQUIRED_SCOPE,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ numbers: [] }), { status: 200 }),
      );
    await new ZoomPhoneApiAdapter().listNumbers(credentials, { limit: 999 });
    const tokenUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const numbersUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(`${tokenUrl.origin}${tokenUrl.pathname}`).toBe(
      "https://zoom.us/oauth/token",
    );
    expect(tokenUrl.searchParams.get("grant_type")).toBe("account_credentials");
    expect(`${numbersUrl.origin}${numbersUrl.pathname}`).toBe(
      "https://api.zoom.us/v2/number_management/numbers",
    );
    expect(numbersUrl.searchParams.get("allocated_product")).toBe("ZOOM_PHONE");
    expect(numbersUrl.searchParams.get("page_size")).toBe("25");
  });
  it("masks numbers and removes private assignment and location data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "zoom-phone-access-fixture",
            expires_in: 3600,
            scope: ZOOM_PHONE_REQUIRED_SCOPE,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            numbers: [
              {
                id: "private-number-id",
                number: "+12025550123",
                allocated_product: "ZOOM_PHONE",
                number_type: "Toll",
                display_name: "Private display",
                caller_id_name: "Private caller",
                capability: ["Incoming", "Outgoing"],
                source: "Zoom",
                status: "Normal",
                emergency_address: { address_line1: "Private street" },
                site: { site_id: "private-site", name: "Private site" },
                location: { city: "Private city" },
                assigned_list: [
                  {
                    assigned_to_id: "private-user-id",
                    assigned_to_name: "Private user",
                    assigned_to_type: "User",
                    extension_number: "6503",
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new ZoomPhoneApiAdapter().listNumbers(credentials, {});
    expect(result.numbers[0]).toEqual({
      numberMasked: "+*******0123",
      allocatedProduct: "ZOOM_PHONE",
      numberType: "Toll",
      source: "Zoom",
      status: "Normal",
      capabilities: ["Incoming", "Outgoing"],
      addressUpdateRequired: null,
      assignmentTypes: ["User"],
    });
    const encoded = JSON.stringify(result);
    expect(encoded).not.toContain("Private");
    expect(encoded).not.toContain("6503");
    expect(encoded).not.toContain("private-number-id");
  });
  it("rejects a token that lacks the exact granular read scope", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "zoom-phone-access-fixture",
          expires_in: 3600,
          scope: "phone:read:admin",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new ZoomPhoneApiAdapter().listNumbers(credentials, {}),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });
});
