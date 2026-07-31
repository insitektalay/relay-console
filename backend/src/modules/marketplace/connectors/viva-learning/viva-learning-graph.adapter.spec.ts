import {
  VivaLearningGraphAdapter,
  VivaLearningGraphError,
} from "./viva-learning-graph.adapter";

describe("VivaLearningGraphAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins and minimizes the provider directory", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          value: [
            {
              id: "provider-1",
              displayName: "Relay Academy",
              isCourseActivitySyncEnabled: true,
              loginWebUrl: "https://example.com/private",
            },
          ],
          "@odata.nextLink": "https://graph.microsoft.com/next",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new VivaLearningGraphAdapter().read("access-token", "providers.list"),
    ).resolves.toEqual({
      providers: [
        {
          id: "provider-1",
          displayName: "Relay Academy",
          isCourseActivitySyncEnabled: true,
        },
      ],
      truncated: true,
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain(
      "/v1.0/employeeExperience/learningProviders?",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
  });

  it("blocks arbitrary Viva Learning operations", () => {
    expect(() =>
      new VivaLearningGraphAdapter().read("access-token", "content.list"),
    ).rejects.toBeInstanceOf(VivaLearningGraphError);
  });
});
