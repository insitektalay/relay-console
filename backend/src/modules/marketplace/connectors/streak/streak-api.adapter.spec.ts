import { StreakApiAdapter } from "./streak-api.adapter";

const credentials = { apiKey: "fixture-streak-api-key" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("StreakApiAdapter", () => {
  it("uses only fixed user, pipeline, first-page box, and exact box reads", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses: unknown[] = [
      {
        key: "user_1",
        displayName: "Relay User",
        lowercaseEmail: "private@example.com",
      },
      { key: "pipeline_1", name: "Sales", aclEntries: [{ email: "x@y.z" }] },
      {
        results: [
          { key: "box_1", name: "Deal", contacts: [{ email: "x@y.z" }] },
        ],
        hasNextPage: true,
      },
      { key: "box_1", name: "Deal", notes: "private", fields: { value: 1 } },
    ];
    const adapter = new StreakApiAdapter(async (url, init) => {
      calls.push({ url, init });
      return json(responses.shift());
    });

    const user = await adapter.getCurrentUser(credentials);
    const pipeline = await adapter.getPipeline(credentials, {
      pipelineKey: "pipeline_1",
    });
    const list = await adapter.listBoxes(credentials, {
      pipelineKey: "pipeline_1",
      limit: 3,
    });
    const box = await adapter.getBox(credentials, { boxKey: "box_1" });

    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      ["GET", "https://api.streak.com/api/v1/users/me"],
      ["GET", "https://api.streak.com/api/v1/pipelines/pipeline_1"],
      [
        "GET",
        "https://api.streak.com/api/v1/pipelines/pipeline_1/boxes?page=0&limit=3&sortBy=lastUpdatedTimestamp",
      ],
      ["GET", "https://api.streak.com/api/v1/boxes/box_1"],
    ]);
    expect(
      (calls[0].init.headers as Record<string, string>).Authorization,
    ).toBe(
      `Basic ${Buffer.from("fixture-streak-api-key:").toString("base64")}`,
    );
    expect(user.user).not.toHaveProperty("lowercaseEmail");
    expect(pipeline.pipeline).not.toHaveProperty("aclEntries");
    expect(list.boxes[0]).not.toHaveProperty("contacts");
    expect(list.hasMore).toBe(true);
    expect(box.box).not.toHaveProperty("notes");
    expect(box.box).not.toHaveProperty("fields");
  });

  it("rejects invalid credentials, keys, and bounds before network access", async () => {
    const request = jest.fn();
    const adapter = new StreakApiAdapter(request);
    await expect(adapter.getCurrentUser({ apiKey: "" })).rejects.toMatchObject({
      code: "credential_missing",
    });
    await expect(
      adapter.getPipeline(credentials, { pipelineKey: "../../users/me" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.getBox(credentials, { boxKey: "box/1" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listBoxes(credentials, { pipelineKey: "pipeline_1", limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on identity mismatch and provider failures", async () => {
    const mismatch = new StreakApiAdapter(async () => json({ key: "other" }));
    await expect(
      mismatch.getBox(credentials, { boxKey: "box_1" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });

    const denied = new StreakApiAdapter(async () =>
      json({ message: "denied fixture-streak-api-key" }, 401),
    );
    await expect(denied.getCurrentUser(credentials)).rejects.toMatchObject({
      code: "credential_missing",
      message: "Streak API request failed.",
    });
  });
});
