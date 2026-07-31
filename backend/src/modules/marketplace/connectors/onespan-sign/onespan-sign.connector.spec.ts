import {
  OneSpanSignApiAdapter,
  OneSpanSignApiError,
} from "./onespan-sign-api.adapter";
import { ONESPAN_SIGN_CONNECTOR_MANIFEST } from "./onespan-sign.connector";

const credentials = {
  clientId: "client",
  clientSecret: "secret",
  environment: "us2-sandbox",
};
const tokenResponse = () =>
  new Response(
    JSON.stringify({
      access_token: "short-lived-token",
      token_type: "Bearer",
      expires_in: 299,
    }),
    { status: 200 },
  );

describe("OneSpan Sign connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses customer-owned client credentials and exposes only two reads", () => {
    expect(ONESPAN_SIGN_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      ONESPAN_SIGN_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (item) => item.name,
      ),
    ).toEqual([
      "ONESPAN_SIGN_CLIENT_ID",
      "ONESPAN_SIGN_CLIENT_SECRET",
      "ONESPAN_SIGN_ENVIRONMENT",
    ]);
    expect(ONESPAN_SIGN_CONNECTOR_MANIFEST.tools).toHaveLength(2);
    expect(
      ONESPAN_SIGN_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && !tool.approvalRequired,
      ),
    ).toBe(true);
  });
  it("exchanges credentials, lists at most 25 summaries, and strips private content", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: Array.from({ length: 30 }, (_, i) => ({
              id: `package_${i}`,
              name: `Transaction ${i}`,
              status: "SENT",
              roles: [{ signers: [{ email: "private@example.com" }] }],
              documents: [{ name: "private.pdf" }],
            })),
          }),
          { status: 200 },
        ),
      );
    const result = await new OneSpanSignApiAdapter().listTransactions(
      credentials,
      { status: "SENT", resultLimit: 25 },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://sandbox.esignlive.com/oauth2/token",
    );
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      "grant_type=client_credentials",
    );
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://sandbox.esignlive.com/api/packages?from=1&to=25&query=SENT",
    );
    expect(result.transactions).toHaveLength(25);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("private.pdf");
  });
  it("reads one fixed transaction and projects lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "abc_123=",
            name: "NDA",
            status: "COMPLETED",
            type: "PACKAGE",
            created: "2026-07-17T10:00:00Z",
            roles: [{ signers: [{ email: "private@example.com" }] }],
          }),
          { status: 200 },
        ),
      );
    const result = await new OneSpanSignApiAdapter().getTransaction(
      credentials,
      { transactionId: "abc_123=" },
    );
    expect(result.transaction).toEqual({
      transactionId: "abc_123=",
      name: "NDA",
      status: "COMPLETED",
      type: "PACKAGE",
      createdAt: "2026-07-17T10:00:00Z",
      updatedAt: null,
      completedAt: null,
      dueAt: null,
      trashed: null,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });
  it("rejects unknown environments, IDs, statuses, and limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new OneSpanSignApiAdapter();
    await expect(
      adapter.listTransactions(
        { ...credentials, environment: "https://evil.example" },
        { status: "SENT" },
      ),
    ).rejects.toBeInstanceOf(OneSpanSignApiError);
    await expect(
      adapter.getTransaction(credentials, { transactionId: "../secret" }),
    ).rejects.toBeInstanceOf(OneSpanSignApiError);
    await expect(
      adapter.listTransactions(credentials, { status: "ALL" }),
    ).rejects.toBeInstanceOf(OneSpanSignApiError);
    await expect(
      adapter.listTransactions(credentials, {
        status: "SENT",
        resultLimit: 26,
      }),
    ).rejects.toBeInstanceOf(OneSpanSignApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
