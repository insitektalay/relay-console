import { ConvertKitApiAdapter } from "./convertkit-api.adapter";

const credentials = {
  accessToken: "private-kit-access-token",
  accountId: "29",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ConvertKitApiAdapter", () => {
  it("validates the exact account while excluding both email addresses", async () => {
    const request = jest.fn(async () =>
      response({
        user: { email: "private-user@example.com" },
        account: {
          id: 29,
          name: "Relay Creators",
          plan_type: "creator",
          primary_email_address: "private-account@example.com",
          created_at: "2025-01-01T00:00:00Z",
          timezone: {
            name: "Europe/London",
            friendly_name: "private timezone label",
            utc_offset: "+01:00",
          },
        },
      }),
    );
    const result = await new ConvertKitApiAdapter(request).getAccount(
      credentials,
    );
    const [url, init] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.kit.com/v4/account");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer private-kit-access-token",
    });
    expect(result.account).toEqual({
      accountId: 29,
      name: "Relay Creators",
      planType: "creator",
      createdAt: "2025-01-01T00:00:00Z",
      timezoneName: "Europe/London",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("lists exactly one fixed page of active Form metadata", async () => {
    const request = jest.fn(async () =>
      response({
        forms: [
          {
            id: 51,
            name: "Product updates",
            created_at: "2025-01-01T00:00:00Z",
            type: "embed",
            format: null,
            embed_js: "https://private.example/embed.js",
            embed_url: "https://private.example/embed",
            archived: false,
            uid: "f049e3d9ab",
            subscribers: [{ email: "private@example.com" }],
          },
        ],
        pagination: { has_next_page: true, end_cursor: "private-cursor" },
      }),
    );
    const result = await new ConvertKitApiAdapter(request).listActiveForms(
      credentials,
    );
    const [url] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.kit.com/v4/forms?per_page=20&status=active",
    );
    expect(result.forms[0]).toEqual({
      formId: 51,
      name: "Product updates",
      createdAt: "2025-01-01T00:00:00Z",
      type: "embed",
      format: null,
      archived: false,
      uid: "f049e3d9ab",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("lists sparse Broadcast lifecycle metadata without content or audiences", async () => {
    const request = jest.fn(async () =>
      response({
        broadcasts: [
          {
            id: 3,
            publication_id: 7,
            created_at: "2025-01-01T00:00:00Z",
            subject: "private subject",
            preview_text: "private preview",
            content: "private content",
            public: false,
            published_at: null,
            send_at: "2026-07-20T09:00:00Z",
            email_address: "private@example.com",
            email_template: { id: 6, name: "private template" },
            subscriber_filter: [{ all: [{ type: "private audience" }] }],
          },
        ],
      }),
    );
    const result = await new ConvertKitApiAdapter(request).listRecentBroadcasts(
      credentials,
    );
    const [url] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.kit.com/v4/broadcasts?per_page=20",
    );
    expect(result.broadcasts[0]).toEqual({
      broadcastId: 3,
      publicationId: 7,
      createdAt: "2025-01-01T00:00:00Z",
      public: false,
      publishedAt: null,
      sendAt: "2026-07-20T09:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects changed or invalid account bindings", async () => {
    const request = jest.fn(async () => response({ account: { id: 30 } }));
    const adapter = new ConvertKitApiAdapter(request);
    await expect(
      adapter.health({ ...credentials, accountId: "../unsafe" }),
    ).rejects.toMatchObject({ code: "convertkit_account_binding_invalid" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "convertkit_account_binding_mismatch",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
