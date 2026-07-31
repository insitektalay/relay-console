import {
  InsightlyApiAdapter,
  InsightlyApiError,
} from "./insightly-api.adapter";
import { INSIGHTLY_CONNECTOR_MANIFEST } from "./insightly.connector";

const credentials = {
  apiKey: "synthetic-api-key",
  apiBaseUrl: "https://api.na1.insightly.com/v3.1",
};

describe("Insightly connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("publishes one approval-gated metadata read", () => {
    expect(
      INSIGHTLY_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      INSIGHTLY_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["insightly_custom_fields_list"]);
  });
  it("checks credentials without returning field data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ FIELD_LABEL: "Private" }]), {
          status: 200,
        }),
      );
    const result = await new InsightlyApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactPodBound: true,
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
          JSON.stringify([
            {
              FIELD_NAME: "CONTACT_FIELD_1",
              FIELD_ORDER: 2,
              FIELD_FOR: "CONTACT",
              FIELD_LABEL: "Industry",
              FIELD_TYPE: "TEXT",
              EDITABLE: true,
              VISIBLE: true,
              FIELD_HELP_TEXT: "private-help",
              DEFAULT_VALUE: "private-default",
              CUSTOM_FIELD_OPTIONS: [{ OPTION_VALUE: "private-option" }],
              DEPENDENCY: { private: true },
              JOIN_OBJECT: "private-join",
            },
          ]),
          { status: 200 },
        ),
      );
    const result = await new InsightlyApiAdapter().listCustomFields(
      credentials,
      { limit: 1 },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.na1.insightly.com/v3.1/CustomFields",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: { Authorization: "Basic c3ludGhldGljLWFwaS1rZXk=" },
      redirect: "error",
    });
    expect(result.fields).toEqual([
      {
        name: "CONTACT_FIELD_1",
        order: 2,
        object: "CONTACT",
        label: "Industry",
        type: "TEXT",
        editable: true,
        visible: true,
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-help|private-default|private-option|private-join|FIELD_HELP_TEXT|CUSTOM_FIELD_OPTIONS/,
    );
  });
  it("rejects missing keys, unsafe bases, and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new InsightlyApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiKey: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.health({
        ...credentials,
        apiBaseUrl: "https://example.test/v3.1",
      }),
    ).rejects.toBeInstanceOf(InsightlyApiError);
    await expect(
      adapter.listCustomFields(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(InsightlyApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new InsightlyApiAdapter().listCustomFields(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
