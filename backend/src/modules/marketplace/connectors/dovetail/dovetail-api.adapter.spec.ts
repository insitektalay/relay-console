import { DovetailApiAdapter, DovetailApiError } from "./dovetail-api.adapter";

describe("DovetailApiAdapter", () => {
  const credentials = { apiToken: "api.customer-token" };
  afterEach(() => jest.restoreAllMocks());

  it("uses token auth and minimizes a bounded project index", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "1kf00nQk9yfWKfsTDni8aO",
              title: "Checkout study",
              type: "project",
              created_at: "2026-01-01T00:00:00Z",
              deleted: false,
              url: "private",
              author: { id: "user_1", name: "Researcher" },
              folder: { id: "1kf00nQk9yfWKfsTDni8aP" },
            },
          ],
          page: { total_count: 1, has_more: false, next_cursor: "private" },
        }),
        { status: 200 },
      ),
    );
    const result = await new DovetailApiAdapter().read(
      credentials,
      "projects.list",
      { limit: 5 },
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL("https://dovetail.com/api/v1/projects?page%5Blimit%5D=5"),
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer api.customer-token",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      data: [
        {
          id: "1kf00nQk9yfWKfsTDni8aO",
          title: "Checkout study",
          type: "project",
          created_at: "2026-01-01T00:00:00Z",
          deleted: false,
          folder: { id: "1kf00nQk9yfWKfsTDni8aP" },
        },
      ],
      page: { total_count: 1, has_more: false },
    });
  });

  it("blocks search, MCP, content, and malformed project IDs", () => {
    expect(() =>
      new DovetailApiAdapter().read(credentials, "search", {}),
    ).toThrow(DovetailApiError);
    expect(() =>
      new DovetailApiAdapter().read(credentials, "project.get", {
        projectId: "../people",
      }),
    ).toThrow("22-character");
  });
});
