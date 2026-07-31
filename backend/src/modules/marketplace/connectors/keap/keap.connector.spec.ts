import { KeapApiAdapter, KeapApiError } from "./keap-api.adapter";
import { KEAP_CONNECTOR_MANIFEST } from "./keap.connector";

const credentials = { accessToken: "synthetic-access-token" };

describe("Keap connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated metadata read", () => {
    expect(KEAP_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual([
      "read",
    ]);
    expect(
      KEAP_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["keap_contact_custom_fields_list"]);
  });

  it("checks credentials without returning field data", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ custom_fields: [{ label: "Private" }] }), {
        status: 200,
      }),
    );
    const result = await new KeapApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      fixedProviderOrigin: true,
      fieldDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
  });

  it("lists only bounded projected field metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          custom_fields: [
            {
              id: "45",
              label: "Lead Score",
              record_type: "CONTACT",
              field_type: "WHOLE_NUMBER",
              field_name: "_LeadScore",
              options: [{ id: "1", label: "private-option" }],
              default_value: "private-default",
              group_id: "private-group-id",
              group_name: "private-group-name",
            },
          ],
          optional_properties: ["private-property"],
        }),
        { status: 200 },
      ),
    );
    const result = await new KeapApiAdapter().listContactCustomFields(
      credentials,
      { limit: 1 },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.infusionsoft.com/crm/rest/v2/contacts/model",
    );
    expect(result.fields).toEqual([
      {
        id: "45",
        label: "Lead Score",
        recordType: "CONTACT",
        fieldType: "WHOLE_NUMBER",
        fieldName: "_LeadScore",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-option|private-default|private-group|private-property|"options":|"default_value":/,
    );
  });

  it("rejects missing tokens and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new KeapApiAdapter();
    await expect(adapter.health({ accessToken: "" })).rejects.toMatchObject({
      code: "credential_missing",
    });
    await expect(
      adapter.listContactCustomFields(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(KeapApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new KeapApiAdapter().listContactCustomFields(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
