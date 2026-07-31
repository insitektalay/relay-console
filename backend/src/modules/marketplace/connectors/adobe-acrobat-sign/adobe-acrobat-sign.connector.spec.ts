import {
  AdobeAcrobatSignApiAdapter,
  AdobeAcrobatSignApiError,
} from "./adobe-acrobat-sign-api.adapter";
import { ADOBE_ACROBAT_SIGN_CONNECTOR_MANIFEST } from "./adobe-acrobat-sign.connector";

describe("Adobe Acrobat Sign connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses only agreement_read:self and two bounded reads", () => {
    expect(
      ADOBE_ACROBAT_SIGN_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes,
    ).toEqual(["agreement_read:self"]);
    expect(ADOBE_ACROBAT_SIGN_CONNECTOR_MANIFEST.auth.oauth?.pkce).toBe(false);
    expect(ADOBE_ACROBAT_SIGN_CONNECTOR_MANIFEST.tools).toHaveLength(2);
    expect(
      ADOBE_ACROBAT_SIGN_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && tool.approvalRequired === false,
      ),
    ).toBe(true);
  });

  it("lists one bounded page and excludes participant and document data", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          userAgreementList: Array.from({ length: 30 }, (_, index) => ({
            id: `agreement_${index}`,
            name: `Agreement ${index}`,
            status: "OUT_FOR_SIGNATURE",
            participantSetsInfo: [
              { memberInfos: [{ email: "private@example.com" }] },
            ],
            documents: [{ url: "https://private.example/document" }],
          })),
        }),
        { status: 200 },
      ),
    );
    const result = await new AdobeAcrobatSignApiAdapter().listAgreements(
      "token",
      "https://api.na1.adobesign.com",
      { pageSize: 25 },
    );
    expect(new URL(String(fetchMock.mock.calls[0][0])).toString()).toBe(
      "https://api.na1.adobesign.com/api/rest/v6/agreements?pageSize=25",
    );
    expect(result.agreements).toHaveLength(25);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(result).toMatchObject({
      selfScopeOnly: true,
      automaticPagination: false,
    });
  });

  it("reads one fixed agreement path and returns only status metadata", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "CBJCHBCAABAA-test",
          name: "NDA",
          status: "SIGNED",
          createdDate: "2026-07-17T10:00:00Z",
          participantSetsInfo: [
            { memberInfos: [{ email: "private@example.com" }] },
          ],
          documentVisibilityEnabled: true,
        }),
        { status: 200 },
      ),
    );
    const result = await new AdobeAcrobatSignApiAdapter().getAgreement(
      "token",
      "https://api.eu1.echosign.com/",
      { agreementId: "CBJCHBCAABAA-test" },
    );
    expect(result.agreement).toEqual({
      agreementId: "CBJCHBCAABAA-test",
      name: "NDA",
      status: "SIGNED",
      type: null,
      createdDate: "2026-07-17T10:00:00Z",
      displayDate: null,
      modifiedDate: null,
      latestVersionId: null,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("rejects non-Adobe shards and invalid IDs before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new AdobeAcrobatSignApiAdapter();
    expect(() => adapter.apiOrigin("https://example.com")).toThrow(
      AdobeAcrobatSignApiError,
    );
    await expect(
      adapter.getAgreement("token", "https://api.na1.adobesign.com", {
        agreementId: "../../users",
      }),
    ).rejects.toBeInstanceOf(AdobeAcrobatSignApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
