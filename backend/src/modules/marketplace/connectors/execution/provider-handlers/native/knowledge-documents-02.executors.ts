import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { IroncladApiAdapter } from "../../../ironclad/ironclad-api.adapter";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const KnowledgeDocumentsExecutors2 = {
  async executeDrupal(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "drupal",
      input.connectionId,
    );
    const credentials = this.drupalCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("drupal", input.toolName)!;
    if (tool.name !== "drupal.getSelectedNodeLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.drupalApi.getSelectedNodeLifecycle(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.drupal.getSelectedNodeLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        publicCoreJsonApiOnly: true,
        selectedNodeBundleAndUuidBound: true,
        sparseLifecycleFieldsetOnly: true,
        contentIdentityRelationshipsAndFilesExcluded: true,
        authenticationAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(data, "Drupal getSelectedNodeLifecycle completed.");
  },

  async executeEgnyte(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "egnyte",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("egnyte", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const domain = this.requiredString(
      connection.metadata?.egnyteDomain,
      "Egnyte domain",
    );
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
    if (tool.name === "egnyte.read") {
      data = await this.egnyteApi.read(
        token.accessToken,
        domain,
        operation,
        operationInput,
      );
    } else if (tool.name === "egnyte.manageContent") {
      await this.requireConnectorApproval(
        input,
        connection,
        "egnyte_content_write",
        "egnyte",
      );
      data = await this.egnyteApi.manageContent(
        token.accessToken,
        domain,
        operation,
        operationInput,
      );
    } else if (tool.name === "egnyte.admin") {
      await this.requireConnectorApproval(
        input,
        connection,
        "egnyte_admin",
        "egnyte",
      );
      data = await this.egnyteApi.admin(
        token.accessToken,
        domain,
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
      eventType: `marketplace.egnyte.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Egnyte ${tool.name.split(".")[1]} completed.`);
  },

  async executeEvernote(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "evernote",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = { accessToken: token.accessToken };
    const tool = this.registry.getTool("evernote", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "evernote.getProfile")
      data = await this.evernoteApi.getProfile(credentials);
    else if (name === "evernote.listNotebooks")
      data = await this.evernoteApi.listNotebooks(credentials);
    else if (name === "evernote.searchNotes")
      data = await this.evernoteApi.searchNotes(credentials, input.input);
    else if (name === "evernote.getNote")
      data = await this.evernoteApi.getNote(credentials, input.input);
    else if (name === "evernote.listTags")
      data = await this.evernoteApi.listTags(credentials);
    else if (name === "evernote.createNote") {
      await this.requireConnectorApproval(
        input,
        connection,
        "create_note",
        "evernote",
      );
      data = await this.evernoteApi.createNote(credentials, input.input);
    } else if (name === "evernote.updateNote") {
      await this.requireConnectorApproval(
        input,
        connection,
        "update_note",
        "evernote",
      );
      data = await this.evernoteApi.updateNote(credentials, input.input);
    } else if (name === "evernote.deleteNote") {
      await this.requireConnectorApproval(
        input,
        connection,
        "delete_note",
        "evernote",
      );
      data = await this.evernoteApi.deleteNote(credentials, input.input);
    } else if (name === "evernote.invoke") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "evernote",
      );
      data = await this.evernoteApi.invoke(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.evernote.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        userId: this.stringOrNull(connection.metadata?.evernoteUserId),
      },
    });
    return this.ok(data, `Evernote ${name.split(".")[1]} completed.`);
  },

  async executeExa(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "exa-search",
      input.connectionId,
    );
    const stored = this.credentials.decrypt(connection);
    const apiKey = this.stringOrNull(stored?.EXA_API_KEY);
    if (!apiKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Exa API key is missing.",
      );
    const tool = this.registry.getTool("exa-search", input.toolName)!;
    const name = tool.name;
    if (this.isBlockedExaRequest(input.input)) {
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.exa.action.failed",
        resourceId: connection.id,
        metadata: {
          toolName: name,
          status: "policy_blocked",
          capability: tool.capability,
        },
      });
      throw new ConnectorExecutionError(
        "policy_blocked",
        "Exa request is blocked by marketplace policy.",
      );
    }
    if (name === "exa.search") {
      const data = await this.exaApi.search(apiKey, input.input);
      const shaped = this.shapeExaSearchResponse(data);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.exa.search.executed",
        resourceId: connection.id,
        metadata: this.safeExaAudit(input, tool, shaped),
      });
      return this.ok(shaped, "Exa search completed.");
    }
    if (name === "exa.getContents") {
      if (this.stringArray(input.input.urls).length > 10) {
        throw new ConnectorExecutionError(
          "approval_required",
          "Bulk Exa content extraction requires approval.",
        );
      }
      const data = await this.exaApi.getContents(apiKey, input.input);
      const shaped = this.shapeExaContentsResponse(data);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.exa.contents.fetched",
        resourceId: connection.id,
        metadata: this.safeExaAudit(input, tool, shaped),
      });
      return this.ok(shaped, "Exa contents fetched.");
    }
    if (name === "exa.findSimilar") {
      const data = await this.exaApi.findSimilar(apiKey, input.input);
      const shaped = this.shapeExaSearchResponse(data);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.exa.similar.found",
        resourceId: connection.id,
        metadata: this.safeExaAudit(input, tool, shaped),
      });
      return this.ok(shaped, "Exa similar pages found.");
    }
    if (name === "exa.answer") {
      const data = await this.exaApi.answer(apiKey, input.input);
      const shaped = this.shapeExaAnswerResponse(data);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.exa.answer.generated",
        resourceId: connection.id,
        metadata: this.safeExaAudit(input, tool, shaped),
      });
      return this.ok(shaped, "Exa answer generated.");
    }
    if (name === "exa.research") {
      await this.requireConnectorApproval(
        input,
        connection,
        "deep_research",
        "exa-search",
      );
      const data = await this.exaApi.research(apiKey, input.input);
      const shaped = this.shapeExaResearchResponse(data);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.exa.research.executed",
        resourceId: connection.id,
        metadata: this.safeExaAudit(input, tool, shaped),
      });
      return this.ok(shaped, "Exa research completed.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeFeedly(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "feedly",
      input.connectionId,
    );
    const credentials = this.feedlyCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("feedly", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "feedly.getProfile")
      data = await this.feedlyApi.profile(credentials);
    else if (name === "feedly.listTeamFolders")
      data = await this.feedlyApi.listTeamFolders(credentials);
    else if (name === "feedly.collectArticles")
      data = await this.feedlyApi.collectArticles(credentials, input.input);
    else if (name === "feedly.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "feedly",
      );
      data = await this.feedlyApi.request(credentials, {
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
      eventType: `marketplace.feedly.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        streamId: this.stringOrNull(input.input.streamId),
      },
    });
    return this.ok(data, `Feedly ${name.split(".")[1]} completed.`);
  },

  async executeFilestack(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "filestack",
      input.connectionId,
    );
    const credentials = this.filestackCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("filestack", input.toolName)!;
    const operation = this.stringOrNull(input.input.operation);
    const operationInput = {
      handle: this.stringOrNull(input.input.handle) ?? undefined,
      filename: this.stringOrNull(input.input.filename) ?? undefined,
      contentBase64: this.stringOrNull(input.input.contentBase64) ?? undefined,
      contentType: this.stringOrNull(input.input.contentType) ?? undefined,
      includeExif: input.input.includeExif === true,
      taskChain: this.stringOrNull(input.input.taskChain) ?? undefined,
      workflowId: this.stringOrNull(input.input.workflowId) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "filestack.read") {
      data = await this.filestackApi.read(
        credentials,
        this.requiredString(operation, "operation"),
        operationInput,
      );
    } else if (tool.name === "filestack.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "filestack_file_manage",
        "filestack",
      );
      data = await this.filestackApi.manage(
        credentials,
        this.requiredString(operation, "operation"),
        operationInput,
      );
    } else if (tool.name === "filestack.process") {
      await this.requireConnectorApproval(
        input,
        connection,
        "filestack_file_process",
        "filestack",
      );
      data = await this.filestackApi.process(credentials, operationInput);
    } else if (tool.name === "filestack.runWorkflow") {
      await this.requireConnectorApproval(
        input,
        connection,
        "filestack_file_process",
        "filestack",
      );
      data = await this.filestackApi.runWorkflow(credentials, operationInput);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.filestack.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation,
        handle: this.stringOrNull(input.input.handle),
        workflowId: this.stringOrNull(input.input.workflowId),
      },
    });
    return this.ok(data, `Filestack ${tool.name.split(".")[1]} completed.`);
  },

  async executeFred(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "fred",
      input.connectionId,
    );
    const tool = this.registry.getTool("fred", input.toolName)!;
    const credentials = this.fredCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    let data: unknown;
    let eventType: string;
    if (tool.name === "relay_fred_search_series") {
      data = await this.fredApi.searchSeries(credentials, input.input.query);
      eventType = "marketplace.fred.series_search.executed";
    } else if (tool.name === "relay_fred_get_series_observations") {
      data = await this.fredApi.getSeriesObservations(
        credentials,
        input.input.seriesId,
        input.input.limit,
      );
      eventType = "marketplace.fred.series_observations_get.executed";
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        boundedPublicEconomicDataOnly: true,
        providerContentStored: false,
      },
    });
    return this.ok(data, "FRED economic data read completed.");
  },

  async executeGetAccept(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "getaccept",
      input.connectionId,
    );
    const tool = this.registry.getTool("getaccept", input.toolName)!;
    if (tool.name !== "getaccept.createDocumentDraft")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "getaccept_document_draft_create",
      "getaccept",
    );
    const data = await this.getAcceptApi.createDocumentDraft(
      this.getAcceptCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.getaccept.create_document_draft.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedToken: true,
        supportProvisioned: true,
        providerRequestCount: 1,
        recipientCount: Array.isArray(input.input.recipients)
          ? input.input.recipients.length
          : 0,
        customFieldCount: Array.isArray(input.input.customFields)
          ? input.input.customFields.length
          : 0,
        automaticSendingEnabled: false,
        sent: false,
        recipientIdentityReturned: false,
        fileUrlReturned: false,
        rawProviderResponseReturned: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "GetAccept document draft created without sending.");
  },

  async executeGoogleClassroom(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-classroom",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-classroom", input.toolName)!;
    if (connection.metadata?.requestingUserOnly !== true)
      return this.safeError(
        "connection_not_ready",
        "Google Classroom requires a requesting-user OAuth connection.",
      );
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "googleClassroom.listMyCourses")
      data = await this.googleClassroomApi.listMyCourses(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "googleClassroom.getCourse")
      data = await this.googleClassroomApi.getCourse(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "googleClassroom.listCoursework")
      data = await this.googleClassroomApi.listCoursework(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "googleClassroom.listMaterials")
      data = await this.googleClassroomApi.listMaterials(
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
      eventType: `marketplace.google-classroom.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        requestingUserOnly: true,
        readOnlyV1: true,
        maxResults: 25,
        rostersEnabled: false,
        profilesEnabled: false,
        studentSubmissionsGradesEnabled: false,
        guardiansInvitationsEnabled: false,
        writesEnabled: false,
        domainDelegationEnabled: false,
        previewEnabled: false,
        automaticPagination: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      `Google Classroom ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeGoogleDocs(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-docs",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-docs", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "googleDocs.prepareChange") {
      data = this.googleDocsApi.prepareChange(input.input);
    } else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "googleDocs.readDocument")
        data = await this.googleDocsApi.readDocument(
          token.accessToken,
          input.input,
        );
      else if (name === "googleDocs.createDocument") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_docs_create_document",
          "google-docs",
        );
        data = await this.googleDocsApi.createDocument(
          token.accessToken,
          input.input,
        );
      } else if (name === "googleDocs.applyChange") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_docs_apply_document_update",
          "google-docs",
        );
        data = await this.googleDocsApi.applyChange(
          token.accessToken,
          input.input,
        );
      } else
        return this.safeError(
          "tool_unavailable",
          `${input.toolName} is not implemented`,
        );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.google-docs.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        documentIdHash: this.stringOrNull(input.input.documentId)
          ? this.hash(this.stringOrNull(input.input.documentId)!)
          : null,
        idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Docs ${name.split(".")[1]} completed.`);
  },

  async executeGoogleDrive(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-drive",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-drive", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "googleDrive.prepareTextFile") {
      data = this.googleDriveApi.prepareTextFile(input.input);
    } else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "googleDrive.searchFiles")
        data = await this.googleDriveApi.searchFiles(
          token.accessToken,
          input.input,
        );
      else if (name === "googleDrive.getFile")
        data = await this.googleDriveApi.getFile(
          token.accessToken,
          input.input,
        );
      else if (name === "googleDrive.readText")
        data = await this.googleDriveApi.readText(
          token.accessToken,
          input.input,
        );
      else if (name === "googleDrive.createTextFile") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_drive_text_create",
          "google-drive",
        );
        data = await this.googleDriveApi.createTextFile(
          token.accessToken,
          input.input,
        );
      } else if (name === "googleDrive.copyFile") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_drive_file_copy",
          "google-drive",
        );
        data = await this.googleDriveApi.copyFile(
          token.accessToken,
          input.input,
        );
      } else
        return this.safeError(
          "tool_unavailable",
          `${input.toolName} is not implemented`,
        );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.google-drive.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        fileIdHash: this.stringOrNull(input.input.fileId)
          ? this.hash(this.stringOrNull(input.input.fileId)!)
          : null,
        parentFolderIdHash: this.stringOrNull(input.input.parentFolderId)
          ? this.hash(this.stringOrNull(input.input.parentFolderId)!)
          : null,
        queryHash: this.stringOrNull(input.input.query)
          ? this.hash(this.stringOrNull(input.input.query)!)
          : null,
        idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Drive ${name.split(".")[1]} completed.`);
  },

  async executeGoogleForms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-forms",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-forms", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "googleForms.prepareUpdate")
      data = this.googleFormsApi.prepareUpdate(input.input);
    else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "googleForms.getForm")
        data = await this.googleFormsApi.getForm(
          token.accessToken,
          input.input,
        );
      else if (name === "googleForms.createForm") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_forms_form_create",
          "google-forms",
        );
        data = await this.googleFormsApi.createForm(
          token.accessToken,
          input.input,
        );
      } else if (name === "googleForms.createQuestion") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_forms_question_create",
          "google-forms",
        );
        data = await this.googleFormsApi.createQuestion(
          token.accessToken,
          input.input,
        );
      } else
        return this.safeError(
          "tool_unavailable",
          `${input.toolName} is not implemented`,
        );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.google-forms.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        formIdHash: this.stringOrNull(input.input.formId)
          ? this.hash(this.stringOrNull(input.input.formId)!)
          : null,
        idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
        responsesAccessed: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Forms ${name.split(".")[1]} completed.`);
  },

  async executeGoogleSheets(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-sheets",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-sheets", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "googleSheets.prepareValues") {
      data = this.googleSheetsApi.prepareValues(input.input);
    } else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "googleSheets.getSpreadsheet")
        data = await this.googleSheetsApi.getSpreadsheet(
          token.accessToken,
          input.input,
        );
      else if (name === "googleSheets.getValues")
        data = await this.googleSheetsApi.getValues(
          token.accessToken,
          input.input,
        );
      else if (name === "googleSheets.updateValues") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_sheets_values_update",
          "google-sheets",
        );
        data = await this.googleSheetsApi.updateValues(
          token.accessToken,
          input.input,
        );
      } else if (name === "googleSheets.appendValues") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_sheets_values_append",
          "google-sheets",
        );
        data = await this.googleSheetsApi.appendValues(
          token.accessToken,
          input.input,
        );
      } else
        return this.safeError(
          "tool_unavailable",
          `${input.toolName} is not implemented`,
        );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.google-sheets.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        spreadsheetIdHash: this.stringOrNull(input.input.spreadsheetId)
          ? this.hash(this.stringOrNull(input.input.spreadsheetId)!)
          : null,
        rangeHash: this.stringOrNull(input.input.range)
          ? this.hash(this.stringOrNull(input.input.range)!)
          : null,
        idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Sheets ${name.split(".")[1]} completed.`);
  },

  async executeGuru(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "guru",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("guru", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "guru.listTeams")
      data = await this.guruApi.listTeams(token.accessToken);
    else if (name === "guru.searchCards")
      data = await this.guruApi.searchCards(token.accessToken, input.input);
    else if (name === "guru.listKnowledgeAgents")
      data = await this.guruMcp.listAgents(token.accessToken);
    else if (name === "guru.ask")
      data = await this.guruMcp.ask(token.accessToken, input.input);
    else if (name === "guru.searchKnowledge")
      data = await this.guruMcp.search(token.accessToken, input.input);
    else if (name === "guru.createDraft") {
      await this.requireConnectorApproval(
        input,
        connection,
        "create_draft",
        "guru",
      );
      data = await this.guruMcp.createDraft(token.accessToken, input.input);
    } else if (name === "guru.updateCard") {
      await this.requireConnectorApproval(
        input,
        connection,
        "update_card",
        "guru",
      );
      data = await this.guruMcp.updateCard(token.accessToken, input.input);
    } else if (name === "guru.uploadFile") {
      await this.requireConnectorApproval(
        input,
        connection,
        "upload_file",
        "guru",
      );
      data = await this.guruApi.uploadFile(token.accessToken, input.input);
    } else if (name === "guru.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "guru",
      );
      data = await this.guruApi.request(token.accessToken, {
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
      eventType: `marketplace.guru.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        cardId: this.stringOrNull(input.input.cardId),
        agentId: this.stringOrNull(input.input.agentId),
      },
    });
    return this.ok(data, `Guru ${name.split(".")[1]} completed.`);
  },

  async executeHightail(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "hightail",
      input.connectionId,
    );
    const tool = this.registry.getTool("hightail", input.toolName)!;
    if (tool.name !== "hightail.sendFiles") {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.requireConnectorApproval(
      input,
      connection,
      "hightail_file_send",
      "hightail",
    );
    const data = await this.hightailApi.sendFiles(
      this.hightailCredentials(this.credentials.decrypt(connection)),
      {
        files: input.input.files,
        recipients: input.input.recipients,
        subject: this.stringOrNull(input.input.subject) ?? undefined,
        message: this.stringOrNull(input.input.message) ?? undefined,
        sendEmail: input.input.sendEmail,
        sendReceiptRequested: input.input.sendReceiptRequested,
        downloadReceiptRequested: input.input.downloadReceiptRequested,
        verifyRecipient: input.input.verifyRecipient,
        allowComment: input.input.allowComment,
        preventDownload: input.input.preventDownload,
        expiresAt: input.input.expiresAt,
        accessCode: this.stringOrNull(input.input.accessCode) ?? undefined,
      },
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.hightail.send_files.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        fileCount: Array.isArray(input.input.files)
          ? input.input.files.length
          : 0,
        recipientCount: Array.isArray(input.input.recipients)
          ? input.input.recipients.length
          : 0,
      },
    });
    return this.ok(data, "Hightail files sent.");
  },

  async executeImgix(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "imgix",
      input.connectionId,
    );
    const credentials = this.imgixCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("imgix", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      sourceId: this.stringOrNull(input.input.sourceId) ?? undefined,
      originPath: this.stringOrNull(input.input.originPath) ?? undefined,
      sessionId: this.stringOrNull(input.input.sessionId) ?? undefined,
      reportId: this.stringOrNull(input.input.reportId) ?? undefined,
      query:
        input.input.query &&
        typeof input.input.query === "object" &&
        !Array.isArray(input.input.query)
          ? (input.input.query as Record<string, unknown>)
          : undefined,
      attributes:
        input.input.attributes &&
        typeof input.input.attributes === "object" &&
        !Array.isArray(input.input.attributes)
          ? (input.input.attributes as Record<string, unknown>)
          : undefined,
      contentBase64: this.stringOrNull(input.input.contentBase64) ?? undefined,
      contentType: this.stringOrNull(input.input.contentType) ?? undefined,
      overwrite: input.input.overwrite === true,
      url: this.stringOrNull(input.input.url) ?? undefined,
      subImage: input.input.subImage === true,
    };
    let data: unknown;
    if (tool.name === "imgix.read") {
      data = await this.imgixApi.read(credentials, operation, operationInput);
    } else if (tool.name === "imgix.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "imgix_media_manage",
        "imgix",
      );
      data = await this.imgixApi.manage(credentials, operation, operationInput);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.imgix.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation,
        sourceId: this.stringOrNull(input.input.sourceId),
        originPath: this.stringOrNull(input.input.originPath),
        reportId: this.stringOrNull(input.input.reportId),
      },
    });
    return this.ok(data, `Imgix ${tool.name.split(".")[1]} completed.`);
  },

  async executeInoreader(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "inoreader",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("inoreader", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "inoreader.getUserInfo")
      data = await this.inoreaderApi.getUserInfo(token.accessToken);
    else if (name === "inoreader.listSubscriptions")
      data = await this.inoreaderApi.listSubscriptions(token.accessToken);
    else if (name === "inoreader.listTags")
      data = await this.inoreaderApi.listTags(token.accessToken);
    else if (name === "inoreader.streamContents")
      data = await this.inoreaderApi.streamContents(
        token.accessToken,
        input.input,
      );
    else if (name === "inoreader.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "inoreader",
      );
      data = await this.inoreaderApi.request(token.accessToken, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        fields: this.objectOrNull(input.input.fields) ?? undefined,
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.inoreader.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        streamId: this.stringOrNull(input.input.streamId),
      },
    });
    return this.ok(data, `Inoreader ${name.split(".")[1]} completed.`);
  },

  async executeInstapaper(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "instapaper",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.instapaperCredentials(token.credentials);
    const tool = this.registry.getTool("instapaper", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "instapaper.verifyAccount")
      data = await this.instapaperApi.verifyAccount(credentials);
    else if (name === "instapaper.listBookmarks")
      data = await this.instapaperApi.listBookmarks(credentials, input.input);
    else if (name === "instapaper.listFolders")
      data = await this.instapaperApi.listFolders(credentials);
    else if (name === "instapaper.listHighlights")
      data = await this.instapaperApi.listHighlights(credentials, input.input);
    else if (name === "instapaper.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "instapaper",
      );
      data = await this.instapaperApi.request(
        credentials,
        this.requiredString(input.input.path, "path"),
        this.objectOrNull(input.input.fields) ?? {},
      );
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.instapaper.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        bookmarkId: input.input.bookmarkId,
      },
    });
    return this.ok(data, `Instapaper ${name.split(".")[1]} completed.`);
  },

  async executeIronclad(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ironclad",
      input.connectionId,
    );
    const tool = this.registry.getTool("ironclad", input.toolName)!;
    if (tool.name !== "ironclad.listWorkflowSchemas")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const credentials = this.ironcladCredentials(
      this.credentials.decrypt(connection),
    );
    const data = await this.ironcladApi.listWorkflowSchemas(
      credentials,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.ironclad.list_workflow_schemas.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedClientCredentials: true,
        exactScopes: [IroncladApiAdapter.SCOPE],
        exactEnvironmentBinding: true,
        boundAsUserId: credentials.asUserId,
        providerRequestCount: 2,
        maxResults: 50,
        schemaFieldsReturned: false,
        workflowDataReturned: false,
        contractDataReturned: false,
        peopleReturned: false,
        documentsReturned: false,
        writesEnabled: false,
        refreshTokensIssued: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Ironclad workflow schema metadata listed.");
  },

  async executeIroncladClickwrap(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ironclad-clickwrap",
      input.connectionId,
    );
    const credentials = this.ironcladClickwrapCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("ironclad-clickwrap", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "ironcladClickwrap.getSite") {
      action = "ironclad_clickwrap_site_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "ironclad-clickwrap",
      );
      data = await this.ironcladClickwrapApi.getSite(credentials);
    } else if (name === "ironcladClickwrap.listContracts") {
      action = "ironclad_clickwrap_contract_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "ironclad-clickwrap",
      );
      data = await this.ironcladClickwrapApi.listContracts(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "ironcladClickwrap.listGroups") {
      action = "ironclad_clickwrap_group_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "ironclad-clickwrap",
      );
      data = await this.ironcladClickwrapApi.listGroups(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
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
      eventType: `marketplace.ironclad_clickwrap.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        siteIdHash: this.hash(credentials.siteId),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Ironclad Clickwrap ${name.split(".")[1]} completed.`);
  },

  async executeJoomla(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "joomla",
      input.connectionId,
    );
    const credentials = this.joomlaCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("joomla", input.toolName)!;
    if (tool.name !== "joomla.getSelectedArticleLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.joomlaApi.getSelectedArticleLifecycle(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.joomla.getSelectedArticleLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        dedicatedReadOnlyApiUserRequired: true,
        selectedArticleIdBound: true,
        fixedCoreArticleRouteOnly: true,
        contentAndIdentityFieldsDiscarded: true,
        otherResourcesAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(data, "Joomla getSelectedArticleLifecycle completed.");
  },

  async executeJuro(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "juro",
      input.connectionId,
    );
    const credentials = this.juroCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("juro", input.toolName)!;
    let data: unknown;
    if (tool.name === "juro.listTemplates")
      data = await this.juroApi.listTemplates(credentials, input.input);
    else if (tool.name === "juro.getTemplate")
      data = await this.juroApi.getTemplate(credentials, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.juro.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedApiKey: true,
        broadAccountKey: true,
        exactEnvironmentBinding: true,
        customerManagedConsentRequired: true,
        providerRequestCount: 1,
        maxResults: tool.name === "juro.listTemplates" ? 50 : 1,
        linksReturned: false,
        fieldsReturned: false,
        questionsReturned: false,
        signingSidesReturned: false,
        approvalStateReturned: false,
        contractDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      tool.name === "juro.listTemplates"
        ? "Juro template metadata listed."
        : "Juro template metadata retrieved.",
    );
  },

  async executeKirbyCms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "kirby-cms",
      input.connectionId,
    );
    const credentials = this.kirbyCmsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("kirby-cms", input.toolName)!;
    if (tool.name !== "kirby-cms.getSelectedPageState")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.kirbyCmsApi.getSelectedPageState(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.kirby-cms.getSelectedPageState.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        dedicatedNonAdminReadOnlyUserRequired: true,
        selectedPageIdBound: true,
        fixedIndividualPageRouteAndSelectOnly: true,
        pageContentIdentityAndOtherSiteDataDiscarded: true,
        otherResourcesAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(data, "Kirby CMS getSelectedPageState completed.");
  },

  async executeKnowledgeOwl(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "knowledgeowl",
      input.connectionId,
    );
    const credentials = this.knowledgeOwlCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("knowledgeowl", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "knowledgeowl.listArticles")
      data = await this.knowledgeOwlApi.listArticles(credentials, input.input);
    else if (name === "knowledgeowl.getArticle")
      data = await this.knowledgeOwlApi.getArticle(credentials, input.input);
    else if (name === "knowledgeowl.listCategories")
      data = await this.knowledgeOwlApi.listCategories(
        credentials,
        input.input,
      );
    else if (name === "knowledgeowl.uploadFile") {
      await this.requireConnectorApproval(
        input,
        connection,
        "upload_file",
        "knowledgeowl",
      );
      data = await this.knowledgeOwlApi.uploadFile(credentials, input.input);
    } else if (name === "knowledgeowl.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "knowledgeowl",
      );
      data = await this.knowledgeOwlApi.request(credentials, {
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
      eventType: `marketplace.knowledgeowl.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        articleId: this.stringOrNull(input.input.articleId),
        filename: this.stringOrNull(input.input.filename),
      },
    });
    return this.ok(data, `KnowledgeOwl ${name.split(".")[1]} completed.`);
  },
};

export const KnowledgeDocumentsExecutors2Registrations = {
  drupal: { methodName: "executeDrupal", needsConnection: false },
  egnyte: { methodName: "executeEgnyte", needsConnection: false },
  evernote: { methodName: "executeEvernote", needsConnection: false },
  "exa-search": { methodName: "executeExa", needsConnection: false },
  feedly: { methodName: "executeFeedly", needsConnection: false },
  filestack: { methodName: "executeFilestack", needsConnection: false },
  fred: { methodName: "executeFred", needsConnection: false },
  getaccept: { methodName: "executeGetAccept", needsConnection: false },
  "google-classroom": {
    methodName: "executeGoogleClassroom",
    needsConnection: false,
  },
  "google-docs": { methodName: "executeGoogleDocs", needsConnection: false },
  "google-drive": { methodName: "executeGoogleDrive", needsConnection: false },
  "google-forms": { methodName: "executeGoogleForms", needsConnection: false },
  "google-sheets": {
    methodName: "executeGoogleSheets",
    needsConnection: false,
  },
  guru: { methodName: "executeGuru", needsConnection: false },
  hightail: { methodName: "executeHightail", needsConnection: false },
  imgix: { methodName: "executeImgix", needsConnection: false },
  inoreader: { methodName: "executeInoreader", needsConnection: false },
  instapaper: { methodName: "executeInstapaper", needsConnection: false },
  ironclad: { methodName: "executeIronclad", needsConnection: false },
  "ironclad-clickwrap": {
    methodName: "executeIroncladClickwrap",
    needsConnection: false,
  },
  joomla: { methodName: "executeJoomla", needsConnection: false },
  juro: { methodName: "executeJuro", needsConnection: false },
  "kirby-cms": { methodName: "executeKirbyCms", needsConnection: false },
  knowledgeowl: { methodName: "executeKnowledgeOwl", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof KnowledgeDocumentsExecutors2>;
