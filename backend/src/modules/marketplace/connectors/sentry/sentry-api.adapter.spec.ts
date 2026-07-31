import { SentryApiAdapter } from "./sentry-api.adapter";

const response = (status: number, value: unknown) => ({
  status,
  text: async () => JSON.stringify(value),
});

describe("SentryApiAdapter", () => {
  const credentials = { organization: "relay-org", accessToken: "oauth-token" };

  it("uses one fixed Organization and redacts Project records", async () => {
    const request = jest.fn().mockResolvedValue(
      response(200, [
        {
          id: "42",
          slug: "api",
          name: "API",
          platform: "node",
          status: "active",
          dateCreated: "2026-01-01T00:00:00Z",
          teams: [{ id: "private" }],
        },
      ]),
    );
    const result = await new SentryApiAdapter(request).listProjects(
      credentials,
    );
    expect(request).toHaveBeenCalledWith(
      "https://sentry.io/api/0/organizations/relay-org/projects/?per_page=25",
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
    expect(result).toEqual([
      {
        id: "42",
        slug: "api",
        name: "API",
        platform: "node",
        status: "active",
        dateCreated: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(result[0]).not.toHaveProperty("teams");
  });

  it("bounds Issue search and returns semantic summaries", async () => {
    const request = jest.fn().mockResolvedValue(
      response(200, [
        {
          id: "99",
          shortId: "API-1",
          title: "TypeError",
          culprit: "checkout",
          status: "unresolved",
          priority: "high",
          count: "12",
          userCount: 3,
          project: { id: "42", slug: "api", name: "API", teams: [] },
          metadata: { type: "TypeError", value: "bad input", secret: "no" },
          subscriptionDetails: { reason: "private" },
        },
      ]),
    );
    const result = await new SentryApiAdapter(request).searchIssues(
      credentials,
      {
        project: "api",
        environment: "production",
        query: "is:unresolved level:error",
        limit: 100,
      },
    );
    const url = new URL(request.mock.calls[0][0]);
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("project")).toBe("api");
    expect(result[0]).toMatchObject({
      id: "99",
      title: "TypeError",
      count: 12,
      userCount: 3,
      project: { slug: "api", name: "API" },
    });
    expect(result[0]).not.toHaveProperty("subscriptionDetails");
  });

  it("redacts Event request, user, breadcrumbs, contexts, and non-allowlisted tags", async () => {
    const request = jest.fn().mockResolvedValue(
      response(200, {
        id: "abcdef",
        title: "failure",
        message: "boom",
        platform: "node",
        environment: "production",
        release: { version: "1.2.3" },
        tags: [
          { key: "environment", value: "production" },
          { key: "user.email", value: "private@example.com" },
        ],
        entries: [
          {
            type: "exception",
            data: {
              values: [
                {
                  type: "TypeError",
                  value: "boom",
                  stacktrace: {
                    frames: [
                      {
                        filename: "app.ts",
                        function: "run",
                        lineNo: 7,
                        context: [[7, "secret"]],
                        vars: { token: "secret" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
        request: { headers: { Authorization: "secret" } },
        user: { email: "private@example.com" },
        breadcrumbs: { values: ["private"] },
        contexts: { trace: { data: "private" } },
      }),
    );
    const result = await new SentryApiAdapter(request).getEvent(
      credentials,
      "api",
      "abcdef",
    );
    expect(result.tags).toEqual([{ key: "environment", value: "production" }]);
    expect(JSON.stringify(result)).not.toMatch(
      /private@example|Authorization|breadcrumbs|contexts|secret/,
    );
    expect(result.exceptions[0].frames[0]).toEqual({
      filename: "app.ts",
      function: "run",
      lineNo: 7,
      colNo: null,
      inApp: null,
    });
  });

  it("maps auth failures without returning provider bodies", async () => {
    const request = jest
      .fn()
      .mockResolvedValue(response(401, { detail: "token secret rejected" }));
    await expect(
      new SentryApiAdapter(request).health(credentials),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "sentry_access_token_invalid",
        message: "Sentry OAuth access is invalid or expired.",
      }),
    );
  });
});
