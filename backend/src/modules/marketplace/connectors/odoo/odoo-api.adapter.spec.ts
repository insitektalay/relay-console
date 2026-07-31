import { OdooApiAdapter } from "./odoo-api.adapter";

const credentials = {
  database: "relay-example",
  apiKey: "fixture-odoo-api-key",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("OdooApiAdapter", () => {
  it("pins JSON-2 paths, headers, fields, bounds, and redacted outputs", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses: unknown[] = [
      { uid: 7, lang: "en_US", tz: "Europe/London", email: "private" },
      [
        {
          id: 9,
          name: "Launch",
          active: true,
          privacy_visibility: "followers",
          partner_id: [3, "Private customer"],
          user_id: [7, "Private owner"],
          description: "private",
        },
      ],
      [
        {
          id: 9,
          name: "Launch",
          active: true,
          task_ids: [1, 2],
          message_ids: [3],
          collaborator_ids: [4],
        },
      ],
    ];
    const adapter = new OdooApiAdapter(async (url, init) => {
      calls.push({ url, init });
      return json(responses.shift());
    });

    const user = await adapter.getCurrentUser(credentials);
    const list = await adapter.listProjects(credentials, { limit: 3 });
    const exact = await adapter.getProject(credentials, { projectId: 9 });

    expect(calls.map((call) => call.url)).toEqual([
      "https://relay-example.odoo.com/json/2/res.users/context_get",
      "https://relay-example.odoo.com/json/2/project.project/search_read",
      "https://relay-example.odoo.com/json/2/project.project/read",
    ]);
    expect(calls.map((call) => JSON.parse(String(call.init.body)))).toEqual([
      {},
      {
        context: { lang: "en_US" },
        domain: [],
        fields: [
          "id",
          "name",
          "active",
          "date_start",
          "date",
          "privacy_visibility",
          "write_date",
        ],
        limit: 3,
        offset: 0,
        order: "id asc",
      },
      {
        ids: [9],
        context: { lang: "en_US" },
        fields: [
          "id",
          "name",
          "active",
          "date_start",
          "date",
          "privacy_visibility",
          "write_date",
        ],
        load: null,
      },
    ]);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`bearer ${credentials.apiKey}`);
    expect(headers["X-Odoo-Database"]).toBe("relay-example");
    expect(user.user).toEqual({
      userId: 7,
      language: "en_US",
      timezone: "Europe/London",
    });
    expect(list.projects[0]).not.toHaveProperty("partner_id");
    expect(list.projects[0]).not.toHaveProperty("user_id");
    expect(list.projects[0]).not.toHaveProperty("description");
    expect(exact.project).not.toHaveProperty("task_ids");
    expect(exact.project).not.toHaveProperty("message_ids");
    expect(exact.project).not.toHaveProperty("collaborator_ids");
  });

  it("rejects invalid database, credentials, IDs, and limits before network access", async () => {
    const request = jest.fn();
    const adapter = new OdooApiAdapter(request);
    await expect(
      adapter.listProjects(
        { ...credentials, database: "evil.example.com" },
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listProjects({ ...credentials, apiKey: "" }, {}),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getProject(credentials, { projectId: "9" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listProjects(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on user or Project mismatch and provider failures", async () => {
    const missingUser = new OdooApiAdapter(async () => json({ lang: "en_US" }));
    await expect(missingUser.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
    const mismatch = new OdooApiAdapter(async () => json([{ id: 10 }]));
    await expect(
      mismatch.getProject(credentials, { projectId: 9 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    const denied = new OdooApiAdapter(async () =>
      json({ message: `denied ${credentials.apiKey}` }, 403),
    );
    await expect(denied.listProjects(credentials, {})).rejects.toMatchObject({
      code: "insufficient_scope",
      message: "Odoo API request failed.",
    });
  });
});
