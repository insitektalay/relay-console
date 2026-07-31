import { NetlifyApiAdapter, NetlifyApiError } from "./netlify-api.adapter";

const credentials = {
  accessToken: "secret",
  accountSlug: "relay-team",
  siteId: "site_abc123",
};

describe("NetlifyApiAdapter", () => {
  it("lists only the bounded first Site page for the exact account", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: credentials.siteId,
              name: "relay-web",
              account_slug: credentials.accountSlug,
              build_settings: { env: { SECRET: "hidden" } },
            },
          ]),
          {
            status: 200,
            headers: {
              Link: '<https://api.netlify.com/api/v1/relay-team/sites?page=2>; rel="next"',
            },
          },
        ),
    );
    const result = await new NetlifyApiAdapter(requester).listSites(
      credentials,
      { limit: 5 },
    );
    expect(requester.mock.calls[0][0]).toBe(
      "https://api.netlify.com/api/v1/relay-team/sites?page=1&per_page=5",
    );
    expect(result).toMatchObject({
      returnedCount: 1,
      more: true,
      automaticPagination: false,
    });
    expect(result.sites[0]).not.toHaveProperty("build_settings");
    expect(result.sites[0]).toMatchObject({
      environmentValuesReturned: false,
      repositoryDetailsReturned: false,
    });
  });

  it("rejects a selected Site returned from another account", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            id: credentials.siteId,
            account_slug: "other-team",
          }),
          { status: 200 },
        ),
    );
    await expect(
      new NetlifyApiAdapter(requester).getSite(credentials),
    ).rejects.toMatchObject<Partial<NetlifyApiError>>({
      code: "netlify_account_binding_mismatch",
    });
  });

  it("lists only redacted Deploy summaries for the selected Site", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: "deploy_abc123",
              site_id: credentials.siteId,
              state: "ready",
              branch: "main",
              commit_ref: "private",
              error_message: "private failure",
            },
          ]),
          { status: 200 },
        ),
    );
    const result = await new NetlifyApiAdapter(requester).listDeploys(
      credentials,
      { limit: 10 },
    );
    expect(requester.mock.calls[0][0]).toBe(
      "https://api.netlify.com/api/v1/sites/site_abc123/deploys?page=1&per_page=10",
    );
    expect(result.deploys[0]).not.toHaveProperty("commit_ref");
    expect(result.deploys[0]).not.toHaveProperty("branch");
    expect(result.deploys[0]).not.toHaveProperty("framework");
    expect(result.deploys[0]).not.toHaveProperty("error_message");
    expect(result.deploys[0]).toMatchObject({
      hasError: true,
      errorMessageReturned: false,
      sourceMetadataReturned: false,
    });
  });

  it("rejects invalid identifiers before network access", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>();
    await expect(
      new NetlifyApiAdapter(requester).getSite({
        ...credentials,
        siteId: "../../accounts",
      }),
    ).rejects.toMatchObject<Partial<NetlifyApiError>>({
      code: "netlify_site_id_invalid",
    });
    expect(requester).not.toHaveBeenCalled();
  });
});
