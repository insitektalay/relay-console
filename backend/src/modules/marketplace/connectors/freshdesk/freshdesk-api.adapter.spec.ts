import {
  FreshdeskApiAdapter,
  FreshdeskApiError,
} from "./freshdesk-api.adapter";

describe("FreshdeskApiAdapter", () => {
  const credentials = { domain: "relay-support", apiKey: "fd-secret" };

  afterEach(() => jest.restoreAllMocks());

  it("binds Basic authentication to the exact customer Freshdesk domain", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: 42, subject: "Help" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await new FreshdeskApiAdapter().listTickets(credentials, {
      page: 2,
      perPage: 500,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://relay-support.freshdesk.com/api/v2/tickets?page=2&per_page=30",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("fd-secret:X").toString("base64")}`,
    );
  });

  it("normalizes a pasted Freshdesk account URL without allowing another origin", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await new FreshdeskApiAdapter().getTicket(
      { ...credentials, domain: "https://relay-support.freshdesk.com/" },
      { ticketId: 7, include: "stats" },
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://relay-support.freshdesk.com/api/v2/tickets/7?include=stats",
    );
  });

  it("rejects path traversal and credential-bearing request fields", async () => {
    const adapter = new FreshdeskApiAdapter();
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/api/v2/../admin",
      }),
    ).rejects.toBeInstanceOf(FreshdeskApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/v2/tickets",
        json: { authorization: "attacker-value" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps Freshdesk throttling to a safe provider error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ description: "Rate limit exceeded" }), {
        status: 429,
      }),
    );

    await expect(
      new FreshdeskApiAdapter().health(credentials),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
