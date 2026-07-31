import { SprintoApiAdapter, SprintoApiError } from "./sprinto-api.adapter";

const credentials = { apiKey: "key" };

describe("SprintoApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the US graph and minimizes a bounded workflow-check page", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            workflowChecksPaginated: {
              edges: [
                {
                  cursor: "cursor_2",
                  node: {
                    pk: "check_1",
                    title: "Periodic access review",
                    evidenceStatus: "hidden",
                  },
                },
              ],
              totalCount: 100,
            },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      new SprintoApiAdapter().read(credentials, {
        operation: "workflow_checks.list",
        first: 20,
        after: "cursor_1",
      }),
    ).resolves.toEqual({
      workflowChecks: [{ id: "check_1", title: "Periodic access review" }],
      first: 20,
      nextCursor: "cursor_2",
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://app.sprinto.com/dev-api/graphql",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({ "api-key": "key" }),
      }),
    );
    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.operationName).toBe("RelayWorkflowChecks");
    expect(payload.variables).toEqual({ first: 20, after: "cursor_1" });
    expect(payload.query).not.toContain("mutation");
  });

  it("rejects arbitrary operations, oversized pages, and unsafe cursors", async () => {
    const adapter = new SprintoApiAdapter();
    await expect(
      adapter.read(credentials, { operation: "staff.list" }),
    ).rejects.toBeInstanceOf(SprintoApiError);
    await expect(
      adapter.read(credentials, {
        operation: "workflow_checks.list",
        first: 21,
      }),
    ).rejects.toBeInstanceOf(SprintoApiError);
    await expect(
      adapter.read(credentials, {
        operation: "workflow_checks.list",
        after: "bad cursor?",
      }),
    ).rejects.toBeInstanceOf(SprintoApiError);
  });
});
