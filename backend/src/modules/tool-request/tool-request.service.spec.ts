import { ToolRequestService } from "./tool-request.service";

const MARKETPLACE_BETA_ENV_KEYS = [
  "CLAWCHAT_MARKETPLACE_BETA_MODE",
  "CLAWCHAT_MARKETPLACE_ALLOWED_APPS",
  "CLAWCHAT_MARKETPLACE_BLOCKED_APPS",
] as const;

function captureMarketplaceBetaEnv() {
  return Object.fromEntries(
    MARKETPLACE_BETA_ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<(typeof MARKETPLACE_BETA_ENV_KEYS)[number], string | undefined>;
}

function restoreMarketplaceBetaEnv(
  original: Record<(typeof MARKETPLACE_BETA_ENV_KEYS)[number], string | undefined>,
) {
  for (const key of MARKETPLACE_BETA_ENV_KEYS) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
}

function makeRepo<T extends { id?: string }>() {
  const rows: T[] = [];
  return {
    rows,
    create: jest.fn((input: T) => ({ ...input, id: input.id ?? `tr_${rows.length + 1}` })),
    save: jest.fn(async (input: T) => {
      const existing = rows.findIndex((row) => row.id === input.id);
      if (existing >= 0) rows[existing] = input;
      else rows.push(input);
      return input;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      const clauses = Array.isArray(where) ? where : [where];
      return (
        rows.find((row: any) =>
          clauses.some((clause: any) =>
            Object.entries(clause).every(([key, value]: [string, any]) => {
              if (value && value._type === "in") return value._value.includes(row[key]);
              return row[key] === value;
            }),
          ),
        ) ?? null
      );
    }),
    find: jest.fn(async ({ where }: any = {}) => {
      if (!where) return rows;
      const clauses = Array.isArray(where) ? where : [where];
      return rows.filter((row: any) =>
        clauses.some((clause: any) =>
          Object.entries(clause).every(([key, value]: [string, any]) => {
            if (value && value._type === "in") return value._value.includes(row[key]);
            return row[key] === value;
          }),
        ),
      );
    }),
    createQueryBuilder: jest.fn(() => {
      const params: Record<string, any> = {};
      return {
        where: jest.fn(function (_clause: string, nextParams: Record<string, any>) {
          Object.assign(params, nextParams);
          return this;
        }),
        andWhere: jest.fn(function (_clause: string, nextParams: Record<string, any>) {
          Object.assign(params, nextParams);
          return this;
        }),
        getOne: jest.fn(async () => {
          return (
            rows.find((row: any) => {
              if (row.workspaceId !== params.workspaceId) return false;
              if (params.campaignId && row.metadata?.localappconnectorCampaignId === params.campaignId) {
                return true;
              }
              if (
                params.campaignName &&
                row.metadata?.localappconnectorCampaignName === params.campaignName
              ) {
                return true;
              }
              return false;
            }) ?? null
          );
        }),
      };
    }),
  };
}

describe("ToolRequestService", () => {
  const originalBetaEnv = captureMarketplaceBetaEnv();

  afterEach(() => {
    restoreMarketplaceBetaEnv(originalBetaEnv);
  });

  function setup() {
    const toolRequestRepo = makeRepo<any>();
    const linkedAppRepo = makeRepo<any>();
    const connectionRepo = makeRepo<any>();
    const taskRepo = makeRepo<any>();
    const scheduledMessageRepo = makeRepo<any>();
    const service = new ToolRequestService(
      toolRequestRepo as any,
      linkedAppRepo as any,
      connectionRepo as any,
      taskRepo as any,
      scheduledMessageRepo as any,
    );
    return { service, toolRequestRepo, linkedAppRepo, connectionRepo, taskRepo, scheduledMessageRepo };
  }

  it("creates a policy-allowed missing email_send tool request", async () => {
    const { service } = setup();
    const result = await service.createToolRequest("ws_1", {
      appSlug: "local-localappconnector",
      requestedCapability: "email_send",
      requiredForAction: "outreach.record_sent",
      reason: "Send approved outreach",
      policyAllowed: true,
      toolAvailable: false,
      autonomyModeAtRequest: "dangerously_skip_permissions",
    });

    expect(result.created).toBe(true);
    expect(result.request?.requestedCapability).toBe("email_send");
    expect(result.request?.status).toBe("requested");
    expect(result.request?.suggestedMarketplaceAppSlugs).toEqual([
      "gmail",
      "outlook",
      "resend",
      "smtp",
    ]);
  });

  it("blocks explicit tool requests before the provider release gate opens", async () => {
    process.env.CLAWCHAT_MARKETPLACE_BETA_MODE = "true";
    process.env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS = "github, x";
    process.env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS = "x";
    const { service } = setup();

    await expect(
      service.createToolRequest("ws_1", {
        appSlug: "x",
        requestedCapability: "external_publishing",
        requiredForAction: "publish.post",
        reason: "Need X posting",
        policyAllowed: true,
      }),
    ).rejects.toThrow("X cannot connect yet: Coming later.");
  });

  it.each([
    ["external_search", ["exa", "serpapi", "google-search", "brave-search"]],
    ["content_extraction", ["exa", "browser", "crawler"]],
    ["deep_research", ["exa", "perplexity"]],
    ["public_form_submit", ["browser", "browserbase", "playwright"]],
    ["backlink_verification", ["ahrefs", "semrush", "screaming-frog", "crawler"]],
  ])("creates a policy-allowed missing %s tool request", async (capability, suggestions) => {
    const { service } = setup();
    const result = await service.createToolRequest("ws_1", {
      appSlug: "local-localappconnector",
      campaignName: "AI YouTube Channels Backlink Campaign",
      requestedCapability: capability,
      requiredForAction: `${capability}.execute`,
      reason: `Need ${capability} for LocalAppConnector campaign execution`,
      policyAllowed: true,
      toolAvailable: false,
      autonomyModeAtRequest: "dangerously_skip_permissions",
    });

    expect(result.created).toBe(true);
    expect(result.request?.requestedCapability).toBe(capability);
    expect(result.request?.suggestedMarketplaceAppSlugs).toEqual(suggestions);
  });

  it("deduplicates repeated open missing-tool requests", async () => {
    const { service, toolRequestRepo } = setup();
    const payload = {
      appSlug: "local-localappconnector",
      teamId: "team_1",
      requestedCapability: "email_send",
      requiredForAction: "outreach.record_sent",
      reason: "Send approved outreach",
      policyAllowed: true,
    };
    await service.createToolRequest("ws_1", payload);
    const second = await service.createToolRequest("ws_1", {
      ...payload,
      reason: "Send approved outreach again",
    });

    expect(second.created).toBe(false);
    expect(second.reason).toBe("deduped");
    expect(toolRequestRepo.rows).toHaveLength(1);
    expect(toolRequestRepo.rows[0].reason).toBe("Send approved outreach again");
  });

  it("does not create a request for policy-blocked actions", async () => {
    const { service, toolRequestRepo } = setup();
    const result = await service.createToolRequest("ws_1", {
      appSlug: "local-localappconnector",
      requestedCapability: "public_form_submit",
      requiredForAction: "directory.submit",
      reason: "Submit listing",
      policyAllowed: false,
    });

    expect(result.created).toBe(false);
    expect(result.reason).toBe("blocked_by_policy");
    expect(toolRequestRepo.rows).toHaveLength(0);
  });

  it("marks matching requests connected or granted when a tool connection appears", async () => {
    const { service, toolRequestRepo } = setup();
    await service.createToolRequest("ws_1", {
      appSlug: "local-localappconnector",
      requestedCapability: "email_send",
      requiredForAction: "outreach.record_sent",
      reason: "Send approved outreach",
      policyAllowed: true,
    });

    await service.resolveToolRequestsFromConnection({
      workspaceId: "ws_1",
      appSlug: "gmail",
      selectedCapabilities: ["email_send"],
    });

    expect(toolRequestRepo.rows[0].status).toBe("granted");
    expect(toolRequestRepo.rows[0].toolConnected).toBe(true);
    expect(toolRequestRepo.rows[0].toolGranted).toBe(true);
  });

  it("marks LocalAppConnector external_search granted when Exa search is connected", async () => {
    const { service, toolRequestRepo } = setup();
    await service.createToolRequest("ws_1", {
      appSlug: "local-localappconnector",
      requestedCapability: "external_search",
      requiredForAction: "prospects.search",
      reason: "Search for backlink prospects",
      policyAllowed: true,
    });

    await service.resolveToolRequestsFromConnection({
      workspaceId: "ws_1",
      appSlug: "exa",
      selectedCapabilities: ["search"],
    });

    expect(toolRequestRepo.rows[0].status).toBe("granted");
    expect(toolRequestRepo.rows[0].toolConnected).toBe(true);
    expect(toolRequestRepo.rows[0].toolGranted).toBe(true);
  });

  it("grants Exa capability aliases for content and evidence requests", async () => {
    const { service, toolRequestRepo } = setup();
    await service.createToolRequest("ws_1", {
      appSlug: "local-localappconnector",
      requestedCapability: "content_extraction",
      requiredForAction: "prospects.extract",
      reason: "Extract candidate page content",
      policyAllowed: true,
    });
    await service.createToolRequest("ws_1", {
      appSlug: "local-localappconnector",
      requestedCapability: "evidence_gathering",
      requiredForAction: "prospects.evidence",
      reason: "Gather cited evidence",
      policyAllowed: true,
    });

    await service.resolveToolRequestsFromConnection({
      workspaceId: "ws_1",
      appSlug: "exa",
      selectedCapabilities: ["contents", "answer"],
    });

    expect(toolRequestRepo.rows.map((row) => row.status)).toEqual(["granted", "granted"]);
  });

  it("annotates scheduled continuation metadata when a related task is blocked", async () => {
    const { service, taskRepo, scheduledMessageRepo } = setup();
    taskRepo.rows.push({
      id: "task_1",
      workspaceId: "ws_1",
      scheduledMessageId: "scheduled_1",
    });
    scheduledMessageRepo.rows.push({
      id: "scheduled_1",
      metadata: {},
    });

    await service.createToolRequest("ws_1", {
      appSlug: "local-localappconnector",
      requestedCapability: "backlink_verification",
      requiredForAction: "backlink.verify_live",
      reason: "Verify live backlink",
      relatedTaskId: "task_1",
      policyAllowed: true,
    });

    expect(scheduledMessageRepo.rows[0].metadata).toEqual(
      expect.objectContaining({
        pendingToolRequestCapability: "backlink_verification",
      }),
    );
  });

  it("lists LocalAppConnector requests created with appSlug=localappconnector when filtering local-localappconnector", async () => {
    const { service, linkedAppRepo } = setup();
    linkedAppRepo.rows.push({
      id: "linked-localappconnector",
      workspaceId: "ws_1",
      slug: "local-localappconnector",
      name: "LocalAppConnector",
      metadata: {
        localappconnectorCampaignId: "campaign-1",
        localappconnectorCampaignName: "AI YouTube Channels Backlink Campaign",
      },
    });

    const created = await service.createToolRequest("ws_1", {
      appSlug: "localappconnector",
      requestedCapability: "email_send",
      requiredForAction: "outreach.record_sent",
      reason: "Send approved outreach",
      campaignId: "campaign-1",
      campaignName: "AI YouTube Channels Backlink Campaign",
      policyAllowed: true,
    });
    expect(created.request?.appSlug).toBe("local-localappconnector");
    expect(created.request?.linkedAppId).toBe("linked-localappconnector");

    const requests = await service.listToolRequests("ws_1", {
      appSlug: "local-localappconnector",
    });
    expect(requests.map((request) => request.requestedCapability)).toEqual([
      "email_send",
    ]);
  });

  it("shows legacy LocalAppConnector requests stored as appSlug=localappconnector under local-localappconnector filters", async () => {
    const { service, toolRequestRepo, linkedAppRepo } = setup();
    linkedAppRepo.rows.push({
      id: "linked-localappconnector",
      workspaceId: "ws_1",
      slug: "local-localappconnector",
      name: "LocalAppConnector",
      metadata: {},
    });
    toolRequestRepo.rows.push({
      id: "legacy-1",
      workspaceId: "ws_1",
      linkedAppId: null,
      appSlug: "localappconnector",
      requestedCapability: "external_search",
      requiredForAction: "prospects.search",
      reason: "Search",
      status: "requested",
    });

    const requests = await service.listToolRequests("ws_1", {
      appSlug: "local-localappconnector",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].appSlug).toBe("localappconnector");
  });
});
