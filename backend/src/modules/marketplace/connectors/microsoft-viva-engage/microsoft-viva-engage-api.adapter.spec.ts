import {
  MicrosoftVivaEngageApiAdapter,
  MicrosoftVivaEngageApiError,
} from "./microsoft-viva-engage-api.adapter";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("MicrosoftVivaEngageApiAdapter", () => {
  const binding = {
    currentUserId: "2001",
    networkId: "1001",
    communityId: "3001",
  };

  it("uses only fixed Core API GETs and strips identities and attachments", async () => {
    const calls: URL[] = [];
    const adapter = new MicrosoftVivaEngageApiAdapter(async (url, init) => {
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("error");
      calls.push(new URL(url));
      if (url.includes("networks/current"))
        return response([{ id: 1001, name: "Contoso", admin: "blocked" }]);
      if (url.includes("users/current"))
        return response({
          id: 2001,
          full_name: "Alex Morgan",
          email: "blocked@example.com",
        });
      if (url.includes("groups/for_user"))
        return response([
          {
            id: 3001,
            name: "Product Launch",
            description: "Updates",
            users: [{ id: "blocked" }],
          },
        ]);
      return response({
        messages: [
          {
            id: 4001,
            thread_id: 4001,
            group_id: 3001,
            body: { plain: "Launch readiness review" },
            sender_id: "blocked",
            attachments: [{ id: "blocked" }],
          },
        ],
        meta: { older_available: true },
      });
    });

    const network = await adapter.getNetwork("token", binding);
    const user = await adapter.getCurrentUser("token", binding);
    const communities = await adapter.listMyCommunities("token", binding);
    const messages = await adapter.listSelectedCommunityMessages(
      "token",
      binding,
    );

    expect(network.network).toMatchObject({
      id: "1001",
      adminFieldsExcluded: true,
    });
    expect(user.currentUser).not.toHaveProperty("email");
    expect(communities.communities[0]).not.toHaveProperty("users");
    expect(messages.messages[0]).toMatchObject({
      communityId: "3001",
      senderIdentityExcluded: true,
      attachmentsExcluded: true,
    });
    expect(messages.messages[0]).not.toHaveProperty("sender_id");
    expect(messages.nextPageFollowed).toBe(false);
    expect(calls.every((url) => url.origin === "https://www.yammer.com")).toBe(
      true,
    );
    expect(calls[3].searchParams.get("threaded")).toBe("extended");
    expect(calls[3].searchParams.get("limit")).toBe("25");
  });

  it("rejects invalid bindings and cross-community messages", async () => {
    const adapter = new MicrosoftVivaEngageApiAdapter(async () =>
      response({ messages: [{ id: 1, group_id: 9999 }] }),
    );
    await expect(
      adapter.listMyCommunities("token", { ...binding, currentUserId: "../1" }),
    ).rejects.toBeInstanceOf(MicrosoftVivaEngageApiError);
    await expect(
      adapter.listSelectedCommunityMessages("token", binding),
    ).rejects.toMatchObject<Partial<MicrosoftVivaEngageApiError>>({
      code: "microsoft_viva_engage_selected_community_mismatch",
    });
  });

  it("maps throttling to a provider-safe error", async () => {
    const adapter = new MicrosoftVivaEngageApiAdapter(async () =>
      response({}, 429),
    );
    await expect(adapter.getNetwork("token", binding)).rejects.toMatchObject<
      Partial<MicrosoftVivaEngageApiError>
    >({ code: "microsoft_viva_engage_rate_limited", statusCode: 429 });
  });
});
