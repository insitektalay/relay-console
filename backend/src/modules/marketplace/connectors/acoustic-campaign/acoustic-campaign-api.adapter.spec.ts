import {
  AcousticCampaignApiAdapter,
  type AcousticCampaignCredentials,
} from "./acoustic-campaign-api.adapter";
import {
  ACOUSTIC_CAMPAIGN_MANAGE_OPERATION_IDS,
  ACOUSTIC_CAMPAIGN_OPERATIONS,
  ACOUSTIC_CAMPAIGN_SENSITIVE_READ_OPERATION_IDS,
  ACOUSTIC_CAMPAIGN_STRUCTURAL_READ_OPERATION_IDS,
} from "./acoustic-campaign-operation-registry";

describe("AcousticCampaignApiAdapter", () => {
  const credentials: AcousticCampaignCredentials = {
    clientId: "client",
    clientSecret: "secret",
    refreshToken: "refresh",
    pod: "6",
  };
  afterEach(() => jest.restoreAllMocks());
  it("pins the 3 selected operations and 1/1/1 policy split", () => {
    expect(ACOUSTIC_CAMPAIGN_OPERATIONS).toHaveLength(3);
    expect(ACOUSTIC_CAMPAIGN_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(1);
    expect(ACOUSTIC_CAMPAIGN_SENSITIVE_READ_OPERATION_IDS).toHaveLength(1);
    expect(ACOUSTIC_CAMPAIGN_MANAGE_OPERATION_IDS).toHaveLength(1);
  });
  it("exchanges only at the selected fixed pod and calls a pinned REST route", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"access_token":"ephemeral","expires_in":14399}'),
      )
      .mockResolvedValueOnce(new Response('{"id":3}'));
    await new AcousticCampaignApiAdapter().read(credentials, "get_program", {
      programId: 3,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api-campaign-eu-1.goacoustic.com/oauth/token",
    );
    expect(
      new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body)).get(
        "refresh_token",
      ),
    ).toBe("refresh");
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://api-campaign-eu-1.goacoustic.com/rest/programs/3",
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer ephemeral" }),
    });
  });
  it("requires authorization and blocks consent-like fields before network access", async () => {
    const adapter = new AcousticCampaignApiAdapter();
    await expect(
      adapter.manage(credentials, "update_contact", {
        databaseId: 1,
        contactId: 2,
        fields: { City: "Paris" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "update_contact", {
        databaseId: 1,
        contactId: 2,
        fields: { OptInStatus: "yes" },
        consentAttestation: true,
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
  it("blocks invalid pods, cross-policy calls, and arbitrary operations", async () => {
    const adapter = new AcousticCampaignApiAdapter();
    expect(() => adapter.read(credentials, "update_contact", {})).toThrow();
    expect(() => adapter.manage(credentials, "send_sms", {})).toThrow();
    await expect(
      adapter.health({ ...credentials, pod: "https://attacker.example" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
