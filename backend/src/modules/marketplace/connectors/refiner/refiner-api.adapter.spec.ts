import { RefinerApiAdapter, RefinerApiError } from "./refiner-api.adapter";

describe("RefinerApiAdapter", () => {
  const credentials = { apiKey: "customer-refiner-key" };
  afterEach(() => jest.restoreAllMocks());

  it("uses Bearer auth, bounded completed-response paging, and minimizes contacts", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              uuid: "response-1",
              form_uuid: "form-1",
              data: { score: 9 },
              contact: {
                uuid: "contact-1",
                email: "private@example.com",
                attributes: { plan: "paid" },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new RefinerApiAdapter().read(
      credentials,
      "responses.list",
      { page: 2, limit: 5 },
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://api.refiner.io/v1/responses?page=2&page_length=5&include=completed",
      ),
    );
    expect(String(url)).not.toContain("customer-refiner-key");
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer customer-refiner-key",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      items: [
        {
          uuid: "response-1",
          form_uuid: "form-1",
          data: { score: 9 },
          contact: { uuid: "contact-1" },
        },
      ],
    });
  });

  it("pins reporting types and rejects broad or mutating inputs", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ score: 42 }), { status: 200 }),
      );
    await new RefinerApiAdapter().read(credentials, "reporting.get", {
      type: "nps",
      dateStart: "2026-07-01",
      dateEnd: "2026-07-17",
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL(
        "https://api.refiner.io/v1/reporting?type=nps&date_start=2026-07-01&date_end=2026-07-17",
      ),
    );
    const adapter = new RefinerApiAdapter();
    expect(() => adapter.read(credentials, "contacts.delete", {})).toThrow(
      RefinerApiError,
    );
    expect(() =>
      adapter.read(credentials, "responses.list", { limit: 100 }),
    ).toThrow("integer from 1 to 25");
  });
});
