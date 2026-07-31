import {
  CapsuleCrmApiAdapter,
  CapsuleCrmApiError,
} from "./capsule-crm-api.adapter";
import { CAPSULE_CRM_CONNECTOR_MANIFEST } from "./capsule-crm.connector";
const credentials = { accessToken: "synthetic-access-token" };
describe("Capsule CRM connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("publishes one approval-gated metadata read", () => {
    expect(
      CAPSULE_CRM_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      CAPSULE_CRM_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["capsule_crm_party_custom_fields_list"]);
  });
  it("checks credentials without returning field data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ definitions: [{ name: "Private" }] }), {
          status: 200,
        }),
      );
    const result = await new CapsuleCrmApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      fixedProviderOrigin: true,
      fieldDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
  });
  it("lists only bounded projected field metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            definitions: [
              {
                id: 45,
                name: "Lead Score",
                type: "number",
                displayOrder: 1,
                captureRule: "person",
                important: true,
                description: "private-description",
                tag: { name: "private-tag" },
                options: ["private-option"],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new CapsuleCrmApiAdapter().listPartyCustomFields(
      credentials,
      { limit: 1 },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.capsulecrm.com/api/v2/parties/fields/definitions?page=1&perPage=100",
    );
    expect(result.fields).toEqual([
      {
        id: "45",
        name: "Lead Score",
        type: "number",
        displayOrder: 1,
        captureRule: "person",
        important: true,
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-description|private-tag|private-option|"description":|"options":/,
    );
  });
  it("rejects missing tokens and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new CapsuleCrmApiAdapter();
    await expect(adapter.health({ accessToken: "" })).rejects.toMatchObject({
      code: "credential_missing",
    });
    await expect(
      adapter.listPartyCustomFields(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(CapsuleCrmApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new CapsuleCrmApiAdapter().listPartyCustomFields(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
