import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const KnowledgeDocumentsExecutors4 = {
  async executeSlab(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "slab",
      input.connectionId,
    );
    const credentials = this.slabCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("slab", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "slab.query")
      data = await this.slabGraphql.query(credentials, input.input);
    else if (name === "slab.mutate") {
      await this.requireConnectorApproval(
        input,
        connection,
        "graphql_mutation",
        "slab",
      );
      data = await this.slabGraphql.mutate(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.slab.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        operationName: this.stringOrNull(input.input.operationName),
      },
    });
    return this.ok(data, `Slab ${name.split(".")[1]} completed.`);
  },

  async executeSlackCanvas(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "slack-canvas",
      input.connectionId,
    );
    const credentials = this.slackCanvasCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("slack-canvas", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "slackCanvas.lookupSections")
      data = await this.slackCanvasApi.lookupSections(credentials, input.input);
    else if (name === "slackCanvas.draft")
      data = this.slackCanvasApi.draft(input.input);
    else if (name === "slackCanvas.create") {
      await this.requireConnectorApproval(
        input,
        connection,
        "canvas_write",
        "slack-canvas",
      );
      data = await this.slackCanvasApi.create(credentials, input.input);
    } else if (name === "slackCanvas.append") {
      await this.requireConnectorApproval(
        input,
        connection,
        "canvas_write",
        "slack-canvas",
      );
      data = await this.slackCanvasApi.append(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.slack-canvas.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        canvasId: this.stringOrNull(input.input.canvasId),
        providerSideEffect: name !== "slackCanvas.draft",
      },
    });
    return this.ok(data, `Slack Canvas ${name.split(".")[1]} completed.`);
  },

  async executeSlite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "slite",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("slite", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "slite.read") {
      data = await this.sliteMcp.callRead(token.accessToken, input.input);
    } else if (name === "slite.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "mcp_write",
        "slite",
      );
      data = await this.sliteMcp.callWrite(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.slite.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        remoteToolName: this.stringOrNull(input.input.toolName),
        capability: tool.capability,
      },
    });
    return this.ok(data, `Slite ${name.split(".")[1]} completed.`);
  },

  async executeSpotDraft(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "spotdraft",
      input.connectionId,
    );
    const tool = this.registry.getTool("spotdraft", input.toolName)!;
    if (tool.name !== "spotdraft.listRoles")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.spotDraftApi.listRoles(
      this.spotDraftCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.spotdraft.list_roles.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedClientCredentials: true,
        basicAuthorizationUsed: true,
        providerRequestCount: 1,
        maxResults: 100,
        usersReturned: false,
        membersReturned: false,
        contractsReturned: false,
        documentsReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "SpotDraft team roles listed.");
  },

  async executeStatamic(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "statamic",
      input.connectionId,
    );
    const credentials = this.statamicCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("statamic", input.toolName)!;
    if (tool.name !== "statamic.getSelectedEntryState")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.statamicApi.getSelectedEntryState(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.statamic.getSelectedEntryState.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        dedicatedRestApiTokenRequired: true,
        selectedCollectionAndEntryBound: true,
        fixedIndividualEntryRouteAndFieldsOnly: true,
        entryContentIdentityAndOtherSiteDataDiscarded: true,
        otherResourcesAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(data, "Statamic getSelectedEntryState completed.");
  },

  async executeStrapiSelfHosted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "strapi-self-hosted",
      input.connectionId,
    );
    const credentials = this.strapiSelfHostedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("strapi-self-hosted", input.toolName)!;
    if (tool.name !== "strapi-self-hosted.getSelectedDocumentLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.strapiSelfHostedApi.getSelectedDocumentLifecycle(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.strapi-self-hosted.getSelectedDocumentLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        strapi5Required: true,
        dedicatedCustomFindOneTokenRequired: true,
        selectedContentTypeAndDocumentBound: true,
        publishedLifecycleFieldsOnly: true,
        documentContentIdentityAndOtherProjectDataDiscarded: true,
        listsDraftsAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(
      data,
      "Strapi Self-Hosted getSelectedDocumentLifecycle completed.",
    );
  },

  async executeTettra(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "tettra",
      input.connectionId,
    );
    const credentials = this.tettraCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("tettra", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "tettra.search")
      data = await this.tettraApi.search(credentials, input.input);
    else if (name === "tettra.getCategoryItems")
      data = await this.tettraApi.getCategoryItems(credentials, input.input);
    else {
      await this.requireConnectorApproval(
        input,
        connection,
        name.split(".")[1],
        "tettra",
      );
      if (name === "tettra.createPage")
        data = await this.tettraApi.createPage(credentials, input.input);
      else if (name === "tettra.updatePage")
        data = await this.tettraApi.updatePage(credentials, input.input);
      else if (name === "tettra.createSuggestion")
        data = await this.tettraApi.createSuggestion(credentials, input.input);
      else if (name === "tettra.createQuestion")
        data = await this.tettraApi.createQuestion(credentials, input.input);
      else if (name === "tettra.createCategory")
        data = await this.tettraApi.createCategory(credentials, input.input);
      else
        return this.safeError(
          "tool_unavailable",
          `${input.toolName} is not implemented`,
        );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.tettra.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        pageId: this.stringOrNull(input.input.pageId),
        categoryId: this.stringOrNull(input.input.categoryId),
      },
    });
    return this.ok(data, `Tettra ${name.split(".")[1]} completed.`);
  },

  async executeTresorit(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "tresorit",
      input.connectionId,
    );
    const credentials = this.tresoritCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("tresorit", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      bucket: this.stringOrNull(input.input.bucket) ?? undefined,
      key: this.stringOrNull(input.input.key) ?? undefined,
      prefix: this.stringOrNull(input.input.prefix) ?? undefined,
      maxKeys: input.input.maxKeys,
      fileBase64: this.stringOrNull(input.input.fileBase64) ?? undefined,
      contentType: this.stringOrNull(input.input.contentType) ?? undefined,
      keys: Array.isArray(input.input.keys) ? input.input.keys : undefined,
    };
    let data: unknown;
    if (tool.name === "tresorit.read") {
      data = await this.tresoritS3.read(credentials, operation, operationInput);
    } else if (tool.name === "tresorit.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "tresorit_storage_write",
        "tresorit",
      );
      data = await this.tresoritS3.manage(
        credentials,
        operation,
        operationInput,
      );
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.tresorit.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation,
        bucket: this.stringOrNull(input.input.bucket),
        key: this.stringOrNull(input.input.key),
        keyCount: Array.isArray(input.input.keys) ? input.input.keys.length : 0,
      },
    });
    return this.ok(data, `Tresorit ${tool.name.split(".")[1]} completed.`);
  },

  async executeVivaLearning(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "viva-learning",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("viva-learning", input.toolName)!;
    if (tool.name !== "viva-learning.listProviders")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.vivaLearningGraph.read(
      token.accessToken,
      operation,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.viva_learning.providers_read",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Viva Learning providers listed.");
  },

  async executeZohoWorkDrive(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho-workdrive",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("zoho-workdrive", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const origins = {
      apiOrigin: this.requiredString(
        connection.metadata?.zohoWorkDriveApiOrigin,
        "Zoho WorkDrive API origin",
      ),
      downloadOrigin: this.requiredString(
        connection.metadata?.zohoWorkDriveDownloadOrigin,
        "Zoho WorkDrive download origin",
      ),
      uploadOrigin: this.requiredString(
        connection.metadata?.zohoWorkDriveUploadOrigin,
        "Zoho WorkDrive upload origin",
      ),
    };
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      headers: this.objectOrNull(input.input.headers) ?? undefined,
      body: this.objectOrNull(input.input.body) ?? undefined,
      contentBase64: this.stringOrNull(input.input.contentBase64) ?? undefined,
      fileName: this.stringOrNull(input.input.fileName) ?? undefined,
      mimeType: this.stringOrNull(input.input.mimeType) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "zohoWorkDrive.read") {
      data = await this.zohoWorkDriveApi.read(
        token.accessToken,
        origins,
        operation,
        operationInput,
      );
    } else if (tool.name === "zohoWorkDrive.manageContent") {
      await this.requireConnectorApproval(
        input,
        connection,
        "workdrive_content_write",
        "zoho-workdrive",
      );
      data = await this.zohoWorkDriveApi.manageContent(
        token.accessToken,
        origins,
        operation,
        operationInput,
      );
    } else if (tool.name === "zohoWorkDrive.admin") {
      await this.requireConnectorApproval(
        input,
        connection,
        "workdrive_admin",
        "zoho-workdrive",
      );
      data = await this.zohoWorkDriveApi.admin(
        token.accessToken,
        origins,
        operation,
        operationInput,
      );
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.zoho-workdrive.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(
      data,
      `Zoho WorkDrive ${tool.name.split(".")[1]} completed.`,
    );
  },
};

export const KnowledgeDocumentsExecutors4Registrations = {
  slab: { methodName: "executeSlab", needsConnection: false },
  "slack-canvas": { methodName: "executeSlackCanvas", needsConnection: false },
  slite: { methodName: "executeSlite", needsConnection: false },
  spotdraft: { methodName: "executeSpotDraft", needsConnection: false },
  statamic: { methodName: "executeStatamic", needsConnection: false },
  "strapi-self-hosted": {
    methodName: "executeStrapiSelfHosted",
    needsConnection: false,
  },
  tettra: { methodName: "executeTettra", needsConnection: false },
  tresorit: { methodName: "executeTresorit", needsConnection: false },
  "viva-learning": {
    methodName: "executeVivaLearning",
    needsConnection: false,
  },
  "zoho-workdrive": {
    methodName: "executeZohoWorkDrive",
    needsConnection: false,
  },
} satisfies NativeExecutorRegistrationMap<typeof KnowledgeDocumentsExecutors4>;
