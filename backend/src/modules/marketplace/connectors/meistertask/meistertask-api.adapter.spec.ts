import {
  MeisterTaskApiAdapter,
  MeisterTaskApiError,
} from "./meistertask-api.adapter";

describe("MeisterTaskApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the fixed MeisterTask origin and server-held bearer token", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, name: "Launch" }]), {
        status: 200,
      }),
    );
    await new MeisterTaskApiAdapter().read("access-token", {
      path: "/api/projects",
      query: { status: "active", items: 25 },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://www.meistertask.com/api/projects?status=active&items=25",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer access-token");
  });

  it("supports bounded JSON mutations and multipart uploads", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 2 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 2 }), { status: 200 }),
      );
    const api = new MeisterTaskApiAdapter();
    await api.manage("token", {
      method: "POST",
      path: "/api/tasks",
      json: { name: "Ship", section_id: 10 },
    });
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Ship", section_id: 10 }),
      }),
    );
    await api.manage("token", {
      method: "POST",
      path: "/api/tasks/2/attachments",
      contentType: "form",
      form: { name: "brief.txt" },
      files: [
        {
          fieldName: "local",
          name: "brief.txt",
          mimeType: "text/plain",
          base64: Buffer.from("brief").toString("base64"),
        },
      ],
    });
    expect(fetchMock.mock.calls[1][1]?.body).toBeInstanceOf(FormData);
  });

  it("blocks traversal, unsupported families, and credential-bearing input", async () => {
    const api = new MeisterTaskApiAdapter();
    await expect(
      api.read("token", { path: "/api/projects/../oauth" }),
    ).rejects.toBeInstanceOf(MeisterTaskApiError);
    await expect(
      api.read("token", { path: "/api/billing" }),
    ).rejects.toBeInstanceOf(MeisterTaskApiError);
    await expect(
      api.manage("token", {
        method: "POST",
        path: "/api/tasks",
        json: { accessToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts credential-like fields and maps throttling safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, access_token: "secret" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Slow down" }), {
          status: 429,
        }),
      );
    await expect(new MeisterTaskApiAdapter().health("token")).resolves.toEqual({
      id: 1,
      access_token: "[redacted]",
    });
    await expect(
      new MeisterTaskApiAdapter().health("token"),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
