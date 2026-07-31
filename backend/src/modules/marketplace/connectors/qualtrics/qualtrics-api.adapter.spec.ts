import {
  QualtricsApiAdapter,
  QualtricsApiError,
} from "./qualtrics-api.adapter";

describe("QualtricsApiAdapter", () => {
  const credentials = { dataCenterId: "fra1", apiToken: "customer-token" };
  afterEach(() => jest.restoreAllMocks());

  it("pins the data-center host and authenticates only by header", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { elements: [] }, meta: {} }), {
        status: 200,
      }),
    );
    await new QualtricsApiAdapter().read(credentials, "surveys.list", {
      offset: 10,
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL("https://fra1.qualtrics.com/API/v3/surveys?offset=10"),
    );
    expect(String(url)).not.toContain("customer-token");
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "X-API-TOKEN": "customer-token" }),
        redirect: "error",
      }),
    );
  });

  it("bounds survey list output and removes provider pagination URLs", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: {
            elements: Array.from({ length: 30 }, (_, id) => ({
              id: `SV_${String(id).padStart(8, "0")}`,
              name: `Survey ${id}`,
              extra: "drop",
            })),
            nextPage: "https://fra1.qualtrics.com/private",
          },
          meta: { httpStatus: "200 - OK" },
        }),
        { status: 200 },
      ),
    );
    const result = (await new QualtricsApiAdapter().read(
      credentials,
      "surveys.list",
      {},
    )) as { result: { elements: unknown[]; hasMore: boolean } };
    expect(result.result.elements).toHaveLength(25);
    expect(result.result.hasMore).toBe(true);
    expect(JSON.stringify(result)).not.toContain("nextPage");
  });

  it("blocks arbitrary operations, malformed data centers, and malformed survey IDs", async () => {
    const adapter = new QualtricsApiAdapter();
    expect(() => adapter.read(credentials, "raw.request", {})).toThrow(
      QualtricsApiError,
    );
    await expect(
      adapter.read(
        { ...credentials, dataCenterId: "evil.example.com" },
        "identity.get",
        {},
      ),
    ).rejects.toThrow("data center ID");
    expect(() =>
      adapter.read(credentials, "surveys.get", { surveyId: "../../users" }),
    ).toThrow("surveyId is invalid");
  });
});
