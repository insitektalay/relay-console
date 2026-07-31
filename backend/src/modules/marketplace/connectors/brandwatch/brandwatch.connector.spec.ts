import {
  BrandwatchApiAdapter,
  BrandwatchApiError,
} from "./brandwatch-api.adapter";
import { BRANDWATCH_CONNECTOR_MANIFEST } from "./brandwatch.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Brandwatch connector", () => {
  const credentials = {
    accessToken: "test-token",
    projectId: "398748937",
  };

  it("exposes only two approval-gated bounded reads", () => {
    expect(BRANDWATCH_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      BRANDWATCH_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["brandwatch.listProjects", "brandwatch.listQueries"]);
    expect(
      BRANDWATCH_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("validates the exact project with fixed origin and Bearer auth", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(json({ results: [{ id: 398748937 }] }));
    await expect(
      new BrandwatchApiAdapter(requester).health(credentials),
    ).resolves.toEqual({
      apiOrigin: "https://api.brandwatch.com",
      projectId: credentials.projectId,
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.brandwatch.com/projects/summary",
    );
    expect(requester.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer test-token",
    );
  });

  it("lists project IDs and time zones without project or client identity", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        results: [
          {
            id: 398748937,
            name: "Private project",
            description: "Secret research",
            billableClientName: "Private company",
            timezone: "Europe/London",
          },
        ],
      }),
    );
    const result = await new BrandwatchApiAdapter(requester).listProjects(
      credentials,
    );
    expect(result.projects).toEqual([
      { projectId: "398748937", timezone: "Europe/London" },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/Private|Secret|company/);
  });

  it("lists bounded query structure without names, expressions, authors, or content", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        results: [
          {
            id: 1999933037,
            name: "Private brand query",
            type: "monitor",
            booleanQuery: "secret OR confidential",
            lastModifiedUsername: "private@example.test",
            contentSources: ["news"],
          },
        ],
      }),
    );
    const result = await new BrandwatchApiAdapter(requester).listQueries(
      credentials,
    );
    expect(result.queries).toEqual([
      { queryId: "1999933037", type: "monitor" },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /Private|secret|confidential|example|news/,
    );
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.brandwatch.com/projects/398748937/queries/summary",
    );
  });

  it("rejects invalid IDs and cross-project access", async () => {
    await expect(
      new BrandwatchApiAdapter(jest.fn()).listQueries({
        ...credentials,
        projectId: "../other",
      }),
    ).rejects.toBeInstanceOf(BrandwatchApiError);
    const crossProject = new BrandwatchApiAdapter(
      jest.fn().mockResolvedValue(json({ results: [{ id: 1 }] })),
    );
    await expect(crossProject.health(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
    });
  });

  it("maps provider failures to safe errors", async () => {
    const unavailable = new BrandwatchApiAdapter(
      jest.fn().mockResolvedValue(json({ error: "private" }, 503)),
    );
    await expect(unavailable.listProjects(credentials)).rejects.toMatchObject({
      code: "provider_unavailable",
      statusCode: 503,
    });
  });
});
