import { HerokuApiAdapter, HerokuApiError } from "./heroku-api.adapter";

const credentials = {
  accessToken: "secret",
  teamId: "01234567-89ab-4def-8123-456789abcdef",
  appId: "11234567-89ab-4def-8123-456789abcdef",
};

describe("HerokuApiAdapter", () => {
  it("lists a bounded first Team App range and verifies every Team binding", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: credentials.appId,
              name: "relay-web",
              team: { id: credentials.teamId, name: "relay-team" },
              region: { name: "us" },
              config_vars: { SECRET: "hidden" },
            },
          ]),
          { status: 206, headers: { "Next-Range": "name relay-web.." } },
        ),
    );
    const result = await new HerokuApiAdapter(requester).listTeamApps(
      credentials,
      { limit: 5 },
    );
    expect(requester.mock.calls[0][0]).toBe(
      `https://api.heroku.com/teams/${credentials.teamId}/apps`,
    );
    expect(new Headers(requester.mock.calls[0][1].headers).get("Range")).toBe(
      "name ..; max=5;",
    );
    expect(result).toMatchObject({
      returnedCount: 1,
      more: true,
      automaticPagination: false,
    });
    expect(result.apps[0]).not.toHaveProperty("config_vars");
    expect(result.apps[0]).toMatchObject({
      configValuesReturned: false,
      credentialMetadataReturned: false,
    });
  });

  it("rejects an exact App health response from another Team", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            id: credentials.appId,
            team: { id: "21234567-89ab-4def-8123-456789abcdef" },
          }),
          { status: 200 },
        ),
    );
    await expect(
      new HerokuApiAdapter(requester).health(credentials),
    ).rejects.toMatchObject<Partial<HerokuApiError>>({
      code: "heroku_team_binding_mismatch",
    });
  });

  it("returns only redacted Release lifecycle summaries", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: "31234567-89ab-4def-8123-456789abcdef",
              app: { id: credentials.appId },
              version: 42,
              status: "succeeded",
              output_stream_url: "https://private.example/stream",
              user: { email: "private@example.com" },
              addon_plan_names: ["secret-addon"],
            },
          ]),
          { status: 200 },
        ),
    );
    const result = await new HerokuApiAdapter(requester).listReleases(
      credentials,
      { limit: 10 },
    );
    expect(result.releases[0]).not.toHaveProperty("output_stream_url");
    expect(result.releases[0]).not.toHaveProperty("user");
    expect(result.releases[0]).not.toHaveProperty("addon_plan_names");
    expect(result.releases[0]).toMatchObject({
      outputStreamReturned: false,
      userEmailReturned: false,
      addonPlansReturned: false,
    });
  });

  it("rejects Dynos from another App and invalid IDs before network access", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: "41234567-89ab-4def-8123-456789abcdef",
              app: { id: "51234567-89ab-4def-8123-456789abcdef" },
            },
          ]),
          { status: 200 },
        ),
    );
    await expect(
      new HerokuApiAdapter(requester).listDynos(credentials, { limit: 10 }),
    ).rejects.toMatchObject<Partial<HerokuApiError>>({
      code: "heroku_app_binding_mismatch",
    });
    await expect(
      new HerokuApiAdapter(requester).health({
        ...credentials,
        appId: "../../config-vars",
      }),
    ).rejects.toMatchObject<Partial<HerokuApiError>>({
      code: "heroku_app_id_invalid",
    });
    expect(requester).toHaveBeenCalledTimes(1);
  });
});
