import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { validateSync } from "class-validator";
import { LinkedApplicationEntity } from "../../entities";
import { AgentDocumentationInstallService } from "../agent-documentation/services/agent-documentation-install.service";
import { repoPackPathToWorkspaceFilename } from "../agent-documentation/agent-documentation.utils";
import { MARKETPLACE_CATALOG } from "./catalog/marketplace-catalog";
import { InstallMarketplaceAppDto } from "./dto/marketplace.dto";
import { MarketplaceService } from "./marketplace.service";
import {
  compileCanonicalHermesPack,
  compileCanonicalOpenClawPack,
} from "./packs/canonical-pack";
import { compileGeneratedMarketplacePack } from "./pack-factory/generated-pack-compiler";
import { generateDraftPackFromConfig } from "./pack-factory/generator";
import { evaluateGeneratedPackReviewGate } from "./pack-factory/review-gate";
import { type MarketplacePackFactoryConfig } from "./pack-factory/types";

jest.mock("./marketplace-release-policy", () => {
  const actual = jest.requireActual("./marketplace-release-policy");
  return {
    ...actual,
    // These service tests exercise beta gating and install internals. The
    // release-policy suite separately proves the fail-closed production gate.
    assertMarketplaceReleaseConnectEligible: jest.fn(() => ({
      connectEligible: true,
      liveVerified: true,
    })),
  };
});

type MarketplaceServiceTestOptions = {
  bridgeService?: Record<string, unknown>;
  linkedApplicationRepo?: Record<string, unknown>;
  connectionRepo?: Record<string, unknown>;
  auditLogService?: Record<string, unknown>;
};

async function readTestSourceFiles(root: string, directory = root) {
  const files: Array<{
    relativePath: string;
    content: string;
    sizeBytes: number;
  }> = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readTestSourceFiles(root, absolutePath)));
    } else if (
      entry.isFile() &&
      [".md", ".json", ".yaml", ".yml"].some((extension) =>
        entry.name.endsWith(extension),
      )
    ) {
      const content = await readFile(absolutePath, "utf8");
      files.push({
        relativePath: relative(root, absolutePath).replace(/\\/g, "/"),
        content,
        sizeBytes: Buffer.byteLength(content),
      });
    }
  }
  return files;
}

const defaultTestBridgeService = {
  readMarketplaceLocalRepoDocs: jest.fn(
    async (
      _workspaceId: string,
      input: { repoPath: string; docsSourcePath: string },
    ) => {
      const docsRoot = join(
        input.repoPath,
        input.docsSourcePath.replace(/^\.?\//, "").replace(/\/+$/, ""),
      );
      return {
        status: "ok",
        repoPath: input.repoPath,
        docsSourcePath: input.docsSourcePath,
        files: await readTestSourceFiles(docsRoot),
        missingFiles: [],
        errors: [],
        gitCommit: null,
        gitBranch: null,
        dirtyState: false,
        dirtyFiles: [],
      };
    },
  ),
};

const MARKETPLACE_BETA_ENV_KEYS = [
  "CLAWCHAT_MARKETPLACE_BETA_MODE",
  "CLAWCHAT_MARKETPLACE_ALLOWED_APPS",
  "CLAWCHAT_MARKETPLACE_BLOCKED_APPS",
  "CLAWCHAT_MARKETPLACE_KILL_SWITCH",
] as const;

function createMarketplaceService(options: MarketplaceServiceTestOptions = {}) {
  return new MarketplaceService(
    {} as any,
    (options.auditLogService ?? {}) as any,
    {} as any,
    {} as any,
    {} as any,
    (options.bridgeService ?? defaultTestBridgeService) as any,
    {} as any,
    (options.connectionRepo ?? {}) as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    (options.linkedApplicationRepo ?? {}) as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

describe("Marketplace credential verification reconciliation", () => {
  function fixture() {
    const connection = {
      id: "connection-1",
      workspaceId: "workspace-1",
      appSlug: "example",
      displayName: "Example",
      environment: "default",
      authType: "api_key",
      executionAuthority: "railway",
      credentialNames: ["EXAMPLE_API_KEY"],
      secretCiphertext: "ciphertext",
      secretIv: "iv",
      secretAuthTag: "tag",
      secretKeyVersion: "v1",
      selectedCapabilities: ["read"],
      status: "unverified",
      lastValidatedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: {},
      createdByUserId: "user-1",
      updatedByUserId: "user-1",
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-20T10:00:00.000Z"),
    };
    const connectionRepo = {
      findOne: jest.fn().mockResolvedValue(connection),
      save: jest.fn(async (value) => value),
    };
    const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    return {
      connection,
      connectionRepo,
      service: createMarketplaceService({ connectionRepo, auditLogService }),
    };
  }

  it("marks a provider-authenticated connection ready without exposing credentials", async () => {
    const { connection, service } = fixture();
    const result = await service.reconcileConnectionVerification(
      "workspace-1",
      "connection-1",
      "user-1",
      { status: "ready", tokenValid: true },
      false,
    );
    expect(result.status).toBe("ready");
    expect(result.metadata.connectionVerification).toEqual(
      expect.objectContaining({ customerStatus: "customer_connected" }),
    );
    expect(result).not.toHaveProperty("secretCiphertext");
    expect(connection.secretCiphertext).toBe("ciphertext");
  });

  it("deletes every encrypted field after rejected credentials", async () => {
    const { connection, service } = fixture();
    const result = await service.reconcileConnectionVerification(
      "workspace-1",
      "connection-1",
      "user-1",
      { status: "error", tokenValid: false, errorCode: "token_expired" },
      true,
    );
    expect(result.status).toBe("needs_credentials");
    expect(connection).toEqual(
      expect.objectContaining({
        credentialNames: [],
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
      }),
    );
  });

  it("retains a no-probe credential only with explicit consent and labels it unverified", async () => {
    const { connection, service } = fixture();
    const result = await service.reconcileConnectionVerification(
      "workspace-1",
      "connection-1",
      "user-1",
      {
        status: "ready",
        tokenValid: false,
        networkPolicy: "no_provider_egress",
      },
      true,
    );
    expect(result.status).toBe("ready");
    expect(result.metadata.connectionVerification).toEqual(
      expect.objectContaining({
        customerStatus: "configured_unverified",
        networkPolicy: "no_provider_egress",
      }),
    );
    expect(connection.secretCiphertext).toBe("ciphertext");
  });
});

describe("Marketplace configure-only runtime boundary", () => {
  it("publishes Exa Search under the Swift-compatible canonical slug", () => {
    const service = createMarketplaceService();
    const exa = service.getPublicApp("exa-search");
    const legacyExa = service.getPublicApp("exa");

    expect(exa).toEqual(
      expect.objectContaining({
        slug: "exa-search",
        name: "Exa Search",
        availability: "available",
      }),
    );
    expect(legacyExa.slug).toBe("exa-search");
  });

  it("rejects direct API installation when every runtime is unsupported", () => {
    const service = createMarketplaceService();
    const app = MARKETPLACE_CATALOG.find((entry) => entry.slug === "birdeye")!;

    expect(() =>
      (service as any).assertRuntimeInstallable(app, "openclaw"),
    ).toThrow(/No Birdeye wrappers are mounted/);
  });
});

function createMarketplaceServiceWithBridge(
  bridgeService: Record<string, unknown>,
) {
  return createMarketplaceService({ bridgeService });
}

function allowMarketplaceInstallInternalsForTest(service: MarketplaceService) {
  // The release-policy suite verifies the production fail-closed boundary.
  // These tests target install validation and persistence after that boundary.
  (service as any).assertMarketplaceAppAvailableForBeta = jest.fn();
}

function createMarketplaceInstallRepoMock(activeInstalls: unknown[] = []) {
  const queryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(activeInstalls),
  };
  const repo: Record<string, any> = {
    create: jest.fn((input) => ({ ...input })),
    save: jest.fn(async (input) => {
      if (Array.isArray(input)) return input;
      return {
        id: input.id ?? "marketplace-install-1",
        createdAt: input.createdAt ?? new Date("2026-05-13T10:00:00.000Z"),
        updatedAt: input.updatedAt ?? new Date("2026-05-13T10:00:00.000Z"),
        ...input,
      };
    }),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  repo.manager = {
    transaction: jest.fn(async (callback) =>
      callback({
        getRepository: jest.fn(() => repo),
      }),
    ),
  };
  return { repo, queryBuilder };
}

function captureMarketplaceBetaEnv() {
  return Object.fromEntries(
    MARKETPLACE_BETA_ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<(typeof MARKETPLACE_BETA_ENV_KEYS)[number], string | undefined>;
}

function restoreMarketplaceBetaEnv(
  original: Record<
    (typeof MARKETPLACE_BETA_ENV_KEYS)[number],
    string | undefined
  >,
) {
  for (const key of MARKETPLACE_BETA_ENV_KEYS) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
}

describe("MarketplaceService source types", () => {
  it("publishes kvCORE as a non-connectable role-inherited token security preview", async () => {
    const kvcore = MARKETPLACE_CATALOG.find((app) => app.slug === "kvcore");
    expect(kvcore).toEqual(
      expect.objectContaining({
        name: "kvCORE",
        availability: "preview",
        connectionTypes: [
          "api_token",
          "user_role_inherited_authority",
          "super_account_context_switching",
          "security_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "kvcore",
        displayName: "kvCORE",
        authType: "api_token",
        credentials: {},
        selectedCapabilities: ["kvcore_crm_access_review"],
      } as any),
    ).rejects.toThrow(
      "kvCORE is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes Real Geeks as a non-connectable partner lead-data preview", async () => {
    const realGeeks = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "real-geeks",
    );
    expect(realGeeks).toEqual(
      expect.objectContaining({
        name: "Real Geeks",
        availability: "preview",
        connectionTypes: [
          "partner_basic_auth",
          "multi_site_product_credentials",
          "site_uuid_grants",
          "provider_access_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "real-geeks",
        displayName: "Real Geeks",
        authType: "partner_basic_auth",
        credentials: {},
        selectedCapabilities: ["real_geeks_lead_integration_review"],
      } as any),
    ).rejects.toThrow(
      "Real Geeks is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes LionDesk as a non-connectable legacy CRM migration preview", async () => {
    const liondesk = MARKETPLACE_CATALOG.find((app) => app.slug === "liondesk");
    expect(liondesk).toEqual(
      expect.objectContaining({
        name: "LionDesk",
        availability: "preview",
        connectionTypes: [
          "legacy_crm",
          "migration_to_lone_wolf_relationships",
          "public_api_contract_unavailable",
          "provider_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "liondesk",
        displayName: "LionDesk",
        authType: "legacy_crm",
        credentials: {},
        selectedCapabilities: ["liondesk_legacy_migration_review"],
      } as any),
    ).rejects.toThrow(
      "LionDesk is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes Propertybase as a non-connectable Salesforce product-family preview", async () => {
    const propertybase = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "propertybase",
    );
    expect(propertybase).toEqual(
      expect.objectContaining({
        name: "Propertybase",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_salesforce",
          "propertybase_salesforce_edition",
          "propertybase_custom_objects_unsupported",
          "propertybase_go_is_front_office",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "propertybase",
        displayName: "Propertybase",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["propertybase_salesforce_extension_review"],
      } as any),
    ).rejects.toThrow(
      "Propertybase is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes Wise Agent as a non-connectable coarse-scope OAuth security preview", async () => {
    const wiseAgent = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "wise-agent",
    );
    expect(wiseAgent).toEqual(
      expect.objectContaining({
        name: "Wise Agent",
        availability: "preview",
        connectionTypes: [
          "oauth2_authorization_code",
          "provider_issued_client",
          "coarse_read_write_scopes",
          "refresh_and_revoke",
          "ai_access_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "wise-agent",
        displayName: "Wise Agent",
        authType: "oauth2_authorization_code",
        credentials: {},
        selectedCapabilities: ["wise_agent_oauth_security_review"],
      } as any),
    ).rejects.toThrow(
      "Wise Agent is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes Top Producer as a non-connectable provider-partnership preview", async () => {
    const topProducer = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "top-producer",
    );
    expect(topProducer).toEqual(
      expect.objectContaining({
        name: "Top Producer",
        availability: "preview",
        connectionTypes: [
          "provider_managed_integrations",
          "invite_only_zapier_lead_action",
          "api_key_or_oauth_contract_unspecified",
          "provider_partnership_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "top-producer",
        displayName: "Top Producer",
        authType: "provider_managed_integrations",
        credentials: {},
        selectedCapabilities: ["top_producer_partnership_review"],
      } as any),
    ).rejects.toThrow(
      "Top Producer is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes CINC as a non-connectable partner API security preview", async () => {
    const cinc = MARKETPLACE_CATALOG.find((app) => app.slug === "cinc");
    expect(cinc).toEqual(
      expect.objectContaining({
        name: "CINC",
        availability: "preview",
        connectionTypes: [
          "public_api",
          "partner_approval_required",
          "undocumented_authentication",
          "security_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "cinc",
        displayName: "CINC",
        authType: "public_api",
        credentials: {},
        selectedCapabilities: ["cinc_integration_review"],
      } as any),
    ).rejects.toThrow(
      "CINC is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes Realvolve as a non-connectable broad API-key security preview", async () => {
    const realvolve = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "realvolve",
    );
    expect(realvolve).toEqual(
      expect.objectContaining({
        name: "Realvolve",
        availability: "preview",
        connectionTypes: [
          "utility_api_key",
          "zapier_api_key",
          "contact_write_authority",
          "security_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "realvolve",
        displayName: "Realvolve",
        authType: "utility_api_key",
        credentials: {},
        selectedCapabilities: ["realvolve_integration_review"],
      } as any),
    ).rejects.toThrow(
      "Realvolve is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes Sierra Interactive as a non-connectable broad API-key security preview", async () => {
    const sierra = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "sierra-interactive",
    );
    expect(sierra).toEqual(
      expect.objectContaining({
        name: "Sierra Interactive",
        availability: "preview",
        connectionTypes: [
          "customer_api_key",
          "role_inherited_crm_authority",
          "provider_partner_review_required",
          "security_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "sierra-interactive",
        displayName: "Sierra Interactive",
        authType: "customer_api_key",
        credentials: {},
        selectedCapabilities: ["sierra_interactive_integration_review"],
      } as any),
    ).rejects.toThrow(
      "Sierra Interactive is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes Placester as a non-connectable webhook security preview", async () => {
    const placester = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "placester",
    );
    expect(placester).toEqual(
      expect.objectContaining({
        name: "Placester",
        availability: "preview",
        connectionTypes: [
          "outbound_form_webhook",
          "customer_owned_zapier_webhook",
          "lead_pii_delivery",
          "security_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "placester",
        displayName: "Placester",
        authType: "outbound_form_webhook",
        credentials: {},
        selectedCapabilities: ["placester_integration_review"],
      } as any),
    ).rejects.toThrow(
      "Placester is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes Apartments.com as a non-connectable partner security preview", async () => {
    const apartments = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "apartments-com",
    );
    expect(apartments).toEqual(
      expect.objectContaining({
        name: "Apartments.com",
        availability: "preview",
        connectionTypes: [
          "provider_partnership_required",
          "listing_feed_and_lead_api",
          "renter_application_and_payment_data",
          "security_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "apartments-com",
        displayName: "Apartments.com",
        authType: "provider_partnership_required",
        credentials: {},
        selectedCapabilities: ["apartments_com_integration_review"],
      } as any),
    ).rejects.toThrow(
      "Apartments.com is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes RentRedi as a non-connectable provider-contract security preview", async () => {
    const rentredi = MARKETPLACE_CATALOG.find((app) => app.slug === "rentredi");
    expect(rentredi).toEqual(
      expect.objectContaining({
        name: "RentRedi",
        availability: "preview",
        connectionTypes: [
          "no_public_api",
          "member_account_only",
          "sensitive_rental_and_payment_data",
          "security_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "rentredi",
        displayName: "RentRedi",
        authType: "no_public_api",
        credentials: {},
        selectedCapabilities: ["rentredi_integration_review"],
      } as any),
    ).rejects.toThrow(
      "RentRedi is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes AppFolio as a non-connectable partner-review preview", async () => {
    const appfolio = MARKETPLACE_CATALOG.find((app) => app.slug === "appfolio");
    expect(appfolio).toEqual(
      expect.objectContaining({
        name: "AppFolio",
        availability: "preview",
        connectionTypes: [
          "appfolio_stack_partner_program",
          "provider_application_and_security_review_required",
          "provider_issued_sandbox_and_credentials",
          "production_certification_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "appfolio",
        displayName: "AppFolio",
        authType: "appfolio_stack_partner_program",
        credentials: {},
        selectedCapabilities: ["appfolio_property_management_access"],
      } as any),
    ).rejects.toThrow(
      "AppFolio is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes Propertyware as a non-connectable provider-access preview", async () => {
    const propertyware = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "propertyware",
    );
    expect(propertyware).toEqual(
      expect.objectContaining({
        name: "Propertyware",
        availability: "preview",
        connectionTypes: [
          "enterprise_api_add_on",
          "provider_enabled_account_access",
          "provider_issued_api_contract",
          "customer_portfolio_authorization_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "propertyware",
        displayName: "Propertyware",
        authType: "enterprise_api_add_on",
        credentials: {},
        selectedCapabilities: ["propertyware_property_management_access"],
      } as any),
    ).rejects.toThrow(
      "Propertyware is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  it("publishes Rent Manager as a non-connectable authentication-security preview", async () => {
    const rentManager = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "rent-manager",
    );
    expect(rentManager).toEqual(
      expect.objectContaining({
        name: "Rent Manager",
        availability: "preview",
        connectionTypes: [
          "username_password_token_exchange",
          "user_permission_inheritance",
          "company_subdomain_binding",
          "provider_api_services_enablement_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "rent-manager",
        displayName: "Rent Manager",
        authType: "username_password_token_exchange",
        credentials: {},
        selectedCapabilities: [
          "rent_manager_property_management_access_review",
        ],
      } as any),
    ).rejects.toThrow(
      "Rent Manager is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });
  const originalBetaEnv = captureMarketplaceBetaEnv();

  afterEach(() => {
    restoreMarketplaceBetaEnv(originalBetaEnv);
  });

  it("marks static provider catalogue apps as external providers", () => {
    expect(MARKETPLACE_CATALOG.length).toBeGreaterThanOrEqual(160);
    expect(new Set(MARKETPLACE_CATALOG.map((app) => app.slug)).size).toBe(
      MARKETPLACE_CATALOG.length,
    );
    expect(
      MARKETPLACE_CATALOG.every(
        (app) => app.sourceType === "external_provider",
      ),
    ).toBe(true);
  });

  it("publishes Sling as a non-connectable provider-review preview", async () => {
    const sling = MARKETPLACE_CATALOG.find((app) => app.slug === "sling");

    expect(sling).toEqual(
      expect.objectContaining({
        name: "Sling",
        availability: "preview",
        connectionTypes: ["provider_partnership_required"],
        credentialRequirements: [],
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    );
    expect(sling?.runtimeSupport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          format: "openclaw",
          installSupport: "preview_only",
        }),
        expect.objectContaining({
          format: "hermes",
          installSupport: "preview_only",
        }),
      ]),
    );

    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "sling",
        displayName: "Sling",
        authType: "provider_partnership_required",
        credentials: {},
        selectedCapabilities: ["workforce_read"],
      } as any),
    ).rejects.toThrow(
      "Sling is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Float as a non-connectable hosted-MCP provider-review preview", async () => {
    const float = MARKETPLACE_CATALOG.find((app) => app.slug === "float");

    expect(float).toEqual(
      expect.objectContaining({
        name: "Float",
        availability: "preview",
        connectionTypes: [
          "relay_owned_oauth",
          "remote_mcp",
          "provider_approval_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    );
    expect(float?.runtimeSupport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          format: "openclaw",
          installSupport: "preview_only",
        }),
        expect.objectContaining({
          format: "hermes",
          installSupport: "preview_only",
        }),
      ]),
    );

    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "float",
        displayName: "Float",
        authType: "oauth2",
        credentials: {},
        selectedCapabilities: ["resource_planning_read"],
      } as any),
    ).rejects.toThrow(
      "Float is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Whova as a non-connectable provider-partnership preview", async () => {
    const whova = MARKETPLACE_CATALOG.find((app) => app.slug === "whova");

    expect(whova).toEqual(
      expect.objectContaining({
        name: "Whova",
        availability: "preview",
        connectionTypes: ["provider_partnership_required"],
        credentialRequirements: [],
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    );
    expect(whova?.runtimeSupport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          format: "openclaw",
          installSupport: "preview_only",
        }),
        expect.objectContaining({
          format: "hermes",
          installSupport: "preview_only",
        }),
      ]),
    );

    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "whova",
        displayName: "Whova",
        authType: "provider_partnership_required",
        credentials: {},
        selectedCapabilities: ["event_platform_access"],
      } as any),
    ).rejects.toThrow(
      "Whova is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Universe as a non-connectable durable-OAuth review preview", async () => {
    const universe = MARKETPLACE_CATALOG.find((app) => app.slug === "universe");
    expect(universe).toEqual(
      expect.objectContaining({
        name: "Universe",
        availability: "preview",
        connectionTypes: [
          "relay_owned_oauth",
          "provider_approval_required",
          "fixed_universe_authority",
        ],
        credentialRequirements: [],
        allowedActions: [],
        approvalRequiredActions: [],
      }),
    );
    expect(universe?.runtimeSupport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          format: "openclaw",
          installSupport: "preview_only",
        }),
        expect.objectContaining({
          format: "hermes",
          installSupport: "preview_only",
        }),
      ]),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "universe",
        displayName: "Universe",
        authType: "relay_owned_oauth",
        credentials: {},
        selectedCapabilities: ["event_platform_access"],
      } as any),
    ).rejects.toThrow(
      "Universe is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Ticketbud as a non-connectable query-token security preview", async () => {
    const ticketbud = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "ticketbud",
    );
    expect(ticketbud).toEqual(
      expect.objectContaining({
        name: "Ticketbud",
        availability: "preview",
        connectionTypes: [
          "legacy_query_token_oauth_beta",
          "security_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "ticketbud",
        displayName: "Ticketbud",
        authType: "legacy_query_token_oauth_beta",
        credentials: {},
        selectedCapabilities: ["ticketing_access"],
      } as any),
    ).rejects.toThrow(
      "Ticketbud is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes EventCreate as a non-connectable provider-partnership preview", async () => {
    const eventcreate = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "eventcreate",
    );
    expect(eventcreate).toEqual(
      expect.objectContaining({
        name: "EventCreate",
        availability: "preview",
        connectionTypes: ["provider_partnership_required"],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "eventcreate",
        displayName: "EventCreate",
        authType: "provider_partnership_required",
        credentials: {},
        selectedCapabilities: ["event_platform_access"],
      } as any),
    ).rejects.toThrow(
      "EventCreate is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Eventdex as a non-connectable provider-partnership preview", async () => {
    const eventdex = MARKETPLACE_CATALOG.find((app) => app.slug === "eventdex");
    expect(eventdex).toEqual(
      expect.objectContaining({
        name: "Eventdex",
        availability: "preview",
        connectionTypes: ["provider_partnership_required"],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "eventdex",
        displayName: "Eventdex",
        authType: "provider_partnership_required",
        credentials: {},
        selectedCapabilities: ["event_platform_access"],
      } as any),
    ).rejects.toThrow(
      "Eventdex is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Classy as a non-connectable provider-access preview", async () => {
    const classy = MARKETPLACE_CATALOG.find((app) => app.slug === "classy");
    expect(classy).toEqual(
      expect.objectContaining({
        name: "Classy",
        availability: "preview",
        connectionTypes: [
          "provider_developer_access_required",
          "oauth_application_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "classy",
        displayName: "Classy",
        authType: "provider_developer_access_required",
        credentials: {},
        selectedCapabilities: ["fundraising_access"],
      } as any),
    ).rejects.toThrow(
      "Classy is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Bloomerang as a non-connectable OAuth security preview", async () => {
    const bloomerang = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "bloomerang",
    );
    expect(bloomerang).toEqual(
      expect.objectContaining({
        name: "Bloomerang",
        availability: "preview",
        connectionTypes: [
          "provider_oauth_registration_required",
          "private_key_rejected",
          "security_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "bloomerang",
        displayName: "Bloomerang",
        authType: "provider_oauth_registration_required",
        credentials: {},
        selectedCapabilities: ["fundraising_crm_access"],
      } as any),
    ).rejects.toThrow(
      "Bloomerang is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Blackbaud Raiser's Edge NXT as a non-connectable SKY setup preview", async () => {
    const blackbaud = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "blackbaud-raisers-edge-nxt",
    );
    expect(blackbaud).toEqual(
      expect.objectContaining({
        name: "Blackbaud Raiser's Edge NXT",
        availability: "preview",
        connectionTypes: [
          "sky_application_required",
          "approved_subscription_key_required",
          "provider_distribution_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "blackbaud-raisers-edge-nxt",
        displayName: "Blackbaud Raiser's Edge NXT",
        authType: "sky_application_required",
        credentials: {},
        selectedCapabilities: ["fundraising_crm_access"],
      } as any),
    ).rejects.toThrow(
      "Blackbaud Raiser's Edge NXT is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Shortcuts App as a non-connectable local-bridge security preview", async () => {
    const shortcuts = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "shortcuts-app",
    );
    expect(shortcuts).toEqual(
      expect.objectContaining({
        name: "Shortcuts App",
        availability: "preview",
        connectionTypes: [
          "mac_local_only",
          "local_runtime_bridge_required",
          "immutable_shortcut_binding_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "shortcuts-app",
        displayName: "Shortcuts App",
        authType: "mac_local_only",
        credentials: {},
        selectedCapabilities: ["local_shortcut_execution"],
      } as any),
    ).rejects.toThrow(
      "Shortcuts App is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Apple Automator as a non-connectable local-bridge security preview", async () => {
    const automator = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "apple-automator",
    );
    expect(automator).toEqual(
      expect.objectContaining({
        name: "Apple Automator",
        availability: "preview",
        connectionTypes: [
          "mac_local_only",
          "local_runtime_bridge_required",
          "immutable_workflow_binding_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "apple-automator",
        displayName: "Apple Automator",
        authType: "mac_local_only",
        credentials: {},
        selectedCapabilities: ["local_workflow_execution"],
      } as any),
    ).rejects.toThrow(
      "Apple Automator is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes LaunchBar as a non-connectable local-bridge security preview", async () => {
    const launchbar = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "launchbar",
    );
    expect(launchbar).toEqual(
      expect.objectContaining({
        name: "LaunchBar",
        availability: "preview",
        connectionTypes: [
          "mac_local_only",
          "local_runtime_bridge_required",
          "immutable_action_bundle_binding_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "launchbar",
        displayName: "LaunchBar",
        authType: "mac_local_only",
        credentials: {},
        selectedCapabilities: ["local_action_execution"],
      } as any),
    ).rejects.toThrow(
      "LaunchBar is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Bartender as a non-connectable supported-interface preview", async () => {
    const bartender = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "bartender",
    );
    expect(bartender).toEqual(
      expect.objectContaining({
        name: "Bartender",
        availability: "preview",
        connectionTypes: [
          "mac_local_only",
          "supported_external_api_unavailable",
          "screen_recording_and_accessibility_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "bartender",
        displayName: "Bartender",
        authType: "mac_local_only",
        credentials: {},
        selectedCapabilities: ["menu_bar_management"],
      } as any),
    ).rejects.toThrow(
      "Bartender is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Moom as a non-connectable AppleScript security preview", async () => {
    const moom = MARKETPLACE_CATALOG.find((app) => app.slug === "moom");
    expect(moom).toEqual(
      expect.objectContaining({
        name: "Moom",
        availability: "preview",
        connectionTypes: [
          "mac_local_only",
          "applescript_supported",
          "local_runtime_bridge_required",
          "immutable_layout_binding_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "moom",
        displayName: "Moom",
        authType: "mac_local_only",
        credentials: {},
        selectedCapabilities: ["window_layout_automation"],
      } as any),
    ).rejects.toThrow(
      "Moom is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Airtable OAuth Client Per Workspace as a non-connectable canonical-provider alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "airtable-oauth-client-per-workspace",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Airtable OAuth Client Per Workspace",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_airtable",
          "workspace_resource_grant_supported",
          "customer_owned_oauth_client_unsupported",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "airtable-oauth-client-per-workspace",
        displayName: "Airtable OAuth Client Per Workspace",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["airtable_workspace_resource_grant_setup"],
      } as any),
    ).rejects.toThrow(
      "Airtable OAuth Client Per Workspace is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Slack Enterprise Custom App as a non-connectable canonical-provider extension alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "slack-enterprise-custom-app",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Slack Enterprise Custom App",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_slack",
          "customer_owned_custom_app_unsupported",
          "enterprise_org_install_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "slack-enterprise-custom-app",
        displayName: "Slack Enterprise Custom App",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["slack_enterprise_installation_setup"],
      } as any),
    ).rejects.toThrow(
      "Slack Enterprise Custom App is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Google Workspace Domain-Wide Delegation as a non-connectable provider-family security alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "google-workspace-domain-wide-delegation",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Google Workspace Domain-Wide Delegation",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_family_alias",
          "canonical_google_workspace_connectors",
          "super_admin_authorization_required",
          "service_account_key_capture_rejected",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "google-workspace-domain-wide-delegation",
        displayName: "Google Workspace Domain-Wide Delegation",
        authType: "canonical_provider_family_alias",
        credentials: {},
        selectedCapabilities: ["google_workspace_delegated_setup"],
      } as any),
    ).rejects.toThrow(
      "Google Workspace Domain-Wide Delegation is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Microsoft Azure App Registration as a non-connectable provider-family security alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "microsoft-azure-app-registration",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Microsoft Azure App Registration",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_family_alias",
          "canonical_microsoft_connectors",
          "tenant_app_registration_review_required",
          "customer_owned_credentials_unsupported",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "microsoft-azure-app-registration",
        displayName: "Microsoft Azure App Registration",
        authType: "canonical_provider_family_alias",
        credentials: {},
        selectedCapabilities: ["microsoft_entra_app_setup"],
      } as any),
    ).rejects.toThrow(
      "Microsoft Azure App Registration is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Zoom Server-to-Server OAuth as a non-connectable canonical-provider extension alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "zoom-server-to-server-oauth",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Zoom Server-to-Server OAuth",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_zoom",
          "account_level_server_to_server_oauth",
          "customer_owned_credentials_unsupported",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "zoom-server-to-server-oauth",
        displayName: "Zoom Server-to-Server OAuth",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["zoom_account_level_automation_setup"],
      } as any),
    ).rejects.toThrow(
      "Zoom Server-to-Server OAuth is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Salesforce Connected App Per Org as a non-connectable canonical-provider extension alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "salesforce-connected-app-per-org",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Salesforce Connected App Per Org",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_salesforce",
          "per_org_connected_app_unsupported",
          "packaged_external_client_app_preferred",
          "customer_owned_credentials_unsupported",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "salesforce-connected-app-per-org",
        displayName: "Salesforce Connected App Per Org",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["salesforce_org_oauth_setup"],
      } as any),
    ).rejects.toThrow(
      "Salesforce Connected App Per Org is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes HubSpot Private App as a non-connectable canonical-provider extension alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "hubspot-private-app",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "HubSpot Private App",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_hubspot",
          "single_account_static_auth",
          "customer_owned_static_token_unsupported",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "hubspot-private-app",
        displayName: "HubSpot Private App",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["hubspot_private_app_setup"],
      } as any),
    ).rejects.toThrow(
      "HubSpot Private App is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Shopify Custom App as a non-connectable canonical-provider extension alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "shopify-custom-app",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Shopify Custom App",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_shopify",
          "single_store_custom_distribution",
          "customer_owned_credentials_unsupported",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "shopify-custom-app",
        displayName: "Shopify Custom App",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["shopify_custom_app_setup"],
      } as any),
    ).rejects.toThrow(
      "Shopify Custom App is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes BigCommerce Store API Account as a non-connectable canonical-provider extension alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "bigcommerce-store-api-account",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "BigCommerce Store API Account",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_bigcommerce",
          "single_store_static_api_account",
          "customer_owned_credentials_unsupported",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "bigcommerce-store-api-account",
        displayName: "BigCommerce Store API Account",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["bigcommerce_store_api_setup"],
      } as any),
    ).rejects.toThrow(
      "BigCommerce Store API Account is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Square Sandbox App as a non-connectable provider-family security alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "square-sandbox-app",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Square Sandbox App",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_family_alias",
          "canonical_square_connectors",
          "sandbox_environment_isolation",
          "sandbox_credentials_unsupported",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "square-sandbox-app",
        displayName: "Square Sandbox App",
        authType: "canonical_provider_family_alias",
        credentials: {},
        selectedCapabilities: ["square_sandbox_testing_setup"],
      } as any),
    ).rejects.toThrow(
      "Square Sandbox App is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Stripe Connect Platform Account as a non-connectable financial-control alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "stripe-connect-platform-account",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Stripe Connect Platform Account",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_stripe",
          "connect_platform_financial_control",
          "customer_owned_platform_credentials_unsupported",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "stripe-connect-platform-account",
        displayName: "Stripe Connect Platform Account",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["stripe_connect_platform_setup"],
      } as any),
    ).rejects.toThrow(
      "Stripe Connect Platform Account is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes PayPal Partner App as a non-connectable financial-control alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "paypal-partner-app",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "PayPal Partner App",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_paypal",
          "partner_multiparty_financial_control",
          "paypal_live_partner_approval_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "paypal-partner-app",
        displayName: "PayPal Partner App",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["paypal_partner_platform_setup"],
      } as any),
    ).rejects.toThrow(
      "PayPal Partner App is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Xero Custom Connection as a non-connectable accounting identity alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "xero-custom-connection",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Xero Custom Connection",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_xero",
          "single_organisation_client_credentials",
          "premium_regional_subscription_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "xero-custom-connection",
        displayName: "Xero Custom Connection",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["xero_custom_connection_setup"],
      } as any),
    ).rejects.toThrow(
      "Xero Custom Connection is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes QuickBooks App Per Company as a non-connectable accounting identity alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "quickbooks-app-per-company",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "QuickBooks App Per Company",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_quickbooks",
          "exact_company_realm_binding",
          "dedicated_per_company_app_unsupported",
          "relay_owned_oauth_app_preferred",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "quickbooks-app-per-company",
        displayName: "QuickBooks App Per Company",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["quickbooks_per_company_app_setup"],
      } as any),
    ).rejects.toThrow(
      "QuickBooks App Per Company is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Zoho Client Portal App as a non-connectable external-user surface alias", async () => {
    const alias = MARKETPLACE_CATALOG.find(
      (app) => app.slug === "zoho-client-portal-app",
    );
    expect(alias).toEqual(
      expect.objectContaining({
        name: "Zoho Client Portal App",
        availability: "preview",
        connectionTypes: [
          "canonical_provider_alias",
          "canonical_slug_zoho",
          "client_portal_external_user_surface",
          "portal_administration_and_identity_control",
          "portal_runtime_unsupported",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "zoho-client-portal-app",
        displayName: "Zoho Client Portal App",
        authType: "canonical_provider_alias",
        credentials: {},
        selectedCapabilities: ["zoho_client_portal_setup"],
      } as any),
    ).rejects.toThrow(
      "Zoho Client Portal App is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes Sched as a non-connectable query-key security preview", async () => {
    const sched = MARKETPLACE_CATALOG.find((app) => app.slug === "sched");
    expect(sched).toEqual(
      expect.objectContaining({
        name: "Sched",
        availability: "preview",
        connectionTypes: [
          "legacy_query_api_key",
          "event_scoped_key",
          "security_review_required",
        ],
        credentialRequirements: [],
        allowedActions: [],
      }),
    );
    const service = createMarketplaceService();
    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "sched",
        displayName: "Sched",
        authType: "legacy_query_api_key",
        credentials: {},
        selectedCapabilities: ["schedule_access"],
      } as any),
    ).rejects.toThrow(
      "Sched is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.",
    );
  });

  it("publishes only the bounded launch catalog while retaining an emergency blocklist", async () => {
    process.env.CLAWCHAT_MARKETPLACE_BETA_MODE = "true";
    process.env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS = "ab-tasty, planhat, runn";
    process.env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS = "x";
    const linkedApplicationRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = createMarketplaceService({ linkedApplicationRepo });

    const catalog = await service.listCatalog("workspace-1");
    const slugs = catalog.apps.map((app) => app.slug);
    const planhat = catalog.apps.find((app) => app.slug === "planhat");

    expect(slugs).toContain("ab-tasty");
    expect(slugs).toContain("planhat");
    expect(slugs).toContain("runn");
    expect(slugs).not.toContain("x");
    expect(slugs).not.toContain("birdeye");
    expect(slugs).toHaveLength(406);
    expect(planhat?.sourceMetadata?.marketplaceBetaGate).toEqual(
      expect.objectContaining({
        betaMode: true,
        available: true,
        reason: "allowed",
        hiddenFromCatalog: false,
      }),
    );
    expect(catalog.releaseManifest).toEqual(
      expect.objectContaining({
        schemaVersion: "relay.marketplace-release.v1",
        freezeStatus: "frozen",
      }),
    );
  });

  it("keeps the bounded launch catalog visible when beta mode has no allowlist", async () => {
    process.env.CLAWCHAT_MARKETPLACE_BETA_MODE = "true";
    delete process.env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS;
    delete process.env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS;
    const linkedApplicationRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = createMarketplaceService({ linkedApplicationRepo });

    const catalog = await service.listCatalog("workspace-1");
    const detail = await service.getApp("workspace-1", "github");

    expect(catalog.apps).toHaveLength(406);
    expect(detail.sourceMetadata?.marketplaceBetaGate).toEqual(
      expect.objectContaining({
        betaMode: true,
        available: true,
        reason: "allowed",
        hiddenFromCatalog: false,
      }),
    );
  });

  it("paginates searchable lightweight catalog summaries with opaque cursors", async () => {
    process.env.CLAWCHAT_MARKETPLACE_BETA_MODE = "true";
    delete process.env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS;
    delete process.env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS;
    const service = createMarketplaceService({
      linkedApplicationRepo: { find: jest.fn().mockResolvedValue([]) },
    });

    const first = await service.listCatalogPage("workspace-1", {
      query: "google",
      limit: 2,
    });

    expect(first.apps).toHaveLength(2);
    expect(first.pageInfo).toEqual(
      expect.objectContaining({
        limit: 2,
        hasNextPage: true,
        nextCursor: expect.any(String),
      }),
    );
    expect(
      first.apps.every((app) =>
        `${app.name} ${app.slug} ${app.description}`
          .toLowerCase()
          .includes("google"),
      ),
    ).toBe(true);
    expect(first.apps[0]).toEqual(
      expect.objectContaining({
        capabilities: [],
        allowedActions: [],
        runtimeSupport: [],
      }),
    );
    expect(first.apps[0].sourceMetadata).toBeUndefined();

    const second = await service.listCatalogPage("workspace-1", {
      query: "google",
      limit: 2,
      cursor: first.pageInfo.nextCursor,
    });
    expect(second.apps.length).toBeGreaterThan(0);
    expect(second.apps.length).toBeLessThanOrEqual(2);
    expect(second.apps.map((app) => app.slug)).not.toEqual(
      first.apps.map((app) => app.slug),
    );
  });

  it("rejects malformed marketplace catalog cursors", async () => {
    const service = createMarketplaceService({
      linkedApplicationRepo: { find: jest.fn().mockResolvedValue([]) },
    });
    await expect(
      service.listCatalogPage("workspace-1", {
        cursor: "not-a-cursor",
      }),
    ).rejects.toThrow("Marketplace catalog cursor is invalid");
  });

  it("returns beta-unavailable metadata for blocked static provider details", async () => {
    process.env.CLAWCHAT_MARKETPLACE_BETA_MODE = "true";
    process.env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS = "github, x";
    process.env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS = "x";
    const service = createMarketplaceService();

    const detail = await service.getApp("workspace-1", "x");

    expect(detail.slug).toBe("x");
    expect(detail.sourceMetadata?.marketplaceBetaGate).toEqual(
      expect.objectContaining({
        betaMode: true,
        available: false,
        reason: "blocked_for_beta",
        hiddenFromCatalog: false,
        message: "This app has been temporarily disabled by Relay.",
      }),
    );
  });

  it("supports a global Marketplace execution kill switch", async () => {
    process.env.CLAWCHAT_MARKETPLACE_KILL_SWITCH = "true";
    const linkedApplicationRepo = { find: jest.fn().mockResolvedValue([]) };
    const service = createMarketplaceService({ linkedApplicationRepo });
    const catalog = await service.listCatalog("workspace-1");
    const app = catalog.apps.find((entry) => entry.slug === "planhat");
    expect(app?.sourceMetadata?.marketplaceBetaGate).toEqual(
      expect.objectContaining({
        available: false,
        reason: "global_kill_switch",
        message: "This app has been temporarily disabled by Relay.",
      }),
    );
  });

  it("blocks direct connection creation for beta-unavailable static provider apps", async () => {
    process.env.CLAWCHAT_MARKETPLACE_BETA_MODE = "true";
    process.env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS = "github, x";
    process.env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS = "x";
    const service = createMarketplaceService();

    await expect(
      service.createConnection("workspace-1", "user-1", {
        appSlug: "x",
        displayName: "Blocked X",
        authType: "oauth2_pkce_user",
        credentials: {},
        selectedCapabilities: ["read"],
      } as any),
    ).rejects.toThrow("This app has been temporarily disabled by Relay.");
  });

  it("blocks direct install and pack preview for beta-unavailable static provider apps", async () => {
    process.env.CLAWCHAT_MARKETPLACE_BETA_MODE = "true";
    process.env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS = "github, x";
    process.env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS = "x";
    const service = createMarketplaceService();

    await expect(
      service.install("workspace-1", "user-1", {
        appSlug: "x",
        runtimeFormat: "openclaw",
        agentIds: ["agent-1"],
      } as any),
    ).rejects.toThrow("This app has been temporarily disabled by Relay.");
    await expect(
      service.previewPack("workspace-1", "user-1", {
        appSlug: "x",
        runtimeFormat: "openclaw",
      } as any),
    ).rejects.toThrow("This app has been temporarily disabled by Relay.");
    await expect(
      service.updatePack("workspace-1", "x", "user-1"),
    ).rejects.toThrow("This app has been temporarily disabled by Relay.");
  });

  it("projects linked local repo apps into Marketplace app definitions", () => {
    const service = createMarketplaceService();
    const linked = {
      id: "linked-1",
      workspaceId: "workspace-1",
      name: "Local Billing App",
      slug: "local-billing-app",
      repoPath: "/apps/billing",
      currentGitCommit: "abc123",
      dirtyState: false,
      lastScannedAt: new Date("2026-05-08T00:00:00.000Z"),
      documentationPackStatus: "pending_review",
      agentOperableStatus: "pending_scan",
      frameworkMetadata: { sourceType: "local_repo" },
      apiStyleMetadata: {},
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/",
        sourceHostType: "hermes_bridge",
        sourceHostId: "bridge-1",
        sourceHostLabel: "Test Hermes host",
        localApiUrl: "http://local-app.test/api",
        sourceHash: "hash-1",
      },
    } as unknown as LinkedApplicationEntity;

    const app = (service as any).localLinkedApplicationToMarketplaceApp(linked);

    expect(app.slug).toBe("local-billing-app");
    expect(app.sourceType).toBe("local_repo");
    expect(app.connectionTypes).toEqual(["local_repo"]);
    expect(app.sourceMetadata.repoPath).toBe("/apps/billing");
    expect(app.sourceMetadata.docsSourcePath).toBe(".clawchat/");
    expect(app.sourceMetadata.sourceHostType).toBe("hermes_bridge");
    expect(app.sourceMetadata.sourceHostLabel).toBe("Test Hermes host");
    expect(app.packQuality.publicationStatus).toBe("review_needed");
  });

  it("requires an online server-issued source host with repository-read capability", async () => {
    const listMarketplaceLocalRepoSourceHosts = jest.fn().mockResolvedValue([
      {
        id: "offline-host",
        type: "hermes_bridge",
        label: "Offline Hermes",
        status: "offline",
        supportsLocalRepoDocsRead: true,
      },
      {
        id: "incapable-host",
        type: "openclaw_bridge",
        label: "Old OpenClaw",
        status: "available",
        supportsLocalRepoDocsRead: false,
      },
      {
        id: "capable-host",
        type: "hermes_bridge",
        label: "Ready Hermes",
        status: "available",
        supportsLocalRepoDocsRead: true,
        bridgeDeviceId: "capable-host",
        runtimeType: "hermes",
      },
    ]);
    const service = createMarketplaceServiceWithBridge({
      listMarketplaceLocalRepoSourceHosts,
    });

    for (const sourceHostId of ["offline-host", "incapable-host"]) {
      await expect(
        (service as any).resolveLocalRepoSourceHost("workspace-1", {
          sourceHostType: "hermes_bridge",
          sourceHostId,
        }),
      ).rejects.toThrow(/online paired runtime/);
    }
    await expect(
      (service as any).resolveLocalRepoSourceHost("workspace-1", {
        sourceHostType: "hermes_bridge",
        sourceHostId: "capable-host",
      }),
    ).resolves.toMatchObject({
      sourceHostType: "hermes_bridge",
      sourceHostId: "capable-host",
      bridgeDeviceId: "capable-host",
    });
  });
});

describe("Marketplace local repo .clawchat ingestion", () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(join(tmpdir(), "clawchat-local-repo-"));
    await mkdir(join(repoPath, ".clawchat", "api"), { recursive: true });
    await mkdir(join(repoPath, ".clawchat", "agent-docs-source", "workflows"), {
      recursive: true,
    });
    await mkdir(
      join(repoPath, ".clawchat", "auditor-docs-source", "workflows"),
      {
        recursive: true,
      },
    );
    await writeFile(
      join(repoPath, ".clawchat", "app_manifest.json"),
      JSON.stringify(
        {
          name: "GapMiner",
          slug: "gapminer",
          description:
            "Finds content and affiliate opportunities from topic families.",
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(repoPath, ".clawchat", "clawchat.config.json"),
      JSON.stringify(
        {
          docsSourcePath: ".clawchat/",
          auth: {
            header: "x-openclaw-secret",
            envName: "OPENCLAW_WEBHOOK_SECRET",
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(repoPath, ".clawchat", "api", "openapi.json"),
      JSON.stringify(
        {
          openapi: "3.1.0",
          info: { title: "GapMiner OpenClaw API", version: "1.0.0" },
          paths: {
            "/api/openclaw/topic-families": {
              get: { summary: "List topic families", tags: ["topic families"] },
              post: {
                summary: "Create a seed topic family",
                tags: ["topic families"],
              },
            },
            "/api/openclaw/opportunities": {
              get: { summary: "List opportunities", tags: ["opportunities"] },
            },
            "/api/openclaw/agent-runs/{id}": {
              get: { summary: "Read an agent run", tags: ["agent runs"] },
            },
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(repoPath, ".clawchat", "api", "endpoints.md"),
      [
        "# GapMiner Endpoints",
        "",
        "Convex HTTP routes are defined in `convex/http.ts`.",
        "",
        "- GET /api/openclaw/topic-families",
        "- POST /api/openclaw/topic-families",
        "- GET /api/openclaw/opportunities",
        "- GET /api/openclaw/agent-runs/{id}",
      ].join("\n"),
    );
    await writeFile(
      join(repoPath, ".clawchat", "agent-docs-source", "workflow.md"),
      [
        "# GapMiner Workflow",
        "",
        "Use GapMiner to inspect topic families, seed topics, seed-topic context, opportunities, evidence sources, SERP findings, affiliate programs, monetization fits, commercial narratives, agent runs, websites, page plans, keyword strategy clusters and mappings, and build handoffs.",
      ].join("\n"),
    );
    await writeFile(
      join(repoPath, ".clawchat", "agent-docs-source", "auth.md"),
      [
        "# GapMiner Auth",
        "",
        "OpenClaw routes accept `x-openclaw-secret` or Authorization Bearer auth. The environment variable name is OPENCLAW_WEBHOOK_SECRET.",
        "x-openclaw-secret: super-secret-test-value",
        "Authorization: Bearer super-secret-bearer-token",
      ].join("\n"),
    );
    await writeFile(
      join(repoPath, ".clawchat", "agent-docs-source", "permissions.md"),
      "# GapMiner Permissions\n\nRead topic families and opportunities by default. Writes require approval.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "agent-docs-source", "safe_actions.md"),
      "# GapMiner Safe Actions\n\nDo not publish generated websites, replace page plans, or trigger destructive agent runs without approval.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "agent-docs-source", "api.md"),
      "# GapMiner API\n\nUse `/api/openclaw/*` routes for agent-operable access.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "agent-docs-source", "data_model.md"),
      "# GapMiner Data Model\n\nCore records include topic families, seed topics, opportunities, evidence sources, websites, page plans, keyword clusters, and build handoffs.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "agent-docs-source", "jobs_and_workers.md"),
      "# GapMiner Jobs And Workers\n\nAgent runs perform SERP research and opportunity scoring.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "agent-docs-source", "local_runtime.md"),
      "# GapMiner Local Runtime\n\nRun the local application using its repo-defined start command.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "agent-docs-source", "troubleshooting.md"),
      "# GapMiner Troubleshooting\n\nCheck Convex HTTP route registration and auth headers first.",
    );
    await writeFile(
      join(
        repoPath,
        ".clawchat",
        "agent-docs-source",
        "workflows",
        "research_opportunity.md",
      ),
      "# Research Opportunity\n\nRead topic family context, inspect SERP findings, then draft monetization fit notes.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "auditor-docs-source", "SOUL.md"),
      "# SOUL.md\n\nAudit GapMiner work independently and challenge unsupported claims.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "auditor-docs-source", "IDENTITY.md"),
      "# IDENTITY.md\n\nGapMinerAuditor independently reviews GapMiner outputs and does not take direction from the worker agent.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "auditor-docs-source", "APP_CONTEXT.md"),
      "# APP_CONTEXT.md\n\nGapMiner status fields are partial signals. Inspect actual page brief and handoff content before judging quality.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "auditor-docs-source", "REVIEW_RULES.md"),
      "# REVIEW_RULES.md\n\nSeparate direct observations from strong inference, weak inference, and unresolved blind spots.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "auditor-docs-source", "OUTPUT_FORMAT.md"),
      "# OUTPUT_FORMAT.md\n\nReport verdict, key issues, operator prompt, and next audit target.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "auditor-docs-source", "WRITEBACK.md"),
      "# WRITEBACK.md\n\nWrite audit findings to agent-runs only when writeback is explicitly requested.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "auditor-docs-source", "TRACKER.md"),
      "# TRACKER.md\n\nTrack reviewed websites, page plans, build handoffs, and re-review triggers.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "auditor-docs-source", "WORKFLOW.md"),
      "# WORKFLOW.md\n\nAudit research, planning, page brief, and build handoff workflows independently.",
    );
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it("uses explicit local runtime lifecycle commands before generic commands", () => {
    const service = createMarketplaceService();
    const lifecycle = (
      service as any
    ).extractLifecycleMetadataFromClawchatConfig({
      localRuntime: {
        checkCommand: "curl -fsS http://localhost:3052 >/dev/null",
        startCommand: "pnpm dev",
        allowRuntimeHostStart: true,
        requiresApprovalToStart: true,
        approvalPolicy: "approval_required_for_start_or_restart",
      },
      commands: {
        check: "pnpm typecheck",
        start: "pnpm start",
      },
    });

    expect(lifecycle).toEqual(
      expect.objectContaining({
        checkCommand: "curl -fsS http://localhost:3052 >/dev/null",
        startCommand: "pnpm dev",
        allowRuntimeHostStart: true,
        requiresApprovalToStart: true,
        approvalPolicy: "approval_required_for_start_or_restart",
      }),
    );
  });

  it("prefers repo-supplied .clawchat source files over generic generated fallback", async () => {
    const service = createMarketplaceService();
    const linked = {
      id: "linked-gapminer",
      workspaceId: "workspace-1",
      name: "GapMiner",
      slug: "local-gapminer",
      repoPath,
      frameworkMetadata: { sourceType: "local_repo" },
      apiStyleMetadata: {},
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/",
        sourceHostType: "hermes_bridge",
        sourceHostId: "bridge-1",
        sourceHostLabel: "Test Hermes host",
      },
    } as unknown as LinkedApplicationEntity;
    const app = (service as any).localLinkedApplicationToMarketplaceApp(linked);
    const discovery = await (service as any).discoverLocalRepoSource(linked);
    const sourceModel = await (service as any).importLocalRepoSourceModel(
      app,
      discovery,
    );
    const sourceNotes = discovery.files
      .filter((file: { relativePath: string }) =>
        file.relativePath.endsWith(".md"),
      )
      .map(
        (file: { relativePath: string; content: string }) =>
          `# ${file.relativePath}\n\n${file.content}`,
      );
    const config: MarketplacePackFactoryConfig = {
      appSlug: app.slug,
      name: app.name,
      category: app.category,
      riskLevel: app.riskLevel,
      providerUrl: "",
      docs: {
        openApiSpec: discovery.openApiSpecPath,
      },
      authTypes: ["local_repo"],
      knownObjects: sourceModel.objects,
      highRiskActions: [
        "write API calls",
        "publishing/deployment",
        "destructive data changes",
        "permission or configuration changes",
      ],
      commonWorkflows: sourceModel.workflowSignals,
      manuallySuppliedNotes: [
        `Local repo path: ${linked.repoPath}`,
        `Docs source path: ${discovery.docsSourcePath}`,
        ...sourceNotes,
      ],
      importedSourceModel: sourceModel,
      existingApp: app,
    };
    const generated = generateDraftPackFromConfig(config);
    generated.canonicalSources = {
      ...generated.canonicalSources,
      ...(service as any).buildLocalRepoCanonicalSources(discovery),
    };
    generated.roleManifest = discovery.roleManifest;
    (service as any).applyLocalRepoQualitySignals(generated, discovery);

    expect(
      discovery.files.map(
        (file: { relativePath: string }) => file.relativePath,
      ),
    ).toEqual(
      expect.arrayContaining([
        "app_manifest.json",
        "clawchat.config.json",
        "api/openapi.json",
        "api/endpoints.md",
        "agent-docs-source/workflow.md",
        "agent-docs-source/auth.md",
        "agent-docs-source/workflows/research_opportunity.md",
        "auditor-docs-source/IDENTITY.md",
        "auditor-docs-source/REVIEW_RULES.md",
        "auditor-docs-source/WORKFLOW.md",
      ]),
    );
    expect(discovery.auditorDocsAvailable).toBe(true);
    expect(discovery.auditorFileCount).toBeGreaterThanOrEqual(7);
    expect(generated.canonicalSources["workflow.md"]).toContain(
      "topic families",
    );
    expect(generated.canonicalSources["auditor/IDENTITY.md"]).toContain(
      "GapMinerAuditor",
    );
    expect(generated.canonicalSources["auditor/REVIEW_RULES.md"]).toContain(
      "direct observations",
    );
    expect(generated.canonicalSources["workflow.md"]).toContain(
      "seed-topic context",
    );
    expect(generated.canonicalSources["workflow.md"]).toContain(
      "commercial narratives",
    );
    expect(generated.canonicalSources["api/endpoints.md"]).toContain(
      "convex/http.ts",
    );
    expect(generated.canonicalSources["api/endpoints.md"]).toContain(
      "/api/openclaw/topic-families",
    );
    expect(generated.canonicalSources["api/endpoints.md"]).not.toContain(
      "Generated Endpoint Families",
    );
    expect(generated.canonicalSources["api/endpoints.md"]).not.toContain(
      "GET /local",
    );
    expect(generated.canonicalSources["api/endpoints.md"]).not.toContain(
      "POST /repo",
    );
    expect(generated.canonicalSources["auth.md"]).toContain(
      "OPENCLAW_WEBHOOK_SECRET",
    );
    expect(generated.canonicalSources["auth.md"]).toContain(
      "x-openclaw-secret: [REDACTED]",
    );
    expect(generated.canonicalSources["auth.md"]).toContain(
      "Authorization: Bearer [REDACTED]",
    );
    expect(generated.canonicalSources["auth.md"]).not.toContain(
      "super-secret-test-value",
    );
    expect(generated.canonicalSources["auth.md"]).not.toContain(
      "super-secret-bearer-token",
    );
    expect(
      generated.sources.every(
        (source) =>
          source.kind === "local_repo_docs" ||
          source.kind === "local_repo_manifest" ||
          source.kind === "openapi_spec",
      ),
    ).toBe(true);
    expect(generated.quality.confidence).toBe("medium");
    expect(generated.extractedSourceModel?.coverage.officialSources).toBe(
      false,
    );

    const selectedCapabilities = app.capabilities
      .filter(
        (capability: { defaultEnabled: boolean }) => capability.defaultEnabled,
      )
      .map((capability: { id: string }) => capability.id);
    const appWithRoles = { ...app, roleManifest: discovery.roleManifest };
    const openclaw = compileGeneratedMarketplacePack({
      app: appWithRoles,
      pack: generated,
      runtimeFormat: "openclaw",
      selectedCapabilities,
      connection: null,
      libraryTargetFolder: `marketplace/${app.slug}`,
    });
    const hermes = compileGeneratedMarketplacePack({
      app: appWithRoles,
      pack: generated,
      runtimeFormat: "hermes",
      selectedCapabilities,
      connection: null,
      libraryTargetFolder: `marketplace/${app.slug}`,
    });
    const compiledContent = [...openclaw.files, ...hermes.files]
      .map((file) => file.content)
      .join("\n");

    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/data_model.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/roles_manifest.json"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("workspace_files/auditor/AGENTS.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("workspace_files/auditor/WORKFLOW.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/auditor/SOUL.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/auditor/IDENTITY.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/auditor/APP_CONTEXT.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/auditor/REVIEW_RULES.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/auditor/OUTPUT_FORMAT.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/auditor/WRITEBACK.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/auditor/TRACKER.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/auditor/WORKFLOW.md"),
      ),
    ).toBe(true);
    expect(openclaw.metadata.auditorDocsAvailable).toBe(true);
    expect(openclaw.metadata.auditorFileCount).toBeGreaterThanOrEqual(7);
    expect(
      hermes.files.some((file) =>
        file.relativePath.includes("references/local_repo/data_model.md"),
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-router/references/roles_manifest.json`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath === `skills/${app.slug}-auditor-router/SKILL.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-auditor-router/references/roles_manifest.json`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-auditor-router/references/SOUL.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-auditor-router/references/IDENTITY.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-auditor-router/references/APP_CONTEXT.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-auditor-router/references/REVIEW_RULES.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-auditor-router/references/OUTPUT_FORMAT.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-auditor-router/references/WRITEBACK.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-auditor-router/references/TRACKER.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-auditor-router/references/WORKFLOW.md`,
      ),
    ).toBe(true);
    expect(compiledContent).toContain("topic families");
    expect(compiledContent).toContain("/api/openclaw/topic-families");
    expect(compiledContent).not.toContain("GET /local");
    expect(compiledContent).not.toContain("POST /repo");
    expect(compiledContent).not.toContain("super-secret-test-value");
    expect(compiledContent).not.toContain("super-secret-bearer-token");
  });

  it("reads .clawchat/roles_manifest.json and stores normalized role metadata", async () => {
    await writeFile(
      join(repoPath, ".clawchat", "roles_manifest.json"),
      JSON.stringify(
        {
          roles: [
            {
              role: "worker",
              label: "Worker / Operator",
              purpose: "Operate the app and perform approved work.",
              docsSourcePath: ".clawchat/agent-docs-source/",
              canWrite: true,
              required: false,
              installAfterSetup: true,
              recommendedAgentName: "GapMiner Worker",
            },
            {
              role: "researcher",
              label: "Researcher",
              purpose: "Research source material without operating the app.",
              docsSourcePath: ".clawchat/researcher-docs-source/",
              canWrite: false,
              readOnly: true,
              required: false,
              installAfterSetup: true,
              recommendedAgentName: "GapMiner Researcher",
            },
          ],
        },
        null,
        2,
      ),
    );
    const service = createMarketplaceService();
    const linked = {
      id: "linked-gapminer",
      workspaceId: "workspace-1",
      name: "GapMiner",
      slug: "local-gapminer",
      repoPath,
      frameworkMetadata: { sourceType: "local_repo" },
      apiStyleMetadata: {},
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/",
        sourceHostType: "hermes_bridge",
        sourceHostId: "bridge-1",
      },
    } as unknown as LinkedApplicationEntity;
    const app = (service as any).localLinkedApplicationToMarketplaceApp(linked);
    const discovery = await (service as any).discoverLocalRepoSource(linked);
    const sources = (service as any).buildLocalRepoCanonicalSources(discovery);
    const generated = generateDraftPackFromConfig({
      appSlug: app.slug,
      name: app.name,
      category: app.category,
      riskLevel: app.riskLevel,
      authTypes: ["local_repo"],
      importedSourceModel: await (service as any).importLocalRepoSourceModel(
        app,
        discovery,
      ),
      existingApp: app,
    });
    generated.canonicalSources = { ...generated.canonicalSources, ...sources };
    generated.roleManifest = discovery.roleManifest;
    const openclaw = compileGeneratedMarketplacePack({
      app: { ...app, roleManifest: discovery.roleManifest },
      pack: generated,
      runtimeFormat: "openclaw",
      selectedCapabilities: ["read"],
      connection: null,
      libraryTargetFolder: `marketplace/${app.slug}`,
    });

    expect(discovery.rolesManifest?.roles).toHaveLength(2);
    expect(
      discovery.roleManifest.roles.map((role: { role: string }) => role.role),
    ).toEqual(["worker", "researcher"]);
    expect(
      discovery.roleManifest.roles.find(
        (role: { role: string }) => role.role === "researcher",
      ),
    ).toMatchObject({
      installable: false,
      notInstallableReason:
        "No runtime output is available for role `researcher`.",
      source: "explicit",
    });
    expect(JSON.parse(sources["roles_manifest.json"]).roleCount).toBe(2);
    expect(openclaw.metadata.roleManifest).toMatchObject({ roleCount: 2 });
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/roles_manifest.json"),
      ),
    ).toBe(true);
  });

  it("reads role definitions from .clawchat/app_manifest.json", async () => {
    await rm(join(repoPath, ".clawchat", "auditor-docs-source"), {
      recursive: true,
      force: true,
    });
    await writeFile(
      join(repoPath, ".clawchat", "app_manifest.json"),
      JSON.stringify(
        {
          name: "GapMiner",
          roles: [
            {
              role: "publisher",
              label: "Publisher",
              purpose:
                "Review publish readiness without publishing automatically.",
              docsSourcePath: ".clawchat/publisher-docs-source/",
              canWrite: false,
              readOnly: true,
            },
          ],
        },
        null,
        2,
      ),
    );
    const service = createMarketplaceService();
    const linked = {
      id: "linked-gapminer",
      workspaceId: "workspace-1",
      name: "GapMiner",
      slug: "local-gapminer",
      repoPath,
      frameworkMetadata: { sourceType: "local_repo" },
      apiStyleMetadata: {},
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/",
        sourceHostType: "hermes_bridge",
        sourceHostId: "bridge-1",
      },
    } as unknown as LinkedApplicationEntity;
    const discovery = await (service as any).discoverLocalRepoSource(linked);

    expect(
      discovery.roleManifest.roles.map((role: { role: string }) => role.role),
    ).toEqual(["publisher"]);
    expect(discovery.roleManifest.roles[0]).toMatchObject({
      installable: false,
      source: "explicit",
    });
  });

  it("infers worker and auditor roles from local docs source directories", async () => {
    const service = createMarketplaceService();
    const linked = {
      id: "linked-gapminer",
      workspaceId: "workspace-1",
      name: "GapMiner",
      slug: "local-gapminer",
      repoPath,
      frameworkMetadata: { sourceType: "local_repo" },
      apiStyleMetadata: {},
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/",
        sourceHostType: "hermes_bridge",
        sourceHostId: "bridge-1",
      },
    } as unknown as LinkedApplicationEntity;
    const discovery = await (service as any).discoverLocalRepoSource(linked);

    expect(discovery.roleManifest.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "worker",
          source: "inferred",
          docsSourcePath: ".clawchat/agent-docs-source/",
        }),
        expect.objectContaining({
          role: "auditor",
          source: "inferred",
          docsSourcePath: ".clawchat/auditor-docs-source/",
        }),
      ]),
    );
    expect(
      discovery.roleManifest.roles.some(
        (role: { role: string }) => role.role === "manager",
      ),
    ).toBe(false);
  });

  it("discovers manager docs and compiles manager runtime output separately", async () => {
    await mkdir(
      join(repoPath, ".clawchat", "manager-docs-source", "workflows"),
      {
        recursive: true,
      },
    );
    await writeFile(
      join(repoPath, ".clawchat", "manager-docs-source", "IDENTITY.md"),
      "# IDENTITY.md\n\nGapMiner Manager coordinates worker and auditor roles from roles_manifest.json.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "manager-docs-source", "ROLE_MANAGEMENT.md"),
      "# ROLE_MANAGEMENT.md\n\nRead roles_manifest.json before assigning work to worker, auditor, or future roles.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "manager-docs-source", "DELEGATION_RULES.md"),
      "# DELEGATION_RULES.md\n\nAsk worker to operate the app. Ask auditor to independently review evidence.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "manager-docs-source", "APPROVAL_GATES.md"),
      "# APPROVAL_GATES.md\n\nAsk the human before approving publishing, status changes, destructive work, or external effects.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "manager-docs-source", "AUDIT_HANDLING.md"),
      "# AUDIT_HANDLING.md\n\nInterpret audit findings by evidence strength, blind spots, and requested re-review.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "manager-docs-source", "OUTPUT_FORMAT.md"),
      "# OUTPUT_FORMAT.md\n\nReturn delegation, decision, approval state, and next action.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "manager-docs-source", "TRACKER.md"),
      "# TRACKER.md\n\nTrack assigned role, status, evidence, approval state, and next check.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "manager-docs-source", "WORKFLOW.md"),
      "# WORKFLOW.md\n\nLoad roles_manifest.json, delegate work, request audits, then decide next action.",
    );
    await writeFile(
      join(repoPath, ".clawchat", "roles_manifest.json"),
      JSON.stringify(
        {
          roles: [
            {
              role: "worker",
              label: "Worker / Operator",
              purpose: "Operate the app and perform approved work.",
              docsSourcePath: ".clawchat/agent-docs-source/",
              canWrite: true,
            },
            {
              role: "auditor",
              label: "Auditor",
              purpose:
                "Independently review outputs, evidence, and workflow quality.",
              docsSourcePath: ".clawchat/auditor-docs-source/",
              canWrite: "audit writeback only",
            },
            {
              role: "manager",
              label: "Manager",
              purpose:
                "Coordinate available app roles using the current role manifest.",
              docsSourcePath: ".clawchat/manager-docs-source/",
              canWrite: "coordination only",
            },
          ],
        },
        null,
        2,
      ),
    );
    const service = createMarketplaceService();
    const linked = {
      id: "linked-gapminer",
      workspaceId: "workspace-1",
      name: "GapMiner",
      slug: "local-gapminer",
      repoPath,
      frameworkMetadata: { sourceType: "local_repo" },
      apiStyleMetadata: {},
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/",
        sourceHostType: "hermes_bridge",
        sourceHostId: "bridge-1",
      },
    } as unknown as LinkedApplicationEntity;
    const app = (service as any).localLinkedApplicationToMarketplaceApp(linked);
    const discovery = await (service as any).discoverLocalRepoSource(linked);
    const sourceModel = await (service as any).importLocalRepoSourceModel(
      app,
      discovery,
    );
    const generated = generateDraftPackFromConfig({
      appSlug: app.slug,
      name: app.name,
      category: app.category,
      riskLevel: app.riskLevel,
      authTypes: ["local_repo"],
      knownObjects: sourceModel.objects,
      commonWorkflows: sourceModel.workflowSignals,
      importedSourceModel: sourceModel,
      existingApp: app,
    });
    generated.canonicalSources = {
      ...generated.canonicalSources,
      ...(service as any).buildLocalRepoCanonicalSources(discovery),
    };
    generated.roleManifest = discovery.roleManifest;
    const appWithRoles = { ...app, roleManifest: discovery.roleManifest };
    const openclaw = compileGeneratedMarketplacePack({
      app: appWithRoles,
      pack: generated,
      runtimeFormat: "openclaw",
      selectedCapabilities: ["read"],
      connection: null,
      libraryTargetFolder: `marketplace/${app.slug}`,
    });
    const hermes = compileGeneratedMarketplacePack({
      app: appWithRoles,
      pack: generated,
      runtimeFormat: "hermes",
      selectedCapabilities: ["read"],
      connection: null,
      libraryTargetFolder: `marketplace/${app.slug}`,
    });

    expect(discovery.managerDocsAvailable).toBe(true);
    expect(discovery.managerFileCount).toBeGreaterThanOrEqual(8);
    expect(
      discovery.files.map(
        (file: { relativePath: string }) => file.relativePath,
      ),
    ).toEqual(
      expect.arrayContaining([
        "manager-docs-source/IDENTITY.md",
        "manager-docs-source/ROLE_MANAGEMENT.md",
        "manager-docs-source/WORKFLOW.md",
      ]),
    );
    expect(discovery.roleManifest.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "manager",
          source: "explicit",
          installable: true,
          docsSourcePath: ".clawchat/manager-docs-source/",
        }),
      ]),
    );
    expect(generated.canonicalSources["manager/ROLE_MANAGEMENT.md"]).toContain(
      "roles_manifest.json",
    );
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/manager/ROLE_MANAGEMENT.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("workspace_files/manager/AGENTS.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("workspace_files/manager/WORKFLOW.md"),
      ),
    ).toBe(true);
    expect(openclaw.metadata.managerDocsAvailable).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath === `skills/${app.slug}-manager-router/SKILL.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-manager-router/references/ROLE_MANAGEMENT.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          `skills/${app.slug}-manager-router/references/roles_manifest.json`,
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("workspace_files/worker/AGENTS.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("workspace_files/auditor/AGENTS.md"),
      ),
    ).toBe(true);
  });

  it("keeps manifest-only manager visible but not installable until manager docs exist", async () => {
    await writeFile(
      join(repoPath, ".clawchat", "roles_manifest.json"),
      JSON.stringify(
        {
          roles: [
            {
              role: "manager",
              label: "Manager",
              purpose: "Coordinate roles when manager docs are later added.",
              docsSourcePath: ".clawchat/manager-docs-source/",
              canWrite: false,
            },
            {
              role: "researcher",
              label: "Researcher",
              purpose: "Future research role.",
              docsSourcePath: ".clawchat/researcher-docs-source/",
              canWrite: false,
            },
          ],
        },
        null,
        2,
      ),
    );
    const service = createMarketplaceService();
    const linked = {
      id: "linked-gapminer",
      workspaceId: "workspace-1",
      name: "GapMiner",
      slug: "local-gapminer",
      repoPath,
      frameworkMetadata: { sourceType: "local_repo" },
      apiStyleMetadata: {},
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/",
        sourceHostType: "hermes_bridge",
        sourceHostId: "bridge-1",
      },
    } as unknown as LinkedApplicationEntity;
    const discovery = await (service as any).discoverLocalRepoSource(linked);

    expect(discovery.roleManifest.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "manager",
          installable: false,
          notInstallableReason:
            "No runtime output is available for role `manager`.",
        }),
        expect.objectContaining({
          role: "researcher",
          installable: false,
          notInstallableReason:
            "No runtime output is available for role `researcher`.",
        }),
      ]),
    );
  });

  it("reads .clawchat source from selected bridge host and keeps output provider-specific", async () => {
    const readMarketplaceLocalRepoDocs = jest.fn().mockResolvedValue({
      requestId: "req-1",
      status: "ok",
      repoPath: "/home/example/repos/GapMiner",
      docsSourcePath: ".clawchat/",
      gitCommit: "abc123",
      dirtyState: "dirty",
      missingFiles: [],
      errors: [],
      files: [
        {
          relativePath: ".clawchat/agent-docs-source/workflow.md",
          content:
            "# GapMiner Workflow\n\nRead topic families, seed topics, opportunities, SERP findings, commercial narratives, and build handoffs.",
          sha256: "hash-workflow",
          sizeBytes: 128,
        },
        {
          relativePath: ".clawchat/agent-docs-source/auth.md",
          content:
            "# GapMiner Auth\n\nUse x-openclaw-secret or Authorization Bearer auth. OPENCLAW_WEBHOOK_SECRET is the env var name only.",
          sha256: "hash-auth",
          sizeBytes: 128,
        },
        {
          relativePath: "api/endpoints.md",
          content:
            "# GapMiner Endpoints\n\nConvex HTTP routes are defined in `convex/http.ts`.\n\n- GET /api/openclaw/topic-families\n- GET /api/openclaw/opportunities",
          sha256: "hash-endpoints",
          sizeBytes: 160,
        },
        {
          relativePath: ".clawchat/auditor-docs-source/SOUL.md",
          content: "# Soul\n\nAudit GapMiner work independently.",
          sha256: "hash-auditor-soul",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/auditor-docs-source/IDENTITY.md",
          content: "# Identity\n\nGapMiner auditor.",
          sha256: "hash-auditor-identity",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/auditor-docs-source/APP_CONTEXT.md",
          content: "# App Context\n\nGapMiner app context.",
          sha256: "hash-auditor-context",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/auditor-docs-source/REVIEW_RULES.md",
          content:
            "# Review Rules\n\nAuditor findings must separate direct observations from inferences.",
          sha256: "hash-auditor",
          sizeBytes: 96,
        },
        {
          relativePath: ".clawchat/auditor-docs-source/OUTPUT_FORMAT.md",
          content: "# Output Format\n\nReport findings by severity.",
          sha256: "hash-auditor-output",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/auditor-docs-source/WRITEBACK.md",
          content:
            "# Writeback\n\nOnly write audit findings where policy allows.",
          sha256: "hash-auditor-writeback",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/auditor-docs-source/TRACKER.md",
          content: "# Tracker\n\nTrack review status carefully.",
          sha256: "hash-auditor-tracker",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/auditor-docs-source/WORKFLOW.md",
          content: "# Workflow\n\nReview evidence before judging work.",
          sha256: "hash-auditor-workflow",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/manager-docs-source/SOUL.md",
          content:
            "# Soul\n\nCoordinate GapMiner roles using roles_manifest.json.",
          sha256: "hash-manager-soul",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/manager-docs-source/IDENTITY.md",
          content: "# Identity\n\nGapMiner manager.",
          sha256: "hash-manager-identity",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/manager-docs-source/APP_CONTEXT.md",
          content:
            "# App Context\n\nGapMiner app context for manager coordination.",
          sha256: "hash-manager-context",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/manager-docs-source/ROLE_MANAGEMENT.md",
          content:
            "# Role Management\n\nRead roles_manifest.json before assigning worker, auditor, or future roles.",
          sha256: "hash-manager-role-management",
          sizeBytes: 96,
        },
        {
          relativePath: ".clawchat/manager-docs-source/DELEGATION_RULES.md",
          content:
            "# Delegation Rules\n\nDelegate app operations to worker and independent review to auditor.",
          sha256: "hash-manager-delegation",
          sizeBytes: 96,
        },
        {
          relativePath: ".clawchat/manager-docs-source/APPROVAL_GATES.md",
          content:
            "# Approval Gates\n\nAsk the human before approval-gated actions.",
          sha256: "hash-manager-approval",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/manager-docs-source/AUDIT_HANDLING.md",
          content:
            "# Audit Handling\n\nInterpret audit findings before deciding next actions.",
          sha256: "hash-manager-audit",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/manager-docs-source/OUTPUT_FORMAT.md",
          content:
            "# Output Format\n\nReturn decisions, delegation, approvals, and next steps.",
          sha256: "hash-manager-output",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/manager-docs-source/TRACKER.md",
          content:
            "# Tracker\n\nTrack role assignments, status, evidence, and approval state.",
          sha256: "hash-manager-tracker",
          sizeBytes: 72,
        },
        {
          relativePath: ".clawchat/manager-docs-source/WORKFLOW.md",
          content:
            "# Workflow\n\nLoad roles_manifest.json, delegate work, audit results, and decide next action.",
          sha256: "hash-manager-workflow",
          sizeBytes: 72,
        },
      ],
    });
    const service = createMarketplaceServiceWithBridge({
      readMarketplaceLocalRepoDocs,
    });
    const linked = {
      id: "linked-gapminer",
      workspaceId: "workspace-1",
      name: "GapMiner",
      slug: "local-gapminer",
      repoPath: "/home/example/repos/GapMiner",
      frameworkMetadata: { sourceType: "local_repo" },
      apiStyleMetadata: {},
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/",
        sourceHostType: "hermes_bridge",
        sourceHostId: "bridge-1",
        bridgeDeviceId: "bridge-1",
        sourceHostLabel: "UK PC / Hermes",
        runtimeType: "hermes",
      },
    } as unknown as LinkedApplicationEntity;
    const app = (service as any).localLinkedApplicationToMarketplaceApp(linked);
    const discovery = await (service as any).discoverLocalRepoSource(linked);
    const sourceModel = await (service as any).importLocalRepoSourceModel(
      app,
      discovery,
    );
    const generated = generateDraftPackFromConfig({
      appSlug: app.slug,
      name: app.name,
      category: app.category,
      riskLevel: app.riskLevel,
      authTypes: ["local_repo"],
      knownObjects: sourceModel.objects,
      commonWorkflows: sourceModel.workflowSignals,
      importedSourceModel: sourceModel,
      existingApp: app,
    });
    generated.canonicalSources = {
      ...generated.canonicalSources,
      ...(service as any).buildLocalRepoCanonicalSources(discovery),
    };
    (service as any).applyLocalRepoQualitySignals(generated, discovery);

    expect(readMarketplaceLocalRepoDocs).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        bridgeDeviceId: "bridge-1",
        repoPath: "/home/example/repos/GapMiner",
        docsSourcePath: ".clawchat/",
        includeGlobs: expect.arrayContaining([
          ".clawchat/auditor-docs-source/*.md",
          ".clawchat/auditor-docs-source/**/*.md",
          ".clawchat/manager-docs-source/*.md",
          ".clawchat/manager-docs-source/**/*.md",
        ]),
      }),
    );
    expect(discovery.sourceHostType).toBe("hermes_bridge");
    expect(discovery.auditorDocsAvailable).toBe(true);
    expect(discovery.auditorFileCount).toBe(8);
    expect(discovery.managerDocsAvailable).toBe(true);
    expect(discovery.managerFileCount).toBe(10);
    expect(discovery.bridgeReturnedManagerFileCount).toBe(10);
    expect(discovery.roleManifest.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "worker", installable: true }),
        expect.objectContaining({ role: "auditor", installable: true }),
        expect.objectContaining({ role: "manager", installable: true }),
      ]),
    );
    expect(
      discovery.files.map(
        (file: { relativePath: string }) => file.relativePath,
      ),
    ).toEqual(
      expect.arrayContaining([
        "auditor-docs-source/SOUL.md",
        "auditor-docs-source/IDENTITY.md",
        "auditor-docs-source/APP_CONTEXT.md",
        "auditor-docs-source/REVIEW_RULES.md",
        "auditor-docs-source/OUTPUT_FORMAT.md",
        "auditor-docs-source/WRITEBACK.md",
        "auditor-docs-source/TRACKER.md",
        "auditor-docs-source/WORKFLOW.md",
        "manager-docs-source/SOUL.md",
        "manager-docs-source/IDENTITY.md",
        "manager-docs-source/APP_CONTEXT.md",
        "manager-docs-source/ROLE_MANAGEMENT.md",
        "manager-docs-source/DELEGATION_RULES.md",
        "manager-docs-source/APPROVAL_GATES.md",
        "manager-docs-source/AUDIT_HANDLING.md",
        "manager-docs-source/OUTPUT_FORMAT.md",
        "manager-docs-source/TRACKER.md",
        "manager-docs-source/WORKFLOW.md",
      ]),
    );
    expect(discovery.gitCommit).toBe("abc123");
    expect(discovery.dirtyState).toBe(true);
    expect(generated.canonicalSources["workflow.md"]).toContain(
      "topic families",
    );
    expect(generated.canonicalSources["auditor/SOUL.md"]).toContain(
      "Audit GapMiner",
    );
    expect(generated.canonicalSources["auditor/REVIEW_RULES.md"]).toContain(
      "direct observations",
    );
    expect(generated.canonicalSources["manager/SOUL.md"]).toContain(
      "roles_manifest.json",
    );
    expect(generated.canonicalSources["manager/ROLE_MANAGEMENT.md"]).toContain(
      "future roles",
    );
    const selectedCapabilities = app.capabilities
      .filter(
        (capability: { defaultEnabled: boolean }) => capability.defaultEnabled,
      )
      .map((capability: { id: string }) => capability.id);
    const remoteAppWithRoles = { ...app, roleManifest: discovery.roleManifest };
    const openclaw = compileGeneratedMarketplacePack({
      app: remoteAppWithRoles,
      pack: generated,
      runtimeFormat: "openclaw",
      selectedCapabilities,
      connection: null,
      libraryTargetFolder: `marketplace/${app.slug}`,
    });
    const hermes = compileGeneratedMarketplacePack({
      app: remoteAppWithRoles,
      pack: generated,
      runtimeFormat: "hermes",
      selectedCapabilities,
      connection: null,
      libraryTargetFolder: `marketplace/${app.slug}`,
    });
    expect(openclaw.metadata.auditorFileCount).toBe(8);
    expect(openclaw.metadata.managerDocsAvailable).toBe(true);
    expect(openclaw.metadata.managerFileCount).toBe(10);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/auditor/SOUL.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("workspace_files/auditor/AGENTS.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("workspace_files/auditor/WORKFLOW.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("library/manager/SOUL.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("workspace_files/manager/AGENTS.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("workspace_files/manager/WORKFLOW.md"),
      ),
    ).toBe(true);
    expect(hermes.metadata.auditorFileCount).toBe(8);
    expect(hermes.metadata.managerFileCount).toBe(10);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath === "skills/local-gapminer-auditor-router/SKILL.md",
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          "skills/local-gapminer-auditor-router/references/SOUL.md",
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          "skills/local-gapminer-auditor-router/references/WORKFLOW.md",
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath === "skills/local-gapminer-manager-router/SKILL.md",
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          "skills/local-gapminer-manager-router/references/SOUL.md",
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          "skills/local-gapminer-manager-router/references/WORKFLOW.md",
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath ===
          "skills/local-gapminer-manager-router/references/roles_manifest.json",
      ),
    ).toBe(true);
    expect(generated.canonicalSources["api/endpoints.md"]).toContain(
      "convex/http.ts",
    );
    expect(generated.canonicalSources["api/endpoints.md"]).not.toContain(
      "GET /local",
    );
    expect(generated.canonicalSources["api/endpoints.md"]).not.toContain(
      "POST /repo",
    );
    generated.canonicalSources["local_repo_source.md"] =
      `${generated.canonicalSources["local_repo_source.md"]}\n- source hash ac1234567890abcdef1234567890abcdef is not a credential`;
    const reviewGate = evaluateGeneratedPackReviewGate(app, generated);
    expect(reviewGate.checks.secretSafetyScan).toBe(true);
  });

  it("normalizes legacy config-file docs source paths before reading a bridge host", async () => {
    const readMarketplaceLocalRepoDocs = jest.fn().mockResolvedValue({
      requestId: "req-1",
      status: "ok",
      repoPath: "/home/example/repos/LocalAppConnector",
      docsSourcePath: ".clawchat/clawchat.config.json",
      gitCommit: "abc123",
      dirtyState: "clean",
      missingFiles: [],
      errors: [],
      files: [
        {
          relativePath: ".clawchat/clawchat.config.json",
          content: JSON.stringify({
            docsSourcePath: ".clawchat/clawchat.config.json",
          }),
          sha256: "hash-config",
          sizeBytes: 64,
        },
      ],
    });
    const service = createMarketplaceServiceWithBridge({
      readMarketplaceLocalRepoDocs,
    });
    const linked = {
      id: "linked-localappconnector",
      workspaceId: "workspace-1",
      name: "LocalAppConnector",
      slug: "local-localappconnector",
      repoPath: "/home/example/repos/LocalAppConnector",
      frameworkMetadata: { sourceType: "local_repo" },
      apiStyleMetadata: {},
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/clawchat.config.json",
        sourceHostType: "hermes_bridge",
        sourceHostId: "bridge-1",
        bridgeDeviceId: "bridge-1",
        sourceHostLabel: "Hermes bridge / UK PC",
        runtimeType: "hermes",
      },
    } as unknown as LinkedApplicationEntity;

    const app = (service as any).localLinkedApplicationToMarketplaceApp(linked);
    const discovery = await (service as any).discoverLocalRepoSource(linked);

    expect(app.sourceMetadata.docsSourcePath).toBe(".clawchat/");
    expect(readMarketplaceLocalRepoDocs).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        repoPath: "/home/example/repos/LocalAppConnector",
        docsSourcePath: ".clawchat/",
      }),
    );
    expect(discovery.docsSourcePath).toBe(".clawchat/");
    expect(
      discovery.files.map(
        (file: { relativePath: string }) => file.relativePath,
      ),
    ).toEqual(["clawchat.config.json"]);
  });

  it("allows local repo packs with manual-review-only coverage gaps to be promoted", async () => {
    const service = createMarketplaceService();
    const app = {
      ...MARKETPLACE_CATALOG.find((item) => item.slug === "github")!,
      slug: "gapminer",
      name: "GapMiner",
      sourceType: "local_repo",
      packQuality: {
        level: "generated_draft",
        publicationStatus: "review_needed",
        label: "Local repo",
        description: "Local repo generated pack",
        confidence: "medium",
        reviewed: false,
        source: "local_repo",
      },
    };
    const generated = generateDraftPackFromConfig({
      appSlug: app.slug,
      name: app.name,
      category: app.category,
      riskLevel: app.riskLevel,
      authTypes: ["local_repo"],
      knownObjects: ["topic families", "opportunities"],
      commonWorkflows: ["Read topic families", "Draft opportunity update"],
      importedSourceModel: {
        extractedAt: new Date().toISOString(),
        sourceUrls: [],
        sourceSummaries: [],
        objects: ["topic families", "seed topics", "opportunities"],
        authTypes: ["local_repo"],
        scopeSignals: [
          "read documented local app state",
          "write operations require approval",
        ],
        endpoints: [
          {
            method: "GET",
            path: "/api/openclaw/topic-families",
            family: "topic_families",
            summary: "Read topic families",
          },
        ],
        endpointFamilies: [
          {
            id: "topic_families",
            label: "Topic families",
            guidance: "Read topic families",
            representativeEndpoints: ["GET /api/openclaw/topic-families"],
          },
        ],
        rateLimitSignals: [],
        webhookSignals: ["OpenClaw webhook routes"],
        workflowSignals: ["Read topic families", "Draft opportunity update"],
        safetySignals: ["Do not expose secrets", "Writes require approval"],
        exampleSignals: ["Read topic families", "Draft opportunity update"],
        highRiskSignals: ["Writes require approval"],
        coverage: {
          officialSources: false,
          apiOverview: true,
          auth: true,
          scopes: true,
          rateLimits: false,
          webhooks: true,
          errors: true,
          examples: true,
          objects: true,
          endpoints: true,
          workflows: true,
          safetyPolicy: true,
        },
        missingSections: ["rate limit docs"],
        warnings: [],
        ingestionErrors: [],
      },
      existingApp: app as any,
    });
    generated.sources = [
      {
        kind: "local_repo_docs",
        filePath: "/repo/.clawchat/agent-docs-source/workflow.md",
        title: ".clawchat/agent-docs-source/workflow.md",
        official: false,
        ingestion: {
          status: "imported",
          importedAt: generated.generatedAt,
          contentType: "text/markdown",
          contentLength: 100,
          contentHash: "hash",
        },
      },
    ];
    generated.canonicalSources["local_repo_source.md"] =
      "Generated from local repo .clawchat docs.";
    (service as any).applyLocalRepoQualitySignals(generated, {
      files: [
        {
          relativePath: "agent-docs-source/api.md",
          absolutePath: "/repo/.clawchat/agent-docs-source/api.md",
          content: "API docs",
          hash: "hash-api",
        },
        {
          relativePath: "agent-docs-source/auth.md",
          absolutePath: "/repo/.clawchat/agent-docs-source/auth.md",
          content: "Auth docs",
          hash: "hash-auth",
        },
        {
          relativePath: "agent-docs-source/permissions.md",
          absolutePath: "/repo/.clawchat/agent-docs-source/permissions.md",
          content: "Permission docs",
          hash: "hash-permissions",
        },
      ],
      warnings: [],
    });
    const reviewGate = evaluateGeneratedPackReviewGate(app as any, generated);
    expect(reviewGate.outcome).toBe("needs_manual_review");
    expect(reviewGate.blockingReasons).toEqual([
      "high-risk rate-limit coverage missing",
    ]);
  });

  it("fails clearly when a local repo source host is missing or unreachable", async () => {
    const service = createMarketplaceServiceWithBridge({
      readMarketplaceLocalRepoDocs: jest
        .fn()
        .mockRejectedValue(new Error("selected host offline")),
    });
    const missingHost = {
      id: "linked-gapminer",
      workspaceId: "workspace-1",
      name: "GapMiner",
      slug: "local-gapminer",
      repoPath: "/home/example/repos/GapMiner",
      frameworkMetadata: { sourceType: "local_repo" },
      apiStyleMetadata: {},
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/",
      },
    } as unknown as LinkedApplicationEntity;
    await expect(
      (service as any).discoverLocalRepoSource(missingHost),
    ).rejects.toThrow(/paired OpenClaw, Hermes, or runtime host is required/);

    await expect(
      (service as any).discoverLocalRepoSource({
        ...missingHost,
        metadata: {
          sourceType: "local_repo",
          sourceHostType: "retired_current_backend",
          sourceMigrationRequired: true,
        },
      }),
    ).rejects.toThrow(/Reconfigure this local repository source/);

    const unreachable = {
      ...missingHost,
      metadata: {
        sourceType: "local_repo",
        docsSourcePath: ".clawchat/",
        sourceHostType: "openclaw_bridge",
        sourceHostId: "bridge-1",
        bridgeDeviceId: "bridge-1",
      },
    } as unknown as LinkedApplicationEntity;
    await expect(
      (service as any).discoverLocalRepoSource(unreachable),
    ).rejects.toThrow(/selected host offline/);
  });
});

describe("Marketplace provider pack compile path", () => {
  it("validates auditor as a first-class marketplace install role", () => {
    const dto = Object.assign(new InstallMarketplaceAppDto(), {
      appSlug: "github",
      role: "auditor",
    });

    expect(validateSync(dto).map((error) => error.property)).not.toContain(
      "role",
    );
  });

  it("resolves OpenClaw auditor workspace files without using worker paths", () => {
    expect(
      repoPackPathToWorkspaceFilename(
        ".clawchat/agent-docs/workspace_files/auditor/AGENTS.md",
        "auditor",
      ),
    ).toBe("AGENTS.md");
    expect(
      repoPackPathToWorkspaceFilename(
        ".clawchat/agent-docs/workspace_files/worker/AGENTS.md",
        "auditor",
      ),
    ).toBeNull();
  });

  it("keeps OpenClaw documentation installs role-aware when adding auditor after worker", async () => {
    const bridgeService = {
      writeAgentWorkspaceFiles: jest.fn().mockResolvedValue(undefined),
    };
    const installRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => ({ ...input })),
      save: jest.fn(async (input) => ({
        id: `${input.role}-install`,
        ...input,
      })),
    };
    const packRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: "pack-1",
        workspaceId: "workspace-1",
        linkedApplicationId: "linked-1",
        blueprintVersionSet: [],
        generatedFileManifest: [
          { path: ".clawchat/agent-docs/workspace_files/worker/AGENTS.md" },
          { path: ".clawchat/agent-docs/workspace_files/auditor/AGENTS.md" },
          { path: ".clawchat/agent-docs/workspace_files/manager/AGENTS.md" },
        ],
        metadata: {
          marketplaceFiles: [
            {
              path: ".clawchat/agent-docs/workspace_files/worker/AGENTS.md",
              content: "# Worker",
            },
            {
              path: ".clawchat/agent-docs/workspace_files/auditor/AGENTS.md",
              content: "# Auditor",
            },
            {
              path: ".clawchat/agent-docs/workspace_files/manager/AGENTS.md",
              content: "# Manager",
            },
          ],
        },
      }),
    };
    const syncRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((input) => input),
    };
    const agentRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: "agent-1", workspaceId: "workspace-1" }),
    };
    const linkedApplicationService = {
      get: jest.fn().mockResolvedValue({
        id: "linked-1",
        repoPath: "/repo",
        repoKey: null,
      }),
    };
    const installService = new AgentDocumentationInstallService(
      bridgeService as any,
      {} as any,
      linkedApplicationService as any,
      installRepo as any,
      packRepo as any,
      syncRepo as any,
      agentRepo as any,
    );

    await installService.install("workspace-1", {
      packId: "pack-1",
      agentId: "agent-1",
      role: "worker",
    });
    await installService.install("workspace-1", {
      packId: "pack-1",
      agentId: "agent-1",
      role: "auditor",
    });
    await installService.install("workspace-1", {
      packId: "pack-1",
      agentId: "agent-1",
      role: "manager",
    });

    expect(installRepo.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        agentId: "agent-1",
        packId: "pack-1",
        role: "worker",
      },
    });
    expect(installRepo.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        agentId: "agent-1",
        packId: "pack-1",
        role: "auditor",
      },
    });
    expect(installRepo.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        agentId: "agent-1",
        packId: "pack-1",
        role: "manager",
      },
    });
    expect(bridgeService.writeAgentWorkspaceFiles).toHaveBeenLastCalledWith(
      "workspace-1",
      "agent-1",
      "",
      [{ filename: "AGENTS.md", content: "# Manager" }],
    );
  });

  it("targets Hermes worker installs at an app-specific router skill", () => {
    const service = createMarketplaceService();
    const app = MARKETPLACE_CATALOG.find((item) => item.slug === "github");
    expect(app).toBeDefined();

    const request = (service as any).buildHermesSkillInstallBridgeRequest({
      workspaceId: "workspace-1",
      agent: { id: "agent-1", externalId: "myner_hermes" },
      app: app!,
      marketplaceInstallId: "install-1",
      approvalProfileId: app!.approvalProfile,
      selectedCapabilities: ["read"],
      connection: null,
      role: "worker",
      files: [
        {
          relativePath: "skills/github-router/SKILL.md",
          content: "---\nname: github-router\n---\n\n# GitHub Router",
          classification: "generated_workspace_router",
          refreshPolicy: "regenerate_allowed",
        },
        {
          relativePath: "skills/github-router/references/INDEX.md",
          content: "# Index",
          classification: "generated_app_capability_docs",
          refreshPolicy: "regenerate_allowed",
        },
      ],
    });

    expect(request.agentId).toBe("myner_hermes");
    expect(request.skillName).toBe("github-router");
    expect(request.targetRoot).toBe("skills/github-router");
    expect(
      request.files.map((file: { relativePath: string }) => file.relativePath),
    ).toEqual(["SKILL.md", "references/INDEX.md"]);
    expect(request.files[0].content).toContain("name: github-router");
  });

  it("targets Hermes auditor installs at an app-specific auditor router skill", () => {
    const service = createMarketplaceService();
    const app = MARKETPLACE_CATALOG.find((item) => item.slug === "github");
    expect(app).toBeDefined();

    const request = (service as any).buildHermesSkillInstallBridgeRequest({
      workspaceId: "workspace-1",
      agent: { id: "agent-1", externalId: "gapminer_auditor" },
      app: app!,
      marketplaceInstallId: "install-auditor",
      approvalProfileId: app!.approvalProfile,
      selectedCapabilities: ["read"],
      connection: null,
      role: "auditor",
      files: [
        {
          relativePath: "skills/github-auditor-router/SKILL.md",
          content:
            "---\nname: github-auditor-router\n---\n\n# GitHub Auditor Router",
          classification: "generated_workspace_router",
          refreshPolicy: "regenerate_allowed",
        },
        {
          relativePath: "skills/github-auditor-router/references/INDEX.md",
          content: "# Auditor Index",
          classification: "generated_auditor_docs",
          refreshPolicy: "regenerate_allowed",
        },
        {
          relativePath: "skills/github-router/SKILL.md",
          content: "---\nname: github-router\n---\n\n# GitHub Router",
          classification: "generated_workspace_router",
          refreshPolicy: "regenerate_allowed",
        },
      ],
    });

    expect(request.agentId).toBe("gapminer_auditor");
    expect(request.skillName).toBe("github-auditor-router");
    expect(request.targetRoot).toBe("skills/github-auditor-router");
    expect(
      request.files.map((file: { relativePath: string }) => file.relativePath),
    ).toEqual(["SKILL.md", "references/INDEX.md"]);
    expect(request.files[0].content).toContain("name: github-auditor-router");
  });

  it("creates an X marketplace install and sends an app-specific Hermes skill install request", async () => {
    const app = MARKETPLACE_CATALOG.find((item) => item.slug === "x");
    expect(app).toBeDefined();
    const auditLogService = { record: jest.fn().mockResolvedValue(null) };
    const { repo: marketplaceInstallRepo } = createMarketplaceInstallRepoMock();
    marketplaceInstallRepo.save.mockImplementation(async (input: any) => {
      if (Array.isArray(input)) return input;
      return {
        id: input.id ?? "x-install-1",
        createdAt: input.createdAt ?? new Date("2026-05-13T10:00:00.000Z"),
        updatedAt: input.updatedAt ?? new Date("2026-05-13T10:00:00.000Z"),
        ...input,
      };
    });
    const bridgeService = {
      hasHermesMarketplaceSkillInstallCapability: jest
        .fn()
        .mockReturnValue(true),
      installMarketplaceHermesSkill: jest.fn(async (_workspaceId, request) => ({
        request: { requestId: "bridge-request-1", ...request },
        response: {
          requestId: "bridge-request-1",
          status: "installed",
          agentId: request.agentId,
          appSlug: request.appSlug,
          installedFiles: [
            "skills/x-router/SKILL.md",
            "skills/x-router/references/INDEX.md",
          ],
          bridgeCapabilities: ["marketplaceHermesSkillInstall"],
        },
      })),
    };
    const runtimeBindingService = {
      findByAgentId: jest.fn().mockResolvedValue({
        workspaceId: "workspace-1",
        runtimeType: "hermes",
        adapterKind: "hermes_bridge",
        routingMode: "default_target",
        workspaceRoot: "/workspace",
        repoKey: null,
        isEnabled: true,
        healthStatus: "ready",
        capabilities: { marketplaceHermesSkillInstall: true },
        configMetadata: {},
      }),
      upsertByAgentId: jest.fn().mockResolvedValue(undefined),
    };
    const agentDocumentationInstallRepo = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({ id: "agent-doc-install-1", ...input })),
    };
    const service = new MarketplaceService(
      {} as any,
      auditLogService as any,
      {} as any,
      {} as any,
      {} as any,
      bridgeService as any,
      runtimeBindingService as any,
      {} as any,
      marketplaceInstallRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      agentDocumentationInstallRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest
      .spyOn(service as any, "ensureLinkedMarketplaceApplication")
      .mockResolvedValue({
        id: "linked-x",
      });
    jest.spyOn(service as any, "buildCompiledPreview").mockResolvedValue({
      approvalProfileId: "x_safe_operator",
      files: [
        {
          relativePath: "skills/x-router/SKILL.md",
          content: "---\nname: x-router\n---\n\n# X Router",
          classification: "generated_workspace_router",
          refreshPolicy: "regenerate_allowed",
        },
        {
          relativePath: "skills/x-router/references/INDEX.md",
          content: "# X Index",
          classification: "generated_app_capability_docs",
          refreshPolicy: "regenerate_allowed",
        },
      ],
    });
    jest
      .spyOn(service as any, "createPack")
      .mockResolvedValue({ id: "pack-x" });

    const result = await (service as any).installHermesPack({
      workspaceId: "workspace-1",
      userId: "user-1",
      app: app!,
      connection: {
        id: "x-connection-1",
        displayName: "X connection",
        environment: "default",
        authType: "oauth2_pkce_user",
      },
      selectedCapabilities: ["read", "draft"],
      approvalProfileId: "x_safe_operator",
      targetMode: "existing_agents",
      role: "worker",
      workspaceAgents: [
        {
          id: "agent-1",
          externalId: "social_hermes",
          name: "Social Hermes",
          source: "hermes",
          runtimeBinding: {
            runtimeType: "hermes",
            capabilities: { marketplaceHermesSkillInstall: true },
          },
        },
      ],
    });

    expect(result.status).toBe("installed");
    expect(marketplaceInstallRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appSlug: "x",
        connectionId: "x-connection-1",
        agentId: "agent-1",
        installStatus: "requested",
      }),
    );
    expect(agentDocumentationInstallRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        agentId: "agent-1",
        packId: "pack-x",
        role: "worker",
        workspaceFileManifest: expect.arrayContaining([
          expect.objectContaining({
            path: "skills/x-router/SKILL.md",
            hash: expect.any(String),
          }),
          expect.objectContaining({
            path: "skills/x-router/references/INDEX.md",
            hash: expect.any(String),
          }),
        ]),
      }),
    );
    expect(bridgeService.installMarketplaceHermesSkill).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        type: "marketplace.installHermesSkill",
        agentId: "social_hermes",
        appSlug: "x",
        skillName: "x-router",
        targetRoot: "skills/x-router",
        connection: expect.objectContaining({ id: "x-connection-1" }),
        files: expect.arrayContaining([
          expect.objectContaining({ relativePath: "SKILL.md" }),
          expect.objectContaining({ relativePath: "references/INDEX.md" }),
        ]),
      }),
    );
    expect(runtimeBindingService.upsertByAgentId).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({
        configMetadata: expect.objectContaining({
          defaultSkills: ["x-router"],
          installedMarketplaceSkills: expect.objectContaining({
            "x:worker": expect.objectContaining({
              skillName: "x-router",
              targetRoot: "skills/x-router",
            }),
          }),
        }),
      }),
    );
  });

  it("targets Hermes manager installs at an app-specific manager router skill", () => {
    const service = createMarketplaceService();
    const app = MARKETPLACE_CATALOG.find((item) => item.slug === "github");
    expect(app).toBeDefined();

    const request = (service as any).buildHermesSkillInstallBridgeRequest({
      workspaceId: "workspace-1",
      agent: { id: "agent-1", externalId: "gapminer_manager" },
      app: app!,
      marketplaceInstallId: "install-manager",
      approvalProfileId: app!.approvalProfile,
      selectedCapabilities: ["read"],
      connection: null,
      role: "manager",
      files: [
        {
          relativePath: "skills/github-manager-router/SKILL.md",
          content:
            "---\nname: github-manager-router\n---\n\n# GitHub Manager Router",
          classification: "generated_workspace_router",
          refreshPolicy: "regenerate_allowed",
        },
        {
          relativePath:
            "skills/github-manager-router/references/roles_manifest.json",
          content: "{}",
          classification: "generated_role_manifest",
          refreshPolicy: "regenerate_allowed",
        },
        {
          relativePath: "skills/github-router/SKILL.md",
          content: "---\nname: github-router\n---\n\n# GitHub Router",
          classification: "generated_workspace_router",
          refreshPolicy: "regenerate_allowed",
        },
      ],
    });

    expect(request.agentId).toBe("gapminer_manager");
    expect(request.skillName).toBe("github-manager-router");
    expect(request.targetRoot).toBe("skills/github-manager-router");
    expect(
      request.files.map((file: { relativePath: string }) => file.relativePath),
    ).toEqual(["SKILL.md", "references/roles_manifest.json"]);
    expect(request.files[0].content).toContain("name: github-manager-router");
  });

  it("fails clearly when a manifest future role has no runtime output", () => {
    const service = createMarketplaceService();
    const app = {
      ...MARKETPLACE_CATALOG.find((item) => item.slug === "github")!,
      roleManifest: {
        roleCount: 1,
        roles: [
          {
            role: "researcher",
            label: "Researcher",
            purpose: "Research GitHub context without operating repositories.",
            docsSourcePath: ".clawchat/researcher-docs-source/",
            runtimeOutputPath: null,
            canWrite: false,
            readOnly: true,
            approvalRequiredFor: [],
            blockedActions: [],
            required: false,
            installAfterSetup: true,
            recommendedAgentName: "GitHub Researcher",
            recommendedAgentType: "researcher",
            installable: false,
            notInstallableReason:
              "No runtime output is available for role `researcher`.",
            source: "explicit",
          },
        ],
      },
    };

    expect(() => (service as any).assertRoleDefined(app, "researcher")).toThrow(
      "No runtime output is available for role `researcher`.",
    );
  });

  it("marks installed Hermes router skills as default runtime skills", async () => {
    const runtimeBindingService = {
      findByAgentId: jest.fn().mockResolvedValue({
        id: "binding-1",
        workspaceId: "workspace-1",
        agentId: "agent-1",
        runtimeType: "hermes",
        adapterKind: "hermes_bridge",
        routingMode: "default_target",
        workspaceRoot: "/workspace",
        repoKey: null,
        isEnabled: true,
        healthStatus: "ready",
        capabilities: { bridgeBacked: true },
        configMetadata: { defaultSkills: ["other-router"] },
      }),
      upsertByAgentId: jest.fn(),
    };
    const service = new MarketplaceService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      runtimeBindingService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await (service as any).markHermesDefaultSkillInstalled({
      agent: { id: "agent-1" },
      skillName: "gapminer-router",
      appSlug: "gapminer",
      role: "worker",
      marketplaceInstallId: "install-1",
      targetRoot: "skills/gapminer-router",
    });

    expect(runtimeBindingService.upsertByAgentId).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({
        configMetadata: expect.objectContaining({
          defaultSkills: ["other-router", "gapminer-router"],
          installedMarketplaceSkills: expect.objectContaining({
            "gapminer:worker": expect.objectContaining({
              appSlug: "gapminer",
              role: "worker",
              skillName: "gapminer-router",
              targetRoot: "skills/gapminer-router",
              marketplaceInstallId: "install-1",
            }),
          }),
        }),
      }),
    );
  });

  it("compiles curated provider packs for OpenClaw and Hermes preview/install inputs", () => {
    const app = MARKETPLACE_CATALOG.find((item) => item.slug === "slack");
    expect(app).toBeDefined();
    const selectedCapabilities = app!.capabilities
      .filter((capability) => capability.defaultEnabled)
      .map((capability) => capability.id);

    const openclaw = compileCanonicalOpenClawPack({
      app: app!,
      selectedCapabilities,
      approvalProfileId: app!.approvalProfile,
      connection: null,
      libraryTargetFolder: `marketplace/${app!.slug}`,
    });
    const hermes = compileCanonicalHermesPack({
      app: app!,
      selectedCapabilities,
      approvalProfileId: app!.approvalProfile,
      connection: null,
      libraryTargetFolder: `marketplace/${app!.slug}`,
    });

    expect(
      openclaw.files.some((file) =>
        file.relativePath.endsWith("pack_manifest.json"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.includes("workspace_files/worker/AGENTS.md"),
      ),
    ).toBe(true);
    expect(
      openclaw.files.some((file) =>
        file.relativePath.includes("workspace_files/auditor/AGENTS.md"),
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) => file.relativePath === `skills/${app!.slug}-router/SKILL.md`,
      ),
    ).toBe(true);
    expect(
      hermes.files.some(
        (file) =>
          file.relativePath === `skills/${app!.slug}-auditor-router/SKILL.md`,
      ),
    ).toBe(true);
  });

  it("renders Outlook dangerous-mode Hermes docs without Safe Operator send approval wording", () => {
    const app = MARKETPLACE_CATALOG.find((item) => item.slug === "outlook");
    expect(app).toBeDefined();
    const hermes = compileCanonicalHermesPack({
      app: app!,
      selectedCapabilities: [
        "email_read",
        "email_draft",
        "sender_identity",
        "email_send",
        "email_reply",
        "email_forward",
      ],
      approvalProfileId: "dangerously_skip_permissions",
      connection: null,
      libraryTargetFolder: `marketplace/${app!.slug}`,
    });
    const skill = hermes.files.find(
      (file) => file.relativePath === "skills/outlook-router/SKILL.md",
    );
    const index = hermes.files.find(
      (file) =>
        file.relativePath === "skills/outlook-router/references/INDEX.md",
    );

    expect(hermes.approvalProfileId).toBe("dangerously_skip_permissions");
    expect(skill?.content).toContain("dangerously_skip_permissions");
    expect(skill?.content).toContain(
      "every selected provider-supported Outlook tool skips Relay Console per-action approval",
    );
    expect(skill?.content).not.toContain("Safe Operator");
    expect(index?.content).toContain("Install Policy Override");
    expect(index?.content).toContain(
      "Only claim an action after the Outlook tool returns provider evidence",
    );
    expect(index?.content).not.toContain("approved sending");
    expect(index?.content).not.toContain("approval-gated");
  });
});

describe("MarketplaceService install updates", () => {
  it("updates one active marketplace install per workspace app agent role and runtime target", async () => {
    const service = createMarketplaceService();
    const existingCurrent = {
      id: "install-current",
      workspaceId: "workspace-1",
      appSlug: "github",
      connectionId: "connection-old",
      agentId: "agent-1",
      packId: "pack-old",
      agentDocumentationInstallId: "agent-doc-old",
      role: "worker",
      selectedCapabilities: ["read"],
      installStatus: "installed",
      driftStatus: "current",
      lastInstalledAt: new Date("2026-05-13T09:00:00.000Z"),
      createdAt: new Date("2026-05-13T08:00:00.000Z"),
      updatedAt: new Date("2026-05-13T09:00:00.000Z"),
      metadata: { runtimeFormat: "hermes" },
    };
    const existingDuplicate = {
      ...existingCurrent,
      id: "install-duplicate",
      installStatus: "failed",
      driftStatus: "unknown",
      updatedAt: new Date("2026-05-13T09:30:00.000Z"),
    };
    const { repo: marketplaceInstallRepo, queryBuilder } =
      createMarketplaceInstallRepoMock([existingDuplicate, existingCurrent]);
    (service as any).marketplaceInstallRepo = marketplaceInstallRepo;

    const saved = await (service as any).saveUniqueActiveMarketplaceInstall({
      workspaceId: "workspace-1",
      appSlug: "github",
      connectionId: "connection-new",
      agentId: "agent-1",
      packId: "pack-new",
      agentDocumentationInstallId: "agent-doc-new",
      role: "worker",
      selectedCapabilities: ["read", "write"],
      installStatus: "requested",
      driftStatus: "unknown",
      lastInstalledAt: null,
      metadata: {
        runtimeFormat: "hermes",
        approvalProfileId: "github_safe_operator",
      },
    });

    expect(marketplaceInstallRepo.manager.transaction).toHaveBeenCalledTimes(1);
    expect(queryBuilder.setLock).toHaveBeenCalledWith("pessimistic_write");
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      `COALESCE(install.metadata ->> 'runtimeFormat', 'openclaw') = :runtimeFormat`,
      { runtimeFormat: "hermes" },
    );
    expect(marketplaceInstallRepo.create).not.toHaveBeenCalled();
    expect(marketplaceInstallRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "install-duplicate",
        installStatus: "removed",
        driftStatus: "superseded",
        metadata: expect.objectContaining({
          supersededByActiveInstallUniqueness: true,
          runtimeFormat: "hermes",
        }),
      }),
    ]);
    expect(saved).toEqual(
      expect.objectContaining({
        id: "install-current",
        connectionId: "connection-new",
        packId: "pack-new",
        agentDocumentationInstallId: "agent-doc-new",
        selectedCapabilities: ["read", "write"],
        installStatus: "requested",
        metadata: expect.objectContaining({
          runtimeFormat: "hermes",
          approvalProfileId: "github_safe_operator",
        }),
      }),
    );
  });

  it("dedupes active runtime payload installs by app, agent, role, and runtime target", () => {
    const service = createMarketplaceService();
    const githubOld = {
      id: "github-old",
      workspaceId: "workspace-1",
      appSlug: "github",
      agentId: "agent-1",
      role: "worker",
      installStatus: "installed",
      createdAt: new Date("2026-05-13T08:00:00.000Z"),
      updatedAt: new Date("2026-05-13T08:00:00.000Z"),
      metadata: { runtimeFormat: "hermes" },
    };
    const installs = [
      githubOld,
      {
        ...githubOld,
        id: "github-new",
        updatedAt: new Date("2026-05-13T10:00:00.000Z"),
      },
      {
        ...githubOld,
        id: "github-openclaw",
        metadata: { runtimeFormat: "openclaw" },
      },
      {
        ...githubOld,
        id: "linear-hermes",
        appSlug: "linear",
      },
      {
        ...githubOld,
        id: "github-removed",
        installStatus: "removed",
        updatedAt: new Date("2026-05-13T11:00:00.000Z"),
      },
    ];

    const latest = (service as any).latestActiveMarketplaceInstallsByTarget(
      installs,
    );
    const ids = latest.map((install: { id: string }) => install.id);

    expect(ids).toContain("github-new");
    expect(ids).toContain("github-openclaw");
    expect(ids).toContain("linear-hermes");
    expect(ids).not.toContain("github-old");
    expect(ids).not.toContain("github-removed");
  });

  it("persists the bounded read capabilities for an existing Outlook install", async () => {
    const service = createMarketplaceService();
    allowMarketplaceInstallInternalsForTest(service);
    const install = {
      id: "install-1",
      workspaceId: "workspace-1",
      appSlug: "outlook",
      connectionId: "connection-1",
      selectedCapabilities: ["mail_folders_list", "inbox_messages_list"],
      metadata: {},
    };
    const connection = {
      id: "connection-1",
      workspaceId: "workspace-1",
      appSlug: "outlook",
      executionAuthority: "railway",
      metadata: {
        primaryMailboxAddress: "ops@example.com",
        senderIdentities: [
          {
            id: "primary",
            email: "ops@example.com",
            allowedForConnection: true,
            validationStatus: "verified",
          },
        ],
      },
    };
    const installRepo = {
      findOne: jest.fn().mockResolvedValue(install),
      save: jest.fn(async (input) => input),
    };
    const connectionRepo = {
      findOne: jest.fn().mockResolvedValue(connection),
    };
    const auditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    (service as any).marketplaceInstallRepo = installRepo;
    (service as any).connectionRepo = connectionRepo;
    (service as any).auditLogService = auditLogService;

    const saved = await service.updateInstall(
      "workspace-1",
      "user-1",
      "install-1",
      {
        selectedCapabilities: [
          "mail_folders_list",
          "inbox_messages_list",
          "unread_messages_list",
          "message_get",
          "not_a_real_capability",
        ],
      },
    );

    expect(saved.selectedCapabilities).toEqual([
      "mail_folders_list",
      "inbox_messages_list",
      "unread_messages_list",
      "message_get",
    ]);
    expect(installRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedCapabilities: [
          "mail_folders_list",
          "inbox_messages_list",
          "unread_messages_list",
          "message_get",
        ],
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          selectedCapabilities: [
            "mail_folders_list",
            "inbox_messages_list",
            "unread_messages_list",
            "message_get",
          ],
        }),
      }),
    );
  });

  it("rejects dangerous policy activation without its dedicated acknowledgement", async () => {
    const service = createMarketplaceService();
    allowMarketplaceInstallInternalsForTest(service);

    await expect(
      service.createLocalApp("workspace-1", "user-1", {
        name: "Dangerous local app",
        repoPath: "/apps/dangerous",
        autonomyPolicy: { mode: "dangerously_skip_permissions" },
      } as any),
    ).rejects.toThrow(/Explicitly acknowledge the warning/i);

    await expect(
      service.install("workspace-1", "user-1", {
        appSlug: "github",
        role: "worker",
        approvalProfileId: "dangerously_skip_permissions",
      } as any),
    ).rejects.toThrow(/Explicitly acknowledge the warning/i);
  });

  it("rejects approval profiles that do not belong to the selected app", async () => {
    const service = createMarketplaceService();
    allowMarketplaceInstallInternalsForTest(service);

    await expect(
      service.install("workspace-1", "user-1", {
        appSlug: "github",
        role: "worker",
        approvalProfileId: "invented_unbounded_policy",
      } as any),
    ).rejects.toThrow(/is not available for GitHub/i);
  });

  it("persists versioned acknowledgement evidence when an install switches to the dangerous policy", async () => {
    const service = createMarketplaceService();
    allowMarketplaceInstallInternalsForTest(service);
    const install = {
      id: "install-dangerous-1",
      workspaceId: "workspace-1",
      appSlug: "github",
      connectionId: null,
      selectedCapabilities: ["issues_read"],
      metadata: { approvalProfileId: "github_read_only" },
    };
    const installRepo = {
      findOne: jest.fn().mockResolvedValue(install),
      save: jest.fn(async (input) => input),
    };
    const auditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    (service as any).marketplaceInstallRepo = installRepo;
    (service as any).auditLogService = auditLogService;

    await expect(
      service.updateInstall("workspace-1", "user-1", "install-dangerous-1", {
        approvalProfileId: "dangerously_skip_permissions",
      }),
    ).rejects.toThrow(/Explicitly acknowledge the warning/i);

    const saved = await service.updateInstall(
      "workspace-1",
      "user-1",
      "install-dangerous-1",
      {
        approvalProfileId: "dangerously_skip_permissions",
        acknowledgeDangerouslySkipPermissions: true,
      },
    );

    expect(saved.metadata).toEqual(
      expect.objectContaining({
        approvalProfileId: "dangerously_skip_permissions",
        dangerousPolicyAcknowledged: true,
        dangerousPolicyAcknowledgedByUserId: "user-1",
        dangerousPolicyAcknowledgementVersion:
          "relay-marketplace-dangerous-policy-v1",
        dangerousPolicyPreservedInvariants: expect.arrayContaining([
          "workspace_and_connection_ownership",
          "provider_authentication_and_granted_authority",
          "selected_capabilities_and_blocked_actions",
          "secret_non_exposure",
        ]),
      }),
    );
    expect(saved.metadata.dangerousPolicyAcknowledgedAt).toEqual(
      expect.any(String),
    );
  });
});
