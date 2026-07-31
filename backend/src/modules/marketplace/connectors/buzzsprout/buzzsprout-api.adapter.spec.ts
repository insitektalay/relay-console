import {
  BuzzsproutApiAdapter,
  BuzzsproutApiError,
} from "./buzzsprout-api.adapter";

const credentials = { apiToken: "customer-token", podcastId: "140447" };

describe("BuzzsproutApiAdapter", () => {
  it("binds a token to one podcast without exposing contact email", async () => {
    const request = jest.fn(
      async (_url: string, init: RequestInit) =>
        new Response(
          JSON.stringify([
            {
              id: 140447,
              title: "Bound podcast",
              author: "Creator",
              contact_email: "private@example.com",
            },
          ]),
          { status: 200, headers: { ETag: '"podcasts-v1"' } },
        ),
    );
    const adapter = new BuzzsproutApiAdapter(request);
    await expect(adapter.health(credentials)).resolves.toEqual({
      podcast: expect.objectContaining({ id: 140447, title: "Bound podcast" }),
    });
    expect(request).toHaveBeenCalledWith(
      "https://www.buzzsprout.com/api/podcasts.json",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Token token=customer-token",
          "User-Agent": "RelayConsole-Buzzsprout/1.0",
        }),
      }),
    );
    expect(JSON.stringify(await adapter.health(credentials))).not.toContain(
      "private@example.com",
    );
    expect(
      (request.mock.calls[1][1].headers as Record<string, string>)[
        "If-None-Match"
      ],
    ).toBe('"podcasts-v1"');
  });

  it("bounds and filters episode lists", async () => {
    const adapter = new BuzzsproutApiAdapter(
      async () =>
        new Response(
          JSON.stringify([
            { id: 1, title: "Public", private: false, inactive_at: null },
            { id: 2, title: "Private", private: true, inactive_at: null },
            {
              id: 3,
              title: "Inactive",
              private: false,
              inactive_at: "2026-01-01",
            },
          ]),
          { status: 200 },
        ),
    );
    await expect(
      adapter.listEpisodes(credentials, { limit: 10 }),
    ).resolves.toEqual(
      expect.objectContaining({
        episodes: [expect.objectContaining({ id: 1, title: "Public" })],
        matched: 1,
        truncated: false,
      }),
    );
  });

  it("creates typed episodes and never places the token in the URL", async () => {
    const request = jest.fn(
      async (_url: string, init: RequestInit) =>
        new Response(
          JSON.stringify({ id: 99, title: "Draft", private: true }),
          { status: 201 },
        ),
    );
    const adapter = new BuzzsproutApiAdapter(request);
    await adapter.createEpisode(credentials, {
      title: "Draft",
      private: true,
      audioUrl: "https://media.example.com/draft.mp3",
    });
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("https://www.buzzsprout.com/api/140447/episodes.json");
    expect(url).not.toContain("customer-token");
    expect(JSON.parse(String(init.body))).toEqual({
      title: "Draft",
      private: true,
      audio_url: "https://media.example.com/draft.mp3",
    });
  });

  it("rejects local provider-fetched media and empty updates", async () => {
    const adapter = new BuzzsproutApiAdapter();
    await expect(
      adapter.createEpisode(credentials, {
        title: "Blocked",
        audioUrl: "https://127.0.0.1/private.mp3",
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.updateEpisode(credentials, { episodeId: 10 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("fails closed when the podcast binding is not authorized", async () => {
    const adapter = new BuzzsproutApiAdapter(
      async () =>
        new Response(JSON.stringify([{ id: 9, title: "Different" }]), {
          status: 200,
        }),
    );
    await expect(adapter.health(credentials)).rejects.toBeInstanceOf(
      BuzzsproutApiError,
    );
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
