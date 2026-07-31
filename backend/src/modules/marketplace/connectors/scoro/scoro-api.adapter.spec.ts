import { ScoroApiAdapter } from "./scoro-api.adapter";

const credentials = {
  site: "relay-example",
  companyAccountId: "main",
  apiKey: "fixture-scoro-api-key",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("ScoroApiAdapter", () => {
  it("pins the tenant, AppId, entity, page, paths, and redacted outputs", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses: unknown[] = [
      {
        status: "OK",
        statusCode: 200,
        data: [
          {
            company_name: "Private company",
            email: "private@example.com",
            base_currency: "EUR",
            language: "eng",
            active_entities: [
              { entity_id: "main", entity_name: "Main entity" },
            ],
          },
        ],
      },
      {
        status: "OK",
        statusCode: 200,
        data: [
          {
            project_id: 7,
            project_name: "Launch",
            status: "inprogress",
            company_name: "Private customer",
            manager_email: "manager@example.com",
            description: "private",
          },
        ],
      },
      {
        status: "OK",
        statusCode: 200,
        data: {
          project_id: 7,
          project_name: "Launch",
          status: "inprogress",
          project_users: [{ user_id: 9 }],
          permissions: [{ read: true }],
          tags: ["private"],
        },
      },
    ];
    const adapter = new ScoroApiAdapter(async (url, init) => {
      calls.push({ url, init });
      return json(responses.shift());
    }, "relay-public-app-id");

    const entity = await adapter.getBusinessEntity(credentials);
    const list = await adapter.listProjects(credentials, { limit: 3 });
    const exact = await adapter.getProject(credentials, { projectId: 7 });

    expect(calls.map((call) => call.url)).toEqual([
      "https://relay-example.scoro.com/api/v2/companyAccount/list",
      "https://relay-example.scoro.com/api/v2/projects/list",
      "https://relay-example.scoro.com/api/v2/projects/view/7",
    ]);
    expect(calls.map((call) => JSON.parse(String(call.init.body)))).toEqual([
      {
        apiKey: credentials.apiKey,
        lang: "eng",
        company_account_id: "main",
      },
      {
        apiKey: credentials.apiKey,
        lang: "eng",
        company_account_id: "main",
        page: 1,
        per_page: 3,
        request: {},
      },
      {
        apiKey: credentials.apiKey,
        lang: "eng",
        company_account_id: "main",
        request: {},
      },
    ]);
    expect(
      (calls[0].init.headers as Record<string, string>)["scoro-app-id"],
    ).toBe("relay-public-app-id");
    expect(entity.businessEntity).toEqual({
      entityId: "main",
      entityName: "Main entity",
      baseCurrency: "EUR",
      language: "eng",
    });
    expect(list.projects[0]).not.toHaveProperty("company_name");
    expect(list.projects[0]).not.toHaveProperty("manager_email");
    expect(list.projects[0]).not.toHaveProperty("description");
    expect(exact.project).not.toHaveProperty("project_users");
    expect(exact.project).not.toHaveProperty("permissions");
    expect(exact.project).not.toHaveProperty("tags");
  });

  it("rejects missing AppId, invalid bindings, IDs, and limits before network access", async () => {
    const request = jest.fn();
    await expect(
      new ScoroApiAdapter(request, "").listProjects(credentials, {}),
    ).rejects.toMatchObject({ code: "credential_missing" });
    const adapter = new ScoroApiAdapter(request, "relay-app-id");
    await expect(
      adapter.listProjects({ ...credentials, site: "evil.example.com" }, {}),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listProjects(
        { ...credentials, companyAccountId: "../other" },
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listProjects({ ...credentials, apiKey: "" }, {}),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getProject(credentials, { projectId: "7" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listProjects(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on entity and project mismatch plus provider failures", async () => {
    const entityMismatch = new ScoroApiAdapter(
      async () =>
        json({
          status: "OK",
          statusCode: 200,
          data: [{ active_entities: [{ entity_id: "other" }] }],
        }),
      "relay-app-id",
    );
    await expect(entityMismatch.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });

    const projectMismatch = new ScoroApiAdapter(
      async () =>
        json({ status: "OK", statusCode: 200, data: { project_id: 8 } }),
      "relay-app-id",
    );
    await expect(
      projectMismatch.getProject(credentials, { projectId: 7 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });

    const denied = new ScoroApiAdapter(
      async () =>
        json({
          status: "ERROR",
          statusCode: "403",
          messages: { error: [`denied ${credentials.apiKey}`] },
        }),
      "relay-app-id",
    );
    await expect(denied.listProjects(credentials, {})).rejects.toMatchObject({
      code: "credential_missing",
      message: "Scoro API request failed.",
    });
  });
});
