import { ProofHubApiAdapter, ProofHubApiError } from "./proofhub-api.adapter";

describe("ProofHubApiAdapter", () => {
  const credentials = { account: "relay-work", apiKey: "proofhub_secret" };
  afterEach(() => jest.restoreAllMocks());

  it("validates the stored key at the customer account origin", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "en", name: "English" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(new ProofHubApiAdapter().health(credentials)).resolves.toEqual(
      [{ id: "en", name: "English" }],
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://relay-work.proofhub.com/api/v3/languages",
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers["X-API-KEY"]).toBe("proofhub_secret");
    expect(headers["User-Agent"]).toContain("RelayConsole");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("proofhub_secret");
  });

  it("supports bounded reads and rejects alternate account authorities", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await new ProofHubApiAdapter().read(credentials, {
      path: "/api/v3/alltodo",
      query: { start: 0, limit: 25 },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://relay-work.proofhub.com/api/v3/alltodo?start=0&limit=25",
    );
    await expect(
      new ProofHubApiAdapter().health({
        account: "evil.example.com",
        apiKey: "secret",
      }),
    ).rejects.toBeInstanceOf(ProofHubApiError);
  });

  it("supports JSON management and blocks traversal and credential fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: 42, title: "Launch" }), {
        status: 201,
      }),
    );
    const api = new ProofHubApiAdapter();
    await api.manage(credentials, {
      method: "POST",
      path: "/api/v3/projects",
      json: { title: "Launch" },
    });
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ title: "Launch" }),
    );
    await expect(
      api.read(credentials, { path: "/api/v3/../people" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.manage(credentials, {
        method: "POST",
        path: "/api/v3/projects",
        json: { x_api_key: "expose" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("limits multipart uploads to ProofHub's documented upload endpoint", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ file_id: 9 }), { status: 201 }),
      );
    const api = new ProofHubApiAdapter();
    await api.manage(credentials, {
      method: "POST",
      path: "/files/upload.php",
      form: { project_id: 12 },
      files: [
        {
          fieldName: "file",
          fileName: "brief.txt",
          contentType: "text/plain",
          base64: Buffer.from("bounded").toString("base64"),
        },
      ],
    });
    expect(fetchMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
    await expect(
      api.manage(credentials, {
        method: "POST",
        path: "/api/v3/projects",
        files: [
          {
            fieldName: "file",
            fileName: "brief.txt",
            base64: "YQ==",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("maps documented throttling to a safe provider error", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "Slow down" }), { status: 429 }),
      );
    await expect(
      new ProofHubApiAdapter().health(credentials),
    ).rejects.toMatchObject<Partial<ProofHubApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
