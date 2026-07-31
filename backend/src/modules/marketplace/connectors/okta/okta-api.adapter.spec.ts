import { OktaApiAdapter, type OktaCredentials } from "./okta-api.adapter";

const credentials: OktaCredentials = {
  origin: "https://relay.okta.com",
  clientId: "0oaRelayClient",
  clientSecret: "test-only-secret",
  applicationId: "0oaRelayApp",
};
const app = {
  id: "0oaRelayApp",
  name: "oidc_client",
  label: "Relay Production",
  status: "ACTIVE",
  settings: { credentials: "must-not-leak" },
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const requester = (apiBody: unknown) =>
  jest.fn().mockImplementation((url: string) =>
    Promise.resolve(
      url.endsWith("/oauth2/v1/token")
        ? response({
            access_token: "ephemeral-token",
            token_type: "Bearer",
            expires_in: 3600,
            scope: "okta.apps.read",
          })
        : response(apiBody),
    ),
  );

describe("OktaApiAdapter", () => {
  it("lists a bounded first Application page and keeps the token ephemeral", async () => {
    const request = requester([app]);
    const result = await new OktaApiAdapter(request).listApplications(
      credentials,
      { limit: 5 },
    );
    expect(request.mock.calls[1][0]).toBe(
      "https://relay.okta.com/api/v1/apps?limit=20",
    );
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(result).toMatchObject({
      returnedCount: 1,
      automaticPagination: false,
    });
  });

  it("reads the exact selected Application", async () => {
    const result = await new OktaApiAdapter(requester(app)).getApplication(
      credentials,
    );
    expect(result.application).toMatchObject({
      id: "0oaRelayApp",
      credentialsReturned: false,
      settingsReturned: false,
    });
  });

  it("lists bounded assigned Groups without members", async () => {
    const request = requester([
      { id: "00gRelayOps", type: "OKTA_GROUP", profile: { name: "Operators" } },
    ]);
    const result = await new OktaApiAdapter(request).listApplicationGroups(
      credentials,
      {
        limit: 25,
      },
    );
    expect(request.mock.calls[1][0]).toBe(
      "https://relay.okta.com/api/v1/apps/0oaRelayApp/groups?limit=25",
    );
    expect(result.groups[0]).toMatchObject({
      name: "Operators",
      membersReturned: false,
    });
  });

  it("rejects unsafe Org origins and maps rate limits", async () => {
    await expect(
      new OktaApiAdapter(requester(app)).getApplication({
        ...credentials,
        origin: "https://evilokta.com",
      }),
    ).rejects.toMatchObject({ code: "okta_origin_invalid" });
    const request = jest.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith("/oauth2/v1/token")
          ? response({
              access_token: "ephemeral-token",
              token_type: "Bearer",
              expires_in: 3600,
              scope: "okta.apps.read",
            })
          : response({}, 429),
      ),
    );
    await expect(
      new OktaApiAdapter(request).getApplication(credentials),
    ).rejects.toMatchObject({
      code: "okta_rate_limited",
      statusCode: 429,
    });
  });
});
