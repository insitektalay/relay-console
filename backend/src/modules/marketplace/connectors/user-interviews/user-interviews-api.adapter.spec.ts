import {
  UserInterviewsApiAdapter,
  UserInterviewsApiError,
} from "./user-interviews-api.adapter";

describe("UserInterviewsApiAdapter", () => {
  const credentials = { apiKey: "customer-admin-key" };
  afterEach(() => jest.restoreAllMocks());
  it("uses the v2 key header and minimizes bounded recruits", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "rec_1",
                type: "recruit",
                attributes: {
                  internalName: "Checkout",
                  publicTitle: "Shopping study",
                  status: "open",
                  numParticipants: 5,
                  taskUrl: "private",
                  sessionsWebhookUrl: "private",
                },
              },
            ],
            meta: { pagination: { currentPage: 1 } },
          }),
          { status: 200 },
        ),
      );
    const result = await new UserInterviewsApiAdapter().read(
      credentials,
      "recruits.list",
      { page: 1, limit: 5 },
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL(
        "https://www.userinterviews.com/api/recruits?page%5Bnumber%5D=1&page%5Bsize%5D=5",
      ),
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/vnd.user-interviews.v2+json",
          "user-interviews-apikey": "customer-admin-key",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      data: [
        {
          id: "rec_1",
          type: "recruit",
          attributes: {
            internalName: "Checkout",
            publicTitle: "Shopping study",
            status: "open",
            numParticipants: 5,
          },
        },
      ],
      meta: { pagination: { currentPage: 1 } },
    });
  });
  it("pins characteristic fields and blocks participant access", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );
    await new UserInterviewsApiAdapter().read(
      credentials,
      "characteristics.list",
      { limit: 10 },
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL(
        "https://www.userinterviews.com/api/characteristics?page%5Bnumber%5D=1&page%5Bsize%5D=10&fields%5Bcharacteristic%5D=createdAt%2Cname%2Cslug%2Ctype%2CupdatedAt",
      ),
    );
    expect(() =>
      new UserInterviewsApiAdapter().read(credentials, "participants.list", {}),
    ).toThrow(UserInterviewsApiError);
  });
});
