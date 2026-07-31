import {
  ClientSuccessApiAdapter,
  ClientSuccessApiError,
} from "./clientsuccess-api.adapter";
import { CLIENTSUCCESS_CONNECTOR_MANIFEST } from "./clientsuccess.connector";

const credentials = { authorization: "Bearer synthetic-api-key" };

describe("ClientSuccess connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated metadata read", () => {
    expect(
      CLIENTSUCCESS_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      CLIENTSUCCESS_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["clientsuccess_client_custom_fields_list"]);
  });

  it("checks credentials without returning field data", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ name: "Private field" }]), {
        status: 200,
      }),
    );
    const result = await new ClientSuccessApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      fixedProviderOrigin: true,
      fieldDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("Private field");
  });

  it("lists only bounded projected client field metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 12,
            uuid: "field-uuid",
            name: "Industry",
            label: "Industry label",
            resourceType: "CLIENT",
            fieldType: "TEXT",
            fieldTypeId: 4,
            system: false,
            required: false,
            active: true,
            options: ["private-option"],
            value: "private-value",
            usageCount: 99,
            placeholder: "private-placeholder",
          },
        ]),
        { status: 200 },
      ),
    );
    const result = await new ClientSuccessApiAdapter().listClientCustomFields(
      credentials,
      { limit: 1 },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.clientsuccess.com/v2/customfield/all/CLIENT?system=false&required=false&placeholder=false&includeUsageCounts=false",
    );
    expect(result.fields).toEqual([
      {
        id: "12",
        uuid: "field-uuid",
        name: "Industry",
        label: "Industry label",
        resourceType: "CLIENT",
        fieldType: "TEXT",
        fieldTypeId: "4",
        system: false,
        required: false,
        active: true,
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-option|private-value|private-placeholder|"usageCount":|"options":|"value":|"placeholder":/,
    );
  });

  it("rejects missing credentials and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new ClientSuccessApiAdapter();
    await expect(adapter.health({ authorization: "" })).rejects.toMatchObject({
      code: "credential_missing",
      statusCode: 401,
    });
    await expect(
      adapter.listClientCustomFields(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(ClientSuccessApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new ClientSuccessApiAdapter().listClientCustomFields(credentials, {}),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
