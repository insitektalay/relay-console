import { NimbleApiAdapter, NimbleApiError } from "./nimble-api.adapter";
import { NIMBLE_CONNECTOR_MANIFEST } from "./nimble.connector";

const credentials = { apiKey: "synthetic-api-key" };
const response = {
  tabs: [
    {
      tab_name: "Contact",
      contact_types: ["person"],
      members: [
        {
          type: "group",
          name: "Basic",
          group_id: "private-group-id",
          logo_id: "private-logo",
          fields: [
            {
              type: "field",
              name: "Industry",
              field_id: "field-1",
              modifier: "",
              multiples: false,
              read_only: false,
              field_type: {
                field_kind: "string",
                validation_rule: { type: "private-validation" },
              },
              presentation: { private: true },
              available_actions: "edit_all",
              choices: ["private-choice"],
            },
          ],
        },
      ],
    },
  ],
};

describe("Nimble connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("publishes one approval-gated metadata read", () => {
    expect(NIMBLE_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual([
      "read",
    ]);
    expect(
      NIMBLE_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["nimble_contact_fields_list"]);
  });
  it("checks credentials without returning field data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      );
    const result = await new NimbleApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      fixedProviderOrigin: true,
      fieldDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("Industry");
  });
  it("lists only bounded projected field metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      );
    const result = await new NimbleApiAdapter().listContactFields(credentials, {
      limit: 1,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://app.nimble.com/api/v1/contacts/fields",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: { Authorization: "Bearer synthetic-api-key" },
      redirect: "error",
    });
    expect(result.fields).toEqual([
      {
        tabName: "Contact",
        groupName: "Basic",
        contactTypes: ["person"],
        id: "field-1",
        name: "Industry",
        modifier: null,
        multiples: false,
        readOnly: false,
        kind: "string",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-validation|private-choice|private-logo|private-group-id|"presentation":|available_actions/,
    );
  });
  it("rejects missing keys and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new NimbleApiAdapter();
    await expect(adapter.health({ apiKey: "" })).rejects.toMatchObject({
      code: "credential_missing",
    });
    await expect(
      adapter.listContactFields(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(NimbleApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new NimbleApiAdapter().listContactFields(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
