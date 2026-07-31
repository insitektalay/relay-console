import { QwilrApiAdapter, QwilrApiError } from "./qwilr-api.adapter";
import { QWILR_CONNECTOR_MANIFEST } from "./qwilr.connector";

const credentials = { accessToken: "customer-qwilr-token" };

describe("Qwilr connector", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("confines a broad customer token to two reads and approval-gated draft creation", () => {
    expect(QWILR_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(QWILR_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual([
      "read",
      "read",
      "write",
    ]);
    expect(
      QWILR_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual(["qwilr_page_create_draft"]);
    expect(
      QWILR_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (action) => action.id,
      ),
    ).toContain("qwilr_page_create_draft");
  });

  it("lists at most 50 saved-block summaries without block content", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          Array.from({ length: 60 }, (_, index) => ({
            id: `block-${index}`,
            name: `Block ${index}`,
            type: "text",
            content: "private content",
            substitutions: { secret: "value" },
          })),
        ),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock as typeof fetch;
    const result = await new QwilrApiAdapter().listSavedBlocks(credentials, {
      resultLimit: 50,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.qwilr.com/v1/blocks/saved",
    );
    expect(result.blocks).toHaveLength(50);
    expect(JSON.stringify(result)).not.toContain("private content");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("gets one page and strips people, links, acceptance, content, and payment data", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "6ee0f841f3cc8900090d82dc",
          name: "Proposal",
          status: "draft",
          tags: ["sales"],
          links: { publicUrl: "https://private.example/page" },
          acceptance: { accepters: [{ email: "buyer@example.com" }] },
          blocks: [{ content: "private" }],
          paymentSettings: { gatewayId: "gateway-1" },
        }),
        { status: 200 },
      ),
    ) as typeof fetch;
    const result = await new QwilrApiAdapter().getPage(credentials, {
      pageId: "6ee0f841f3cc8900090d82dc",
    });
    expect(result.page).toEqual({
      pageId: "6ee0f841f3cc8900090d82dc",
      name: "Proposal",
      status: "draft",
      tags: ["sales"],
      createdAt: null,
      updatedAt: null,
    });
    expect(JSON.stringify(result)).not.toContain("buyer@example.com");
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(JSON.stringify(result)).not.toContain("gateway-1");
  });

  it("creates only an unpublished template draft and redacts the provider response", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "6ee0f841f3cc8900090d82dc",
          name: "Proposal",
          status: "draft",
          published: false,
          links: { editorUrl: "https://private.example/editor" },
          acceptance: { accepters: [{ email: "buyer@example.com" }] },
        }),
        { status: 201 },
      ),
    );
    global.fetch = fetchMock as typeof fetch;
    const result = await new QwilrApiAdapter().createPageDraft(credentials, {
      templateId: "6ee0f841f3cc8900090d82db",
      name: "Proposal",
      substitutions: { company: "Example Co" },
      tags: ["sales"],
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.qwilr.com/v1/pages",
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      templateId: "6ee0f841f3cc8900090d82db",
      name: "Proposal",
      published: false,
      substitutions: { company: "Example Co" },
      tags: ["sales"],
    });
    expect(result).toMatchObject({
      published: false,
      substitutionCount: 1,
      tagCount: 1,
      page: { pageId: "6ee0f841f3cc8900090d82dc" },
    });
    expect(JSON.stringify(result)).not.toContain("buyer@example.com");
    expect(JSON.stringify(result)).not.toContain("private.example");
  });

  it("rejects invalid IDs, limits, and credential-bearing substitutions before fetch", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const adapter = new QwilrApiAdapter();
    await expect(
      adapter.getPage(credentials, { pageId: "../private" }),
    ).rejects.toBeInstanceOf(QwilrApiError);
    await expect(
      adapter.listSavedBlocks(credentials, { resultLimit: 51 }),
    ).rejects.toBeInstanceOf(QwilrApiError);
    await expect(
      adapter.createPageDraft(credentials, {
        templateId: "6ee0f841f3cc8900090d82db",
        name: "Proposal",
        substitutions: { api_token: "secret" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
