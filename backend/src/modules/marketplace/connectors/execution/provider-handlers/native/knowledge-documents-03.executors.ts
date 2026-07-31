import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { MarketplaceConnectionEntity } from "../../../../../../entities";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const KnowledgeDocumentsExecutors3 = {
  async executeLinkSquares(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "linksquares",
      input.connectionId,
    );
    const tool = this.registry.getTool("linksquares", input.toolName)!;
    if (tool.name !== "linksquares.listAgreementTypes")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.linkSquaresApi.listAgreementTypes(
      this.linkSquaresCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.linksquares.list_agreement_types.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedApiKey: true,
        broadAdministratorKey: true,
        serviceAccountRecommended: true,
        providerRequestCount: 1,
        maxResults: 100,
        agreementDataReturned: false,
        termsReturned: false,
        tagsReturned: false,
        filesReturned: false,
        peopleReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "LinkSquares agreement types listed.");
  },

  async executeLogseq(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
  ) {
    if (!this.logseqCli)
      return this.safeError(
        "tool_unavailable",
        "Logseq source-host executor is not registered",
      );
    const tool = this.registry.getTool("logseq", input.toolName);
    if (!tool)
      return this.safeError(
        "tool_unavailable",
        "Logseq tool is not registered",
      );
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "logseq",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    const result = await this.logseqCli.execute({
      workspaceId: input.workspaceId,
      toolName: tool.functionName,
      credentials: this.logseqCredentials(connection),
      payload,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.logseq.${tool.functionName}.completed`,
      resourceId: connection.id,
      metadata: {
        ...(result.auditMetadata ?? {}),
        sourceHostBound: true,
        graphBound: true,
      },
    });
    return result;
  },

  async executeMem(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mem",
      input.connectionId,
    );
    const credentials = this.memCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("mem", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "mem.listNotes")
      data = await this.memApi.listNotes(credentials, input.input);
    else if (name === "mem.searchNotes")
      data = await this.memApi.searchNotes(credentials, input.input);
    else if (name === "mem.getNote")
      data = await this.memApi.getNote(credentials, input.input);
    else if (name === "mem.request") {
      await this.requireConnectorApproval(input, connection, "full_api", "mem");
      data = await this.memApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        json: this.objectOrNull(input.input.json) ?? undefined,
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mem.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        noteId: this.stringOrNull(input.input.noteId),
      },
    });
    return this.ok(data, `Mem ${name.split(".")[1]} completed.`);
  },

  async executeMicrosoftPowerBI(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-power-bi",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const binding = this.microsoftPowerBIBinding(connection);
    const tool = this.registry.getTool("microsoft-power-bi", input.toolName)!;
    let data: unknown;
    if (tool.name === "microsoft-power-bi.getWorkspace")
      data = await this.microsoftPowerBIApi.getWorkspace(
        token.accessToken,
        binding,
      );
    else if (tool.name === "microsoft-power-bi.listReports")
      data = await this.microsoftPowerBIApi.listReports(
        token.accessToken,
        binding,
      );
    else if (tool.name === "microsoft-power-bi.listSemanticModels")
      data = await this.microsoftPowerBIApi.listSemanticModels(
        token.accessToken,
        binding,
      );
    else if (tool.name === "microsoft-power-bi.getSemanticModel")
      data = await this.microsoftPowerBIApi.getSemanticModel(
        token.accessToken,
        binding,
        input.input,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.microsoft_power_bi.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedWorkspaceIdHash: this.hash(binding.workspaceId),
        semanticModelIdHash: this.stringOrNull(input.input.semanticModelId)
          ? this.hash(this.stringOrNull(input.input.semanticModelId)!)
          : null,
        contentQueriesIdentitiesURLsExcluded: true,
        maxResults: 25,
      },
    });
    return this.ok(
      data,
      `Microsoft Power BI ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeFuseBase(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "nimbus-note",
      input.connectionId,
    );
    const credentials = this.fuseBaseCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("nimbus-note", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "fusebase.listTools")
      data = await this.fuseBaseMcp.listTools(credentials);
    else if (name === "fusebase.callReadTool")
      data = await this.fuseBaseMcp.callReadTool(credentials, input.input);
    else if (name === "fusebase.callTool") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_mcp",
        "nimbus-note",
      );
      data = await this.fuseBaseMcp.callTool(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.fusebase.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        remoteToolName: this.stringOrNull(input.input.toolName),
      },
    });
    return this.ok(data, `FuseBase ${name.split(".")[1]} completed.`);
  },

  async executeNotion(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "notion",
      input.connectionId,
    );
    const tool = this.registry.getTool("notion", input.toolName)!;
    if (tool.name === "relay_notion_draft_update") {
      const parentId = this.requiredString(input.input.parentId, "parentId");
      const target = this.requiredString(input.input.target, "target");
      if (!["page", "block"].includes(target))
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "target must be page or block",
        );
      const payload = input.input.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "payload must be an object",
        );
      const encoded = JSON.stringify(payload);
      if (encoded.length > 100_000)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "payload is too large",
        );
      return this.ok(
        {
          parentId,
          target,
          payload,
          payloadHash: this.hash(encoded),
          providerSideEffect: false,
        },
        "Notion update draft prepared locally.",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_notion_search")
      return this.ok(
        await this.notionApi.search(
          token.accessToken,
          input.input.query,
          input.input.maxResults,
        ),
        "Notion content search completed.",
      );
    if (tool.name === "relay_notion_get_page")
      return this.ok(
        await this.notionApi.getPage(token.accessToken, input.input.pageId),
        "Notion page read completed.",
      );
    if (tool.name === "relay_notion_get_block_children")
      return this.ok(
        await this.notionApi.getBlockChildren(
          token.accessToken,
          input.input.blockId,
          input.input.maxResults,
        ),
        "Notion page content read completed.",
      );
    if (tool.name === "relay_notion_create_page") {
      await this.requireNotionApproval(
        input,
        connection,
        "notion_page_create",
        input.input.parentId,
        {
          parentType: input.input.parentType,
          titlePropertyName: input.input.titlePropertyName,
          title: input.input.title,
          children: input.input.children ?? [],
        },
        input.input.idempotencyKey,
      );
      const result = await this.notionApi.createPage(token.accessToken, {
        parentType: input.input.parentType,
        parentId: input.input.parentId,
        titlePropertyName: input.input.titlePropertyName,
        title: input.input.title,
        children: input.input.children,
        idempotencyKey: input.input.idempotencyKey,
      });
      await this.auditNotionWrite(
        input,
        connection,
        "page.created",
        input.input.parentId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Notion page created.");
    }
    if (tool.name === "relay_notion_append_blocks") {
      await this.requireNotionApproval(
        input,
        connection,
        "notion_block_children_append",
        input.input.blockId,
        { children: input.input.children },
        input.input.idempotencyKey,
      );
      const result = await this.notionApi.appendBlocks(token.accessToken, {
        blockId: input.input.blockId,
        children: input.input.children,
        idempotencyKey: input.input.idempotencyKey,
      });
      await this.auditNotionWrite(
        input,
        connection,
        "blocks.appended",
        input.input.blockId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Notion content appended.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeNuclino(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "nuclino",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("nuclino", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "nuclino.read") {
      data = await this.nuclinoMcp.callRead(token.accessToken, input.input);
    } else if (name === "nuclino.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "mcp_write",
        "nuclino",
      );
      data = await this.nuclinoMcp.callWrite(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.nuclino.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        remoteToolName: this.stringOrNull(input.input.toolName),
        capability: tool.capability,
      },
    });
    return this.ok(data, `Nuclino ${name.split(".")[1]} completed.`);
  },

  async executeObsidian(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
  ) {
    if (!this.obsidianCli)
      return this.safeError(
        "tool_unavailable",
        "Obsidian source-host executor is not registered",
      );
    const tool = this.registry.getTool("obsidian", input.toolName);
    if (!tool)
      return this.safeError(
        "tool_unavailable",
        "Obsidian tool is not registered",
      );
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "obsidian",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    const result = await this.obsidianCli.execute({
      workspaceId: input.workspaceId,
      toolName: tool.functionName,
      credentials: this.obsidianCredentials(connection),
      payload,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.obsidian.${tool.functionName}.completed`,
      resourceId: connection.id,
      metadata: {
        ...(result.auditMetadata ?? {}),
        sourceHostBound: true,
        vaultBound: true,
      },
    });
    return result;
  },

  async executeOneDrive(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "onedrive",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("onedrive", input.toolName)!;
    let data: unknown;
    if (tool.name === "onedrive.getDrive")
      data = await this.oneDriveApi.getDrive(token.accessToken);
    else if (tool.name === "onedrive.listRootItems")
      data = await this.oneDriveApi.listRootItems(token.accessToken);
    else if (tool.name === "onedrive.listFolderItems")
      data = await this.oneDriveApi.listFolderItems(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "onedrive.getItem")
      data = await this.oneDriveApi.getItem(token.accessToken, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.onedrive.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        folderIdHash: this.stringOrNull(input.input.folderId)
          ? this.hash(this.stringOrNull(input.input.folderId)!)
          : null,
        itemIdHash: this.stringOrNull(input.input.itemId)
          ? this.hash(this.stringOrNull(input.input.itemId)!)
          : null,
        metadataOnly: true,
        maxResults: 25,
      },
    });
    return this.ok(data, `OneDrive ${tool.name.split(".")[1]} completed.`);
  },

  async executeOneNote(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "onenote",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("onenote", input.toolName)!;
    let data: unknown;
    if (tool.name === "onenote.listNotebooks")
      data = await this.oneNoteApi.listNotebooks(token.accessToken);
    else if (tool.name === "onenote.listSections")
      data = await this.oneNoteApi.listSections(token.accessToken, input.input);
    else if (tool.name === "onenote.listPages")
      data = await this.oneNoteApi.listPages(token.accessToken, input.input);
    else if (tool.name === "onenote.getPage")
      data = await this.oneNoteApi.getPage(token.accessToken, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.onenote.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        notebookIdHash: this.stringOrNull(input.input.notebookId)
          ? this.hash(this.stringOrNull(input.input.notebookId)!)
          : null,
        sectionIdHash: this.stringOrNull(input.input.sectionId)
          ? this.hash(this.stringOrNull(input.input.sectionId)!)
          : null,
        pageIdHash: this.stringOrNull(input.input.pageId)
          ? this.hash(this.stringOrNull(input.input.pageId)!)
          : null,
        pageContentExcluded: true,
        identitiesExcluded: true,
        sharedGroupSiteExcluded: true,
        maxResults: 25,
      },
    });
    return this.ok(data, `OneNote ${tool.name.split(".")[1]} completed.`);
  },

  async executeOneSpanSign(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "onespan-sign",
      input.connectionId,
    );
    const credentials = this.oneSpanSignCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("onespan-sign", input.toolName)!;
    let data: unknown;
    if (tool.name === "onespan_sign.listTransactions")
      data = await this.oneSpanSignApi.listTransactions(
        credentials,
        input.input,
      );
    else if (tool.name === "onespan_sign.getTransaction")
      data = await this.oneSpanSignApi.getTransaction(credentials, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.onespan-sign.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedClientCredentials: true,
        oauthScopesAvailable: false,
        refreshTokensSupported: false,
        maxResults: tool.name.endsWith("listTransactions") ? 25 : 1,
        peopleReturned: false,
        documentsReturned: false,
        signingUrlsReturned: false,
        evidenceReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `OneSpan Sign ${tool.name.split(".")[1]} completed.`);
  },

  async executePandaDoc(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "pandadoc",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.pandaDocCredentials(
      { accessToken: token.accessToken },
      connection,
    );
    const tool = this.registry.getTool("pandadoc", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "pandadoc.listRecentDocuments") {
      action = "pandadoc_document_list_recent";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "pandadoc",
      );
      data = await this.pandaDocApi.listRecentDocuments(credentials);
    } else if (name === "pandadoc.getDocumentStatus") {
      action = "pandadoc_document_status_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "pandadoc",
      );
      data = await this.pandaDocApi.getDocumentStatus(credentials, {
        documentId: this.requiredString(input.input.documentId, "documentId"),
      });
    } else if (name === "pandadoc.listDocumentFolders") {
      action = "pandadoc_document_folder_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "pandadoc",
      );
      data = await this.pandaDocApi.listDocumentFolders(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.pandadoc.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        membershipIdHash: this.hash(credentials.membershipId),
        workspaceIdHash: this.hash(credentials.workspaceId),
        documentIdHash: this.stringOrNull(input.input.documentId)
          ? this.hash(this.stringOrNull(input.input.documentId)!)
          : null,
      },
    });
    return this.ok(data, `PandaDoc ${name.split(".")[1]} completed.`);
  },

  async executePCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "pcloud",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("pcloud", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const apiOrigin = this.requiredString(
      connection.metadata?.pCloudApiOrigin,
      "pCloud API authority",
    );
    const operationInput = {
      parameters: this.objectOrNull(input.input.parameters) ?? undefined,
      fileBase64: this.stringOrNull(input.input.fileBase64) ?? undefined,
      fileName: this.stringOrNull(input.input.fileName) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "pcloud.read") {
      data = await this.pCloudApi.read(
        token.accessToken,
        apiOrigin,
        operation,
        operationInput,
      );
    } else if (tool.name === "pcloud.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "pcloud_write",
        "pcloud",
      );
      data = await this.pCloudApi.write(
        token.accessToken,
        apiOrigin,
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
      eventType: `marketplace.pcloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `pCloud ${tool.name.split(".")[1]} completed.`);
  },

  async executeProposify(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "proposify",
      input.connectionId,
    );
    const tool = this.registry.getTool("proposify", input.toolName)!;
    if (tool.name !== "proposify.getDocument")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.proposifyApi.getDocument(
      this.proposifyCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.proposify.get_document.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedClientCredentials: true,
        exactScopes: ["read_documents"],
        providerRequestCount: 2,
        peopleReturned: false,
        contentReturned: false,
        clientDataReturned: false,
        signingDataReturned: false,
        linksReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Proposify document metadata retrieved.");
  },

  async executeQuip(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "quip",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("quip", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "quip.getCurrentUser")
      data = await this.quipApi.getCurrentUser(token.accessToken);
    else if (name === "quip.listThreads")
      data = await this.quipApi.listThreads(token.accessToken, input.input);
    else if (name === "quip.getThread")
      data = await this.quipApi.getThread(token.accessToken, input.input);
    else if (name === "quip.uploadBlob") {
      await this.requireConnectorApproval(
        input,
        connection,
        "quip_write",
        "quip",
      );
      data = await this.quipApi.uploadBlob(token.accessToken, input.input);
    } else if (name === "quip.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "quip_write_or_manage",
        "quip",
      );
      data = await this.quipApi.request(token.accessToken, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        form: this.objectOrNull(input.input.form) ?? undefined,
        json: this.objectOrNull(input.input.json) ?? undefined,
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.quip.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        threadId: this.stringOrNull(input.input.threadId),
      },
    });
    return this.ok(data, `Quip ${name.split(".")[1]} completed.`);
  },

  async executeQwilr(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "qwilr",
      input.connectionId,
    );
    const credentials = this.qwilrCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("qwilr", input.toolName)!;
    let data: unknown;
    if (tool.name === "qwilr.listSavedBlocks")
      data = await this.qwilrApi.listSavedBlocks(credentials, input.input);
    else if (tool.name === "qwilr.getPage")
      data = await this.qwilrApi.getPage(credentials, input.input);
    else if (tool.name === "qwilr.createPageDraft") {
      await this.requireConnectorApproval(
        input,
        connection,
        "qwilr_page_draft_create",
        "qwilr",
      );
      data = await this.qwilrApi.createPageDraft(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.qwilr.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedToken: true,
        broadAccountToken: true,
        maxResults: tool.name === "qwilr.listSavedBlocks" ? 50 : 1,
        published: false,
        contentReturned: false,
        peopleReturned: false,
        linksReturned: false,
        acceptanceReturned: false,
        paymentDataReturned: false,
        rawProviderResponseReturned: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Qwilr ${tool.name.split(".")[1]} completed.`);
  },

  async executeRaindrop(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const c = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "raindrop-io",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(c);
    const tool = this.registry.getTool("raindrop-io", input.toolName)!;
    const n = tool.name;
    let data: unknown;
    if (n === "raindrop.getUser")
      data = await this.raindropApi.getUser(token.accessToken);
    else if (n === "raindrop.listCollections")
      data = await this.raindropApi.listCollections(token.accessToken);
    else if (n === "raindrop.listBookmarks")
      data = await this.raindropApi.listBookmarks(
        token.accessToken,
        input.input,
      );
    else if (n === "raindrop.request") {
      await this.requireConnectorApproval(input, c, "full_api", "raindrop-io");
      data = await this.raindropApi.request(token.accessToken, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        json: this.objectOrNull(input.input.json) ?? undefined,
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.raindrop.${n.split(".")[1]}.executed`,
      resourceId: c.id,
      metadata: {
        toolName: n,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        collectionId: input.input.collectionId,
      },
    });
    return this.ok(data, `Raindrop.io ${n.split(".")[1]} completed.`);
  },

  async executeReadMe(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "readme",
      input.connectionId,
    );
    const credentials = this.readMeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("readme", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "readme.getProject") {
      data = await this.readMeApi.getProject(credentials);
    } else if (name === "readme.listBranches") {
      data = await this.readMeApi.listBranches(credentials, input.input);
    } else if (name === "readme.search") {
      data = await this.readMeApi.search(credentials, input.input);
    } else if (name === "readme.uploadImage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "upload_image",
        "readme",
      );
      data = await this.readMeApi.uploadImage(credentials, input.input);
    } else if (name === "readme.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "readme",
      );
      data = await this.readMeApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        json: this.objectOrNull(input.input.json) ?? undefined,
      });
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.readme.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        section: this.stringOrNull(input.input.section),
        filename: this.stringOrNull(input.input.filename),
      },
    });
    return this.ok(data, `ReadMe ${name.split(".")[1]} completed.`);
  },

  async executeReadwise(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "readwise",
      input.connectionId,
    );
    const credentials = this.readwiseCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("readwise", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "readwise.listDocuments")
      data = await this.readwiseApi.listDocuments(credentials, input.input);
    else if (name === "readwise.listHighlights")
      data = await this.readwiseApi.listHighlights(credentials, input.input);
    else if (name === "readwise.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "readwise",
      );
      data = await this.readwiseApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        json: this.objectOrNull(input.input.json) ?? undefined,
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.readwise.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Readwise ${name.split(".")[1]} completed.`);
  },

  async executeReflect(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "reflect",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("reflect", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "reflect.getMe")
      data = await this.reflectApi.getMe(token.accessToken);
    else if (name === "reflect.listGraphs")
      data = await this.reflectApi.listGraphs(token.accessToken);
    else if (name === "reflect.listBooks")
      data = await this.reflectApi.listBooks(token.accessToken, input.input);
    else if (name === "reflect.listLinks")
      data = await this.reflectApi.listLinks(token.accessToken, input.input);
    else if (name === "reflect.createLink") {
      await this.requireConnectorApproval(
        input,
        connection,
        "cloud_capture",
        "reflect",
      );
      data = await this.reflectApi.createLink(token.accessToken, input.input);
    } else if (name === "reflect.appendDailyNote") {
      await this.requireConnectorApproval(
        input,
        connection,
        "cloud_capture",
        "reflect",
      );
      data = await this.reflectApi.appendDailyNote(
        token.accessToken,
        input.input,
      );
    } else if (name === "reflect.createNote") {
      await this.requireConnectorApproval(
        input,
        connection,
        "cloud_capture",
        "reflect",
      );
      data = await this.reflectApi.createNote(token.accessToken, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.reflect.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        graphId: this.stringOrNull(input.input.graphId),
      },
    });
    return this.ok(data, `Reflect ${name.split(".")[1]} completed.`);
  },

  async executeRightSignature(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "rightsignature",
      input.connectionId,
    );
    const tool = this.registry.getTool("rightsignature", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "rightsignature.listDocuments")
      data = await this.rightSignatureApi.listDocuments(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "rightsignature.getDocument")
      data = await this.rightSignatureApi.getDocument(
        token.accessToken,
        input.input,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.rightsignature.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        exactScopes: ["read"],
        maxResults: tool.name.endsWith("listDocuments") ? 25 : 1,
        peopleReturned: false,
        filenamesReturned: false,
        documentsReturned: false,
        signingUrlsReturned: false,
        certificatesReturned: false,
        formFieldsReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      `RightSignature ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeRoamResearch(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
  ) {
    if (!this.roamResearchCli)
      return this.safeError(
        "tool_unavailable",
        "Roam Research source-host executor is not registered",
      );
    const tool = this.registry.getTool("roam-research", input.toolName);
    if (!tool)
      return this.safeError(
        "tool_unavailable",
        "Roam Research tool is not registered",
      );
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "roam-research",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    const result = await this.roamResearchCli.execute({
      workspaceId: input.workspaceId,
      toolName: tool.functionName,
      credentials: this.roamResearchCredentials(connection),
      payload,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.roam_research.${tool.functionName}.completed`,
      resourceId: connection.id,
      metadata: {
        ...(result.auditMetadata ?? {}),
        sourceHostBound: true,
        graphBound: true,
      },
    });
    return result;
  },

  async executeScribe(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "scribe",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("scribe", input.toolName)!;
    if (tool.name !== "scribe.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.scribeMcp.callRead(token.accessToken, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.scribe.read.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        remoteToolName: this.stringOrNull(input.input.toolName),
        capability: tool.capability,
      },
    });
    return this.ok(data, "Scribe read completed.");
  },

  async executeShareFile(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sharefile",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("sharefile", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const apiOrigin = this.requiredString(
      connection.metadata?.shareFileApiOrigin,
      "ShareFile API authority",
    );
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      body: this.objectOrNull(input.input.body) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "sharefile.read") {
      data = await this.shareFileApi.read(
        token.accessToken,
        apiOrigin,
        operation,
        operationInput,
      );
    } else if (tool.name === "sharefile.manageContent") {
      await this.requireConnectorApproval(
        input,
        connection,
        "sharefile_content_write",
        "sharefile",
      );
      data = await this.shareFileApi.manageContent(
        token.accessToken,
        apiOrigin,
        operation,
        operationInput,
      );
    } else if (tool.name === "sharefile.admin") {
      await this.requireConnectorApproval(
        input,
        connection,
        "sharefile_admin",
        "sharefile",
      );
      data = await this.shareFileApi.admin(
        token.accessToken,
        apiOrigin,
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
      eventType: `marketplace.sharefile.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `ShareFile ${tool.name.split(".")[1]} completed.`);
  },

  async executeSharePoint(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sharepoint",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const siteId = this.stringOrNull(
      connection.metadata?.sharepointSelectedSiteId,
    );
    if (!siteId)
      return this.safeError(
        "provider_validation_error",
        "SharePoint selected-site binding is missing",
      );
    const tool = this.registry.getTool("sharepoint", input.toolName)!;
    let data: unknown;
    if (tool.name === "sharepoint.getSite")
      data = await this.sharePointApi.getSite(token.accessToken, siteId);
    else if (tool.name === "sharepoint.listLists")
      data = await this.sharePointApi.listLists(token.accessToken, siteId);
    else if (tool.name === "sharepoint.listDrives")
      data = await this.sharePointApi.listDrives(token.accessToken, siteId);
    else if (tool.name === "sharepoint.listDefaultLibraryRoot")
      data = await this.sharePointApi.listDefaultLibraryRoot(
        token.accessToken,
        siteId,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.sharepoint.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedSiteIdHash: this.hash(siteId),
        metadataOnly: true,
        maxResults: 25,
      },
    });
    return this.ok(data, `SharePoint ${tool.name.split(".")[1]} completed.`);
  },

  async executeSigneasy(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "signeasy",
      input.connectionId,
    );
    const tool = this.registry.getTool("signeasy", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "signeasy.listEnvelopes")
      data = await this.signeasyApi.listEnvelopes(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "signeasy.getEnvelope")
      data = await this.signeasyApi.getEnvelope(token.accessToken, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.signeasy.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        exactScopes: ["rs:read", "offline_access"],
        maxResults: tool.name.endsWith("listEnvelopes") ? 25 : 1,
        peopleReturned: false,
        filesReturned: false,
        signingUrlsReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Signeasy ${tool.name.split(".")[1]} completed.`);
  },

  async executeSignNow(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "signnow",
      input.connectionId,
    );
    const tool = this.registry.getTool("signnow", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "signNow.listDocuments")
      data = await this.signNowApi.listDocuments(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "signNow.getDocument")
      data = await this.signNowApi.getDocument(token.accessToken, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.signnow.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        providerScopeIsBroad: true,
        relayReadOnlyProjection: true,
        maxResults: tool.name.endsWith("listDocuments") ? 25 : 1,
        participantIdentityReturned: false,
        documentContentReturned: false,
        signingSurfacesReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `SignNow ${tool.name.split(".")[1]} completed.`);
  },

  async executeSignRequest(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "signrequest",
      input.connectionId,
    );
    const tool = this.registry.getTool("signrequest", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "signRequest.listDocuments")
      data = await this.signRequestApi.listDocuments(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "signRequest.getDocument")
      data = await this.signRequestApi.getDocument(
        token.accessToken,
        input.input,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.signrequest.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        exactReadScope: true,
        maxResults: tool.name.endsWith("listDocuments") ? 25 : 1,
        peopleReturned: false,
        teamDataReturned: false,
        documentContentReturned: false,
        signingDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `SignRequest ${tool.name.split(".")[1]} completed.`);
  },
};

export const KnowledgeDocumentsExecutors3Registrations = {
  linksquares: { methodName: "executeLinkSquares", needsConnection: false },
  logseq: { methodName: "executeLogseq", needsConnection: true },
  mem: { methodName: "executeMem", needsConnection: false },
  "microsoft-power-bi": {
    methodName: "executeMicrosoftPowerBI",
    needsConnection: false,
  },
  "nimbus-note": { methodName: "executeFuseBase", needsConnection: false },
  notion: { methodName: "executeNotion", needsConnection: false },
  nuclino: { methodName: "executeNuclino", needsConnection: false },
  obsidian: { methodName: "executeObsidian", needsConnection: true },
  onedrive: { methodName: "executeOneDrive", needsConnection: false },
  onenote: { methodName: "executeOneNote", needsConnection: false },
  "onespan-sign": { methodName: "executeOneSpanSign", needsConnection: false },
  pandadoc: { methodName: "executePandaDoc", needsConnection: false },
  pcloud: { methodName: "executePCloud", needsConnection: false },
  proposify: { methodName: "executeProposify", needsConnection: false },
  quip: { methodName: "executeQuip", needsConnection: false },
  qwilr: { methodName: "executeQwilr", needsConnection: false },
  "raindrop-io": { methodName: "executeRaindrop", needsConnection: false },
  readme: { methodName: "executeReadMe", needsConnection: false },
  readwise: { methodName: "executeReadwise", needsConnection: false },
  reflect: { methodName: "executeReflect", needsConnection: false },
  rightsignature: {
    methodName: "executeRightSignature",
    needsConnection: false,
  },
  "roam-research": { methodName: "executeRoamResearch", needsConnection: true },
  scribe: { methodName: "executeScribe", needsConnection: false },
  sharefile: { methodName: "executeShareFile", needsConnection: false },
  sharepoint: { methodName: "executeSharePoint", needsConnection: false },
  signeasy: { methodName: "executeSigneasy", needsConnection: false },
  signnow: { methodName: "executeSignNow", needsConnection: false },
  signrequest: { methodName: "executeSignRequest", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof KnowledgeDocumentsExecutors3>;
