import { PaymoApiAdapter, PaymoApiError } from "./paymo-api.adapter";

describe("PaymoApiAdapter", () => {
  const credentials = { apiKey: "paymo_secret" };

  afterEach(() => jest.restoreAllMocks());

  it("validates the API key at Paymo's fixed origin without putting it in the URL", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ users: [{ id: 42 }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(new PaymoApiAdapter().health(credentials)).resolves.toEqual({
      users: [{ id: 42 }],
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.paymoapp.com/api/me",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe(
      `Basic ${Buffer.from("paymo_secret:relayconsole").toString("base64")}`,
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("paymo_secret");
  });

  it("supports bounded reads and redacts provider download tokens", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          reports: [
            {
              id: 7,
              download_token: "provider-secret",
              permalink:
                "https://app.paymoapp.com/api/reports/7?token=provider-secret&format=html",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await new PaymoApiAdapter().read(credentials, {
      path: "/api/reports",
      query: { where: "type=live", include: ["users", "projects"] },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.paymoapp.com/api/reports?where=type%3Dlive&include=users&include=projects",
    );
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("supports JSON writes but rejects alternate origins and credential fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tasks: [{ id: 9 }] }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const api = new PaymoApiAdapter();
    await api.manage(credentials, {
      method: "POST",
      path: "/api/tasks",
      json: { name: "Bounded task", tasklist_id: 3 },
    });
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ name: "Bounded task", tasklist_id: 3 }),
    );
    await expect(
      api.manage(credentials, {
        method: "POST",
        path: "https://evil.example/api/tasks",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.manage(credentials, {
        method: "POST",
        path: "/api/tasks",
        json: { api_key: "expose" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("returns bounded binary exports without interpreting them as text", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(Uint8Array.from([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    await expect(
      new PaymoApiAdapter().read(credentials, {
        path: "/api/reports/7",
        query: { format: "pdf" },
      }),
    ).resolves.toEqual({
      contentType: "application/pdf",
      byteLength: 3,
      base64: "AQID",
    });
  });

  it("maps provider throttling to a safe error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Slow down" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(
      new PaymoApiAdapter().health(credentials),
    ).rejects.toMatchObject<Partial<PaymoApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
