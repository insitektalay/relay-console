import { PlanhatApiAdapter, PlanhatApiError } from "./planhat-api.adapter";
import { PLANHAT_CONNECTOR_MANIFEST } from "./planhat.connector";
const credentials = {
  apiToken: "api-token",
  apiOrigin: "https://api.planhat.com",
};
describe("Planhat connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("publishes one approval-gated metadata read", () => {
    expect(PLANHAT_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual(
      ["read"],
    );
    expect(
      PLANHAT_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["planhat_custom_fields_list"]);
  });
  it("checks credentials without returning field data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ name: "Private" }]), { status: 200 }),
      );
    const result = await new PlanhatApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactOriginBound: true,
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
              _id: "field-1",
              name: "Industry",
              type: "list",
              parent: "company",
              isFeatured: true,
              isHidden: false,
              isShared: false,
              isLocked: true,
              isMandatory: false,
              formula: "private-formula",
              listValues: ["private-value"],
              filter: [{ private: true }],
              formulaRefs: ["private-ref"],
            },
          ]),
          { status: 200 },
        ),
      );
    const result = await new PlanhatApiAdapter().listCustomFields(credentials, {
      limit: 1,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.planhat.com/customfields?limit=1&offset=0&select=_id%2Cname%2Ctype%2Cparent%2CisFeatured%2CisHidden%2CisShared%2CisLocked%2CisMandatory",
    );
    expect(result.fields).toEqual([
      {
        id: "field-1",
        name: "Industry",
        type: "list",
        parent: "company",
        featured: true,
        hidden: false,
        shared: false,
        locked: true,
        mandatory: false,
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-formula|private-value|private-ref|"formula":|"listValues":|"filter":/,
    );
  });
  it("rejects missing tokens, unsafe origins, and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new PlanhatApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiToken: "" }),
    ).rejects.toBeInstanceOf(PlanhatApiError);
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://example.test" }),
    ).rejects.toBeInstanceOf(PlanhatApiError);
    await expect(
      adapter.listCustomFields(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(PlanhatApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new PlanhatApiAdapter().listCustomFields(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
