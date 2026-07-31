import { CaptivateFmApiAdapter } from "./captivate-fm-api.adapter";

const credentials = {
  apiKey: "customer-key",
  userId: "11111111-1111-4111-8111-111111111111",
  showId: "22222222-2222-4222-8222-222222222222",
};
const episodeId = "33333333-3333-4333-8333-333333333333";
const mediaId = "44444444-4444-4444-8444-444444444444";

describe("CaptivateFmApiAdapter", () => {
  it("authenticates in the body and binds one exact show", async () => {
    const request = jest.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/authenticate/token"))
        return new Response(JSON.stringify({ token: "session-token" }), {
          status: 200,
        });
      if (url.includes("/users/"))
        return new Response(JSON.stringify([{ id: credentials.showId }]), {
          status: 200,
        });
      if (url.endsWith(`/shows/${credentials.showId}/`))
        return new Response(
          JSON.stringify({
            id: credentials.showId,
            title: "Bound",
            itunes_email: "private@example.com",
          }),
          { status: 200 },
        );
      return new Response(
        JSON.stringify({ feed_url: "https://example.com/rss" }),
        { status: 200 },
      );
    });
    const result = await new CaptivateFmApiAdapter(request).health(credentials);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(request.mock.calls[0][0]).toBe(
      "https://api.captivate.fm/authenticate/token",
    );
    expect(String(request.mock.calls[0][1].body)).toContain(
      "token=customer-key",
    );
    expect(request.mock.calls[1][1].headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer session-token" }),
    );
  });

  it("fails closed on cross-show episode records", async () => {
    const adapter = new CaptivateFmApiAdapter(async (url) =>
      url.endsWith("/authenticate/token")
        ? new Response(JSON.stringify({ token: "session-token" }), {
            status: 200,
          })
        : new Response(
            JSON.stringify({
              id: episodeId,
              shows_id: "55555555-5555-4555-8555-555555555555",
            }),
            { status: 200 },
          ),
    );
    await expect(
      adapter.getEpisode(credentials, { episodeId }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("creates typed episodes with the exact show and existing media", async () => {
    const request = jest.fn(async (url: string, _init: RequestInit) =>
      url.endsWith("/authenticate/token")
        ? new Response(JSON.stringify({ token: "session-token" }), {
            status: 200,
          })
        : new Response(
            JSON.stringify({
              id: episodeId,
              shows_id: credentials.showId,
              title: "Draft",
            }),
            { status: 201 },
          ),
    );
    await new CaptivateFmApiAdapter(request).createEpisode(credentials, {
      title: "Draft",
      status: "Draft",
      mediaId,
      itunesBlock: false,
    });
    const body = String(request.mock.calls[1][1].body);
    expect(body).toContain(
      `shows_id=${encodeURIComponent(credentials.showId)}`,
    );
    expect(body).toContain(`media_id=${encodeURIComponent(mediaId)}`);
    expect(body).toContain("status=Draft");
    expect(body).not.toContain("customer-key");
  });

  it("bounds analytics periods", async () => {
    const adapter = new CaptivateFmApiAdapter(async (url) =>
      url.endsWith("/authenticate/token")
        ? new Response(JSON.stringify({ token: "session-token" }), {
            status: 200,
          })
        : new Response(JSON.stringify({}), { status: 200 }),
    );
    await expect(
      adapter.getAnalytics(credentials, {
        metric: "overview",
        start: "2024-01-01T00:00:00Z",
        end: "2026-01-02T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
