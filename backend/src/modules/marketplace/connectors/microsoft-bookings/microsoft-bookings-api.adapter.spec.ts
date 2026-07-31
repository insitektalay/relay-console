import {
  MicrosoftBookingsApiAdapter,
  MicrosoftBookingsApiError,
} from "./microsoft-bookings-api.adapter";
describe("MicrosoftBookingsApiAdapter", () => {
  it("uses only the selected business calendar and scrubs appointment privacy fields", async () => {
    const calls: string[] = [];
    const adapter = new MicrosoftBookingsApiAdapter(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "a-1",
              serviceName: "Consultation",
              start: { dateTime: "2026-07-20T09:00:00Z", timeZone: "UTC" },
              end: { dateTime: "2026-07-20T09:30:00Z", timeZone: "UTC" },
              customers: [{ name: "Private" }],
              staffMemberIds: ["staff"],
              joinWebUrl: "https://secret.example",
            },
          ],
          "@odata.nextLink": "skip-token",
        }),
        { status: 200 },
      );
    });
    const result = await adapter.calendarView(
      "token",
      { businessId: "contoso@contoso.com" },
      { start: "2026-07-20T00:00:00Z", end: "2026-07-21T00:00:00Z" },
    );
    expect(calls[0]).toContain(
      "/v1.0/solutions/bookingBusinesses/contoso%40contoso.com/calendarView?",
    );
    expect(result.appointments[0]).toEqual(
      expect.objectContaining({
        id: "a-1",
        serviceName: "Consultation",
        customersExcluded: true,
        staffMembersExcluded: true,
        joinURLExcluded: true,
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /Private|"staff"|secret\.example|skip-token/,
    );
  });
  it("rejects unsafe identifiers and ranges before provider I/O", async () => {
    const request = jest.fn();
    const adapter = new MicrosoftBookingsApiAdapter(request);
    await expect(
      adapter.getService(
        "token",
        { businessId: "contoso@contoso.com" },
        { serviceId: "../customers" },
      ),
    ).rejects.toBeInstanceOf(MicrosoftBookingsApiError);
    await expect(
      adapter.calendarView(
        "token",
        { businessId: "contoso@contoso.com" },
        { start: "2026-07-01T00:00:00Z", end: "2026-07-09T00:00:00Z" },
      ),
    ).rejects.toBeInstanceOf(MicrosoftBookingsApiError);
    expect(request).not.toHaveBeenCalled();
  });
  it("fails closed on oversized responses and maps throttling", async () => {
    const binding = { businessId: "contoso@contoso.com" };
    await expect(
      new MicrosoftBookingsApiAdapter(
        async () => new Response("x".repeat(1_000_001)),
      ).health("token", binding),
    ).rejects.toMatchObject({ code: "microsoft_bookings_response_too_large" });
    await expect(
      new MicrosoftBookingsApiAdapter(
        async () => new Response("{}", { status: 429 }),
      ).health("token", binding),
    ).rejects.toMatchObject({
      code: "microsoft_bookings_rate_limited",
      statusCode: 429,
    });
  });
});
