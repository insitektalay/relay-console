import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { MarketplaceConnectionEntity } from "../../../../../../entities";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";
import {
  CRAFT_MANAGE_OPERATIONS,
  CRAFT_READ_OPERATIONS,
} from "../../../craft/craft-api.adapter";

export const KnowledgeDocumentsExecutors1 = {
  async executeAdobeAcrobatSign(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "adobe-acrobat-sign",
      input.connectionId,
    );
    const tool = this.registry.getTool("adobe-acrobat-sign", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    const apiOrigin = this.requiredAdobeAcrobatSignApiOrigin(
      connection.metadata,
    );
    let data: unknown;
    if (tool.name === "adobeAcrobatSign.listAgreements")
      data = await this.adobeAcrobatSignApi.listAgreements(
        token.accessToken,
        apiOrigin,
        input.input,
      );
    else if (tool.name === "adobeAcrobatSign.getAgreement")
      data = await this.adobeAcrobatSignApi.getAgreement(
        token.accessToken,
        apiOrigin,
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
      eventType: `marketplace.adobe-acrobat-sign.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        selfScopeOnly: true,
        shardBound: true,
        maxResults: tool.name.endsWith("listAgreements") ? 25 : 1,
        participantIdentityReturned: false,
        documentsReturned: false,
        signingUrlsReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      `Adobe Acrobat Sign ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeAirtable(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "airtable",
      input.connectionId,
    );
    const tool = this.registry.getTool("airtable", input.toolName)!;
    if (tool.name === "relay_airtable_draft_record_change") {
      const operation = this.requiredString(input.input.operation, "operation");
      if (!["create", "update", "comment"].includes(operation))
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "operation must be create, update, or comment",
        );
      const baseId = this.requiredString(input.input.baseId, "baseId"),
        tableId = this.requiredString(input.input.tableId, "tableId"),
        recordId = this.stringOrNull(input.input.recordId);
      if (["update", "comment"].includes(operation) && !recordId)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "recordId is required for an update or comment draft",
        );
      const body = {
        operation,
        baseId,
        tableId,
        recordId,
        fields: input.input.fields ?? null,
        comment: this.stringOrNull(input.input.comment),
      };
      const encoded = JSON.stringify(body);
      if (encoded.length > 40_000)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "Airtable record draft is too large",
        );
      return this.ok(
        { ...body, payloadHash: this.hash(encoded), providerSideEffect: false },
        "Airtable record change prepared locally.",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_airtable_list_bases")
      return this.ok(
        await this.airtableApi.listBases(token.accessToken, input.input),
        "Airtable bases listed.",
      );
    if (tool.name === "relay_airtable_get_base_schema")
      return this.ok(
        await this.airtableApi.getBaseSchema(token.accessToken, input.input),
        "Airtable base schema read.",
      );
    if (tool.name === "relay_airtable_list_records")
      return this.ok(
        await this.airtableApi.listRecords(token.accessToken, input.input),
        "Airtable records listed.",
      );
    if (tool.name === "relay_airtable_get_record")
      return this.ok(
        await this.airtableApi.getRecord(token.accessToken, input.input),
        "Airtable record read.",
      );
    if (tool.name === "relay_airtable_list_record_comments")
      return this.ok(
        await this.airtableApi.listComments(token.accessToken, input.input),
        "Airtable comments listed.",
      );
    if (tool.name === "relay_airtable_create_record") {
      await this.requireAirtableApproval(
        input,
        connection,
        "airtable_record_create",
        `${input.input.baseId}/${input.input.tableId}`,
        input.input,
      );
      const result = await this.airtableApi.createRecord(
        token.accessToken,
        input.input,
      );
      await this.auditAirtableWrite(
        input,
        connection,
        "record.created",
        `${input.input.baseId}/${input.input.tableId}`,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Airtable record created.");
    }
    if (tool.name === "relay_airtable_update_record") {
      await this.requireAirtableApproval(
        input,
        connection,
        "airtable_record_update",
        input.input.recordId,
        input.input,
      );
      const result = await this.airtableApi.updateRecord(
        token.accessToken,
        input.input,
      );
      await this.auditAirtableWrite(
        input,
        connection,
        "record.updated",
        input.input.recordId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Airtable record updated.");
    }
    if (tool.name === "relay_airtable_add_record_comment") {
      await this.requireAirtableApproval(
        input,
        connection,
        "airtable_record_comment_create",
        input.input.recordId,
        input.input,
      );
      const result = await this.airtableApi.addComment(
        token.accessToken,
        input.input,
      );
      await this.auditAirtableWrite(
        input,
        connection,
        "comment.created",
        input.input.recordId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Airtable comment added.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeAnytype(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
  ) {
    if (!this.anytypeLocalApi)
      return this.safeError(
        "tool_unavailable",
        "Anytype source-host executor is not registered",
      );
    const tool = this.registry.getTool("anytype", input.toolName);
    if (!tool)
      return this.safeError(
        "tool_unavailable",
        "Anytype tool is not registered",
      );
    const credentials = this.anytypeCredentials(connection);
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "anytype.read") {
      data = await this.anytypeLocalApi.callRead(
        input.workspaceId,
        credentials,
        payload,
      );
    } else if (tool.name === "anytype.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "anytype_api_manage",
        "anytype",
      );
      data = await this.anytypeLocalApi.callManage(
        input.workspaceId,
        credentials,
        payload,
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
      eventType: `marketplace.anytype.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        sourceHostBound: true,
        apiVersion: "2025-11-08",
        runtime: credentials.runtime,
        requestBodyLogged: false,
      },
    });
    return this.ok(data, `Anytype ${tool.name.split(".")[1]} completed.`);
  },

  async executeArchbee(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "archbee",
      input.connectionId,
    );
    const credentials = this.archbeeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("archbee", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "archbee.getDocument")
      data = await this.archbeeApi.getDocument(credentials, input.input);
    else if (name === "archbee.searchDocuments")
      data = await this.archbeeApi.searchDocuments(credentials, input.input);
    else if (name === "archbee.uploadFile") {
      await this.requireConnectorApproval(
        input,
        connection,
        "upload_file",
        "archbee",
      );
      data = await this.archbeeApi.uploadFile(credentials, input.input);
    } else if (name === "archbee.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "archbee",
      );
      data = await this.archbeeApi.request(credentials, {
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
      eventType: `marketplace.archbee.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        docId: this.stringOrNull(input.input.docId),
        filename: this.stringOrNull(input.input.filename),
      },
    });
    return this.ok(data, `Archbee ${name.split(".")[1]} completed.`);
  },

  async executeBetterProposals(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "better-proposals",
      input.connectionId,
    );
    const tool = this.registry.getTool("better-proposals", input.toolName)!;
    const credentials = this.betterProposalsCredentials(
      this.credentials.decrypt(connection),
    );
    let data: unknown;
    if (tool.name === "betterProposals.listProposals")
      data = await this.betterProposalsApi.listProposals(
        credentials,
        input.input,
      );
    else if (tool.name === "betterProposals.getProposal")
      data = await this.betterProposalsApi.getProposal(
        credentials,
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
      eventType: `marketplace.better_proposals.${
        tool.name === "betterProposals.listProposals"
          ? "list_proposals"
          : "get_proposal"
      }.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedToken: true,
        broadAccountToken: true,
        providerRequestCount: 1,
        maxResults: tool.name === "betterProposals.listProposals" ? 50 : 1,
        contactsReturned: false,
        companiesReturned: false,
        pricingReturned: false,
        signaturesReturned: false,
        paymentsReturned: false,
        linksReturned: false,
        contentReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      tool.name === "betterProposals.listProposals"
        ? "Better Proposals proposal metadata listed."
        : "Better Proposals proposal metadata retrieved.",
    );
  },

  async executeBox(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "box",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("box", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "box.getCurrentUser")
      data = await this.boxApi.getCurrentUser(token.accessToken);
    else if (name === "box.listFolderItems")
      data = await this.boxApi.listFolderItems(token.accessToken, input.input);
    else if (name === "box.getFile")
      data = await this.boxApi.getFile(token.accessToken, input.input);
    else if (name === "box.getFolder")
      data = await this.boxApi.getFolder(token.accessToken, input.input);
    else if (name === "box.searchContent")
      data = await this.boxApi.searchContent(token.accessToken, input.input);
    else if (name === "box.prepareTextUpload")
      data = this.boxApi.prepareTextUpload(input.input);
    else if (name === "box.createFolder") {
      await this.requireBoxApproval(
        input,
        connection,
        "box_folder_create",
        `${this.stringOrNull(input.input.parentFolderId) ?? "0"}/${this.stringOrNull(input.input.name) ?? ""}`,
      );
      data = await this.boxApi.createFolder(token.accessToken, input.input);
    } else if (name === "box.uploadText") {
      await this.requireBoxApproval(
        input,
        connection,
        "box_text_upload",
        `${this.stringOrNull(input.input.parentFolderId) ?? "0"}/${this.stringOrNull(input.input.name) ?? ""}`,
      );
      data = await this.boxApi.uploadText(token.accessToken, input.input);
    } else if (name === "box.copyItem") {
      await this.requireBoxApproval(
        input,
        connection,
        "box_item_copy",
        `${this.stringOrNull(input.input.itemType) ?? "item"}:${this.stringOrNull(input.input.itemId) ?? ""}->${this.stringOrNull(input.input.destinationFolderId) ?? "0"}`,
      );
      data = await this.boxApi.copyItem(token.accessToken, input.input);
    } else if (name === "box.moveItem") {
      await this.requireBoxApproval(
        input,
        connection,
        "box_item_move",
        `${this.stringOrNull(input.input.itemType) ?? "item"}:${this.stringOrNull(input.input.itemId) ?? ""}->${this.stringOrNull(input.input.destinationFolderId) ?? "0"}`,
      );
      data = await this.boxApi.moveItem(token.accessToken, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.box.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        folderId: this.stringOrNull(input.input.folderId),
        fileId: this.stringOrNull(input.input.fileId),
        itemId: this.stringOrNull(input.input.itemId),
        destinationFolderId: this.stringOrNull(input.input.destinationFolderId),
        name: this.stringOrNull(input.input.name),
        idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Box ${name.split(".")[1]} completed.`);
  },

  async executeCalibre(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "calibre",
      input.connectionId,
    );
    const credentials = this.calibreCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("calibre", input.toolName)!;
    if (tool.name !== "calibre.getSelectedBookLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.calibreApi.getSelectedBookLifecycle(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.calibre.getSelectedBookLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        publicHttpsOriginBound: true,
        selectedLibraryAndBookBound: true,
        privateMetadataAndBookContentExcluded: true,
        localExecutionAndMutationsBlocked: true,
      },
    });
    return this.ok(data, "Calibre getSelectedBookLifecycle completed.");
  },

  async executeCloudinary(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "cloudinary",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("cloudinary", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "cloudinary.read") {
      data = await this.cloudinaryMcp.callRead(token.accessToken, input.input);
    } else if (name === "cloudinary.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "asset_write",
        "cloudinary",
      );
      data = await this.cloudinaryMcp.callWrite(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.cloudinary.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        providerTool: this.stringOrNull(input.input.toolName),
        argumentKeys: Object.keys(
          this.objectOrNull(input.input.arguments) ?? {},
        ).slice(0, 50),
      },
    });
    return this.ok(data, `Cloudinary ${name.split(".")[1]} completed.`);
  },

  async executeCoda(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "coda",
      input.connectionId,
    );
    const credentials = this.codaCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("coda", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "coda.listDocs")
      data = await this.codaApi.listDocs(credentials, input.input);
    else if (name === "coda.getDoc")
      data = await this.codaApi.getDoc(credentials, input.input);
    else if (name === "coda.listPages")
      data = await this.codaApi.listPages(credentials, input.input);
    else if (name === "coda.listTables")
      data = await this.codaApi.listTables(credentials, input.input);
    else if (name === "coda.listRows")
      data = await this.codaApi.listRows(credentials, input.input);
    else if (name === "coda.getRow")
      data = await this.codaApi.getRow(credentials, input.input);
    else if (name === "coda.getMutationStatus")
      data = await this.codaApi.getMutationStatus(credentials, input.input);
    else if (name === "coda.draftRowChange")
      data = this.codaApi.draftRowChange(input.input);
    else if (name === "coda.insertRow") {
      await this.requireConnectorApproval(
        input,
        connection,
        "row_insert",
        "coda",
      );
      data = await this.codaApi.insertRow(credentials, input.input);
    } else if (name === "coda.updateRow") {
      await this.requireConnectorApproval(
        input,
        connection,
        "row_update",
        "coda",
      );
      data = await this.codaApi.updateRow(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.coda.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        docId: this.stringOrNull(input.input.docId),
        tableId: this.stringOrNull(input.input.tableId),
        rowId: this.stringOrNull(input.input.rowId),
        requestId: this.stringOrNull(input.input.requestId),
      },
    });
    return this.ok(data, `Coda ${name.split(".")[1]} completed.`);
  },

  async executeConcord(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "concord",
      input.connectionId,
    );
    const credentials = this.concordCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("concord", input.toolName)!;
    let data: unknown;
    if (tool.name === "concord.getAgreementMetadata")
      data = await this.concordApi.getAgreementMetadata(
        credentials,
        input.input,
      );
    else if (tool.name === "concord.createAgreementDraft") {
      await this.requireConnectorApproval(
        input,
        connection,
        "concord_agreement_draft_create",
        "concord",
      );
      data = await this.concordApi.createAgreementDraft(
        credentials,
        input.input,
      );
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.concord.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedApiKey: true,
        broadOrganizationKey: true,
        exactEnvironmentBinding: true,
        organizationId: credentials.organizationId,
        providerRequestCount: 1,
        draftCreated: tool.name === "concord.createAgreementDraft",
        sent: false,
        shared: false,
        signingStarted: false,
        contentReturned: false,
        peopleReturned: false,
        signaturesReturned: false,
        financialDataReturned: false,
        linksReturned: false,
        rawProviderResponseReturned: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      tool.name === "concord.getAgreementMetadata"
        ? "Concord agreement metadata retrieved."
        : "Concord agreement draft created without sending.",
    );
  },

  async executeConcreteCms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "concrete-cms",
      input.connectionId,
    );
    const credentials = this.concreteCmsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("concrete-cms", input.toolName)!;
    if (tool.name !== "concrete-cms.getSelectedPageLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.concreteCmsApi.getSelectedPageLifecycle(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.concrete-cms.getSelectedPageLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        concreteCms92PlusRequired: true,
        pagesReadOnlyTokenRequired: true,
        selectedPageIdBound: true,
        fixedIndividualPageRouteOnly: true,
        contentIdentityAndOtherSiteDataDiscarded: true,
        otherResourcesAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(data, "Concrete CMS getSelectedPageLifecycle completed.");
  },

  async executeConfluence(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "confluence",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const cloudId = this.stringOrNull(connection.metadata?.cloudId);
    if (!cloudId)
      return this.safeError(
        "connection_not_ready",
        "Confluence connection is not bound to one Atlassian site.",
      );
    const tool = this.registry.getTool("confluence", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "confluence.listSpaces")
      data = await this.confluenceApi.listSpaces(
        token.accessToken,
        cloudId,
        input.input,
      );
    else if (name === "confluence.listPages")
      data = await this.confluenceApi.listPages(
        token.accessToken,
        cloudId,
        input.input,
      );
    else if (name === "confluence.getPage")
      data = await this.confluenceApi.getPage(
        token.accessToken,
        cloudId,
        input.input,
      );
    else if (name === "confluence.uploadAttachment") {
      await this.requireConnectorApproval(
        input,
        connection,
        "confluence_write",
        "confluence",
      );
      data = await this.confluenceApi.uploadAttachment(
        token.accessToken,
        cloudId,
        input.input,
      );
    } else if (name === "confluence.request") {
      const method = this.requiredString(
        input.input.method,
        "method",
      ).toUpperCase();
      await this.requireConnectorApproval(
        input,
        connection,
        "confluence_write_or_admin",
        "confluence",
      );
      data = await this.confluenceApi.request(token.accessToken, cloudId, {
        method,
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
      eventType: `marketplace.confluence.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        cloudId,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Confluence ${name.split(".")[1]} completed.`);
  },

  async executeContractbook(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "contractbook",
      input.connectionId,
    );
    const tool = this.registry.getTool("contractbook", input.toolName)!;
    if (tool.name !== "contractbook.listDocumentLifecycles")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.contractbookApi.listDocumentLifecycles(
      this.contractbookCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.contractbook.list_document_lifecycles.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedApiKey: true,
        productionEnvironmentBound: true,
        providerRequestCount: 1,
        maxResults: 25,
        fullResponseRequested: false,
        titlesReturned: false,
        peopleReturned: false,
        dataFieldsReturned: false,
        filesReturned: false,
        cursorsReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Contractbook document lifecycles listed.");
  },

  async executeCraft(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "craft",
      input.connectionId,
    );
    const stored = this.credentials.decrypt(connection);
    const legacyApiUrl = this.stringOrNull(stored.CRAFT_API_URL);
    const tool = this.registry.getTool("craft", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "craft.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "craft_api_manage",
        "craft",
      );
    } else if (!["craft.read", "craft.discoverTools"].includes(name))
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    if (legacyApiUrl) {
      const credentials = this.craftCredentials(stored);
      data =
        name === "craft.discoverTools"
          ? {
              readTools: [...CRAFT_READ_OPERATIONS],
              manageTools: [...CRAFT_MANAGE_OPERATIONS],
              transport: "legacy_api_url",
            }
          : name === "craft.read"
            ? await this.craftApi.callRead(credentials, input.input)
            : await this.craftApi.callManage(credentials, input.input);
    } else {
      const token = await this.oauth.refreshIfNeeded(connection);
      data =
        name === "craft.discoverTools"
          ? await this.craftMcp.discoverTools(token.accessToken)
          : name === "craft.read"
            ? await this.craftMcp.callRead(token.accessToken, input.input)
            : await this.craftMcp.callManage(token.accessToken, input.input);
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.craft.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        operation:
          this.stringOrNull(input.input.toolName) ??
          this.stringOrNull(input.input.operation),
        authorityBound: true,
        transport: legacyApiUrl ? "legacy_api_url" : "hosted_mcp_oauth",
      },
    });
    return this.ok(data, `Craft ${name.split(".")[1]} completed.`);
  },

  async executeCraftCms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "craft-cms",
      input.connectionId,
    );
    const credentials = this.craftCmsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("craft-cms", input.toolName)!;
    if (tool.name !== "craft-cms.getSelectedEntryLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.craftCmsApi.getSelectedEntryLifecycle(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.craft-cms.getSelectedEntryLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        privateReadOnlySchemaTokenRequired: true,
        selectedEntryUidBound: true,
        fixedGraphqlDocumentAndActionRouteOnly: true,
        entryContentIdentityAndOtherProjectDataDiscarded: true,
        introspectionBatchingAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(data, "Craft CMS getSelectedEntryLifecycle completed.");
  },

  async executeDataForSeo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "dataforseo",
      input.connectionId,
    );
    const stored = this.credentials.decrypt(connection);
    const credentials = this.dataForSeoCredentials(stored, connection);
    const tool = this.registry.getTool("dataforseo", input.toolName)!;
    const name = tool.name;
    if (this.isBlockedSearchRequest(input.input)) {
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.dataforseo.action.failed",
        resourceId: connection.id,
        metadata: {
          toolName: name,
          status: "policy_blocked",
          capability: tool.capability,
        },
      });
      throw new ConnectorExecutionError(
        "policy_blocked",
        "DataForSEO request is blocked by marketplace policy.",
      );
    }
    if (this.dataForSeoRequiresApproval(input.input, name)) {
      await this.requireConnectorApproval(
        input,
        connection,
        "bulk_or_deep_checks",
        "dataforseo",
      );
    }
    if (name === "dataforseo.googleOrganicSerp") {
      const data = await this.dataForSeoApi.googleOrganicSerp(
        credentials,
        input.input,
      );
      const shaped = this.shapeDataForSeoSerpResponse(data);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.dataforseo.serp.executed",
        resourceId: connection.id,
        metadata: this.safeDataForSeoAudit(input, tool, shaped),
      });
      return this.ok(shaped, "DataForSEO Google organic SERP completed.");
    }
    if (name === "dataforseo.verifyRanking") {
      const data = await this.dataForSeoApi.googleOrganicSerp(
        credentials,
        input.input,
      );
      const shaped = this.shapeDataForSeoRankingResponse(data, input.input);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.dataforseo.ranking.verified",
        resourceId: connection.id,
        metadata: this.safeDataForSeoAudit(input, tool, shaped),
      });
      return this.ok(shaped, "DataForSEO ranking verification completed.");
    }
    if (name === "dataforseo.backlinksSummary") {
      const task = await this.dataForSeoApi.backlinksSummary(
        credentials,
        input.input,
      );
      const shaped = this.shapeDataForSeoTaskResults(task);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.dataforseo.backlinks.summary_read",
        resourceId: connection.id,
        metadata: this.safeDataForSeoAudit(input, tool, shaped),
      });
      return this.ok(shaped, "DataForSEO backlinks summary completed.");
    }
    if (name === "dataforseo.findBacklinks") {
      const task = await this.dataForSeoApi.findBacklinks(
        credentials,
        input.input,
      );
      const shaped = this.shapeDataForSeoBacklinksResponse(task);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.dataforseo.backlinks.found",
        resourceId: connection.id,
        metadata: this.safeDataForSeoAudit(input, tool, shaped),
      });
      return this.ok(shaped, "DataForSEO backlinks lookup completed.");
    }
    if (name === "dataforseo.verifyBacklink") {
      const task = await this.dataForSeoApi.findBacklinks(credentials, {
        ...input.input,
        limit: Math.min(Number(input.input.limit ?? 10), 20),
      });
      const shaped = this.shapeDataForSeoBacklinkVerification(
        task,
        input.input,
      );
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.dataforseo.backlink.verified",
        resourceId: connection.id,
        metadata: this.safeDataForSeoAudit(input, tool, shaped),
      });
      return this.ok(shaped, "DataForSEO backlink verification completed.");
    }
    if (name === "dataforseo.inspectPage") {
      const task = await this.dataForSeoApi.inspectPage(
        credentials,
        input.input,
      );
      const shaped = this.shapeDataForSeoPageInspection(task);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.dataforseo.page.inspected",
        resourceId: connection.id,
        metadata: this.safeDataForSeoAudit(input, tool, shaped),
      });
      return this.ok(shaped, "DataForSEO page inspection completed.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeDirectusSelfHosted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "directus-self-hosted",
      input.connectionId,
    );
    const credentials = this.directusSelfHostedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("directus-self-hosted", input.toolName)!;
    if (tool.name !== "directus-self-hosted.getSelectedItemState")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.directusSelfHostedApi.getSelectedItemState(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.directus-self-hosted.getSelectedItemState.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        dedicatedNonAdminStaticTokenRequired: true,
        selectedCollectionAndItemPolicyRequired: true,
        fixedIndividualItemRouteAndFieldsOnly: true,
        itemContentIdentityAndOtherProjectDataDiscarded: true,
        otherResourcesAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(
      data,
      "Directus Self-Hosted getSelectedItemState completed.",
    );
  },

  async executeDocument360(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "document360",
      input.connectionId,
    );
    const credentials = this.document360Credentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("document360", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "document360.listWorkspaces")
      data = await this.document360Api.listWorkspaces(credentials);
    else if (name === "document360.listArticles")
      data = await this.document360Api.listArticles(credentials, input.input);
    else if (name === "document360.getArticle")
      data = await this.document360Api.getArticle(credentials, input.input);
    else if (name === "document360.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "document360",
      );
      data = await this.document360Api.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        json: this.objectOrNull(input.input.json) ?? undefined,
        projectId: this.stringOrNull(input.input.projectId) ?? undefined,
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.document360.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        projectVersionId: this.stringOrNull(input.input.projectVersionId),
        articleId: this.stringOrNull(input.input.articleId),
      },
    });
    return this.ok(data, `Document360 ${name.split(".")[1]} completed.`);
  },

  async executeDocusign(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "docusign",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.docusignCredentials(
      { accessToken: token.accessToken },
      connection,
    );
    const tool = this.registry.getTool("docusign", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "docusign.listRecentEnvelopes") {
      action = "docusign_envelope_list_recent";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "docusign",
      );
      data = await this.docusignApi.listRecentEnvelopes(credentials);
    } else if (name === "docusign.listActionRequiredEnvelopes") {
      action = "docusign_envelope_list_action_required";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "docusign",
      );
      data = await this.docusignApi.listActionRequiredEnvelopes(credentials);
    } else if (name === "docusign.getEnvelope") {
      action = "docusign_envelope_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "docusign",
      );
      data = await this.docusignApi.getEnvelope(credentials, {
        envelopeId: this.requiredString(input.input.envelopeId, "envelopeId"),
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
      eventType: `marketplace.docusign.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        envelopeIdHash: this.stringOrNull(input.input.envelopeId)
          ? this.hash(this.stringOrNull(input.input.envelopeId)!)
          : null,
      },
    });
    return this.ok(data, `Docusign ${name.split(".")[1]} completed.`);
  },

  async executeDocusignIdentify(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "docusign-identify",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.docusignIdentifyCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("docusign-identify", input.toolName)!;
    if (tool.name !== "docusignIdentify.listWorkflows")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "docusign_identify_workflow_list";
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "docusign-identify",
    );
    const data = await this.docusignIdentifyApi.listWorkflows(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.docusign_identify.listWorkflows.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId ?? ""),
      },
    });
    return this.ok(data, "Docusign Identify listWorkflows completed.");
  },

  async executeDropbox(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "dropbox",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("dropbox", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "dropbox.getCurrentAccount")
      data = await this.dropboxApi.getCurrentAccount(token.accessToken);
    else if (name === "dropbox.listFolder")
      data = await this.dropboxApi.listFolder(token.accessToken, input.input);
    else if (name === "dropbox.getMetadata")
      data = await this.dropboxApi.getMetadata(token.accessToken, input.input);
    else if (name === "dropbox.search")
      data = await this.dropboxApi.search(token.accessToken, input.input);
    else if (name === "dropbox.downloadText")
      data = await this.dropboxApi.downloadText(token.accessToken, input.input);
    else if (name === "dropbox.draftChange")
      data = this.dropboxApi.draftChange(input.input);
    else if (name === "dropbox.createFolder") {
      await this.requireDropboxApproval(
        input,
        connection,
        "dropbox_folder_create",
        input.input.path,
      );
      data = await this.dropboxApi.createFolder(token.accessToken, input.input);
    } else if (name === "dropbox.uploadText") {
      await this.requireDropboxApproval(
        input,
        connection,
        "dropbox_text_upload",
        input.input.path,
      );
      data = await this.dropboxApi.uploadText(token.accessToken, input.input);
    } else if (name === "dropbox.copyEntry") {
      await this.requireDropboxApproval(
        input,
        connection,
        "dropbox_entry_copy",
        input.input.toPath,
      );
      data = await this.dropboxApi.copyEntry(token.accessToken, input.input);
    } else if (name === "dropbox.moveEntry") {
      await this.requireDropboxApproval(
        input,
        connection,
        "dropbox_entry_move",
        input.input.toPath,
      );
      data = await this.dropboxApi.moveEntry(token.accessToken, input.input);
    } else if (name === "dropbox.deleteEntry") {
      await this.requireDropboxApproval(
        input,
        connection,
        "dropbox_entry_delete",
        input.input.path,
      );
      data = await this.dropboxApi.deleteEntry(token.accessToken, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.dropbox.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        fromPath: this.stringOrNull(input.input.fromPath),
        toPath: this.stringOrNull(input.input.toPath),
        idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Dropbox ${name.split(".")[1]} completed.`);
  },

  async executeDropboxPaper(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "dropbox-paper",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("dropbox-paper", input.toolName)!;
    const name = tool.name;
    const route = this.requiredString(input.input.route, "route");
    const args = this.objectOrNull(input.input.arguments) ?? {};
    let data: unknown;
    if (name === "dropboxPaper.read") {
      data = await this.dropboxPaperApi.read(token.accessToken, route, args);
    } else if (name === "dropboxPaper.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "paper_write",
        "dropbox-paper",
      );
      data = await this.dropboxPaperApi.write(
        token.accessToken,
        route,
        args,
        this.stringOrNull(input.input.content) ?? undefined,
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
      eventType: `marketplace.dropbox-paper.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        route,
      },
    });
    return this.ok(data, `Dropbox Paper ${name.split(".")[1]} completed.`);
  },

  async executeDropboxSign(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "dropbox-sign",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.dropboxSignCredentials(
      { accessToken: token.accessToken },
      connection,
    );
    const tool = this.registry.getTool("dropbox-sign", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "dropboxSign.listSignatureRequests") {
      action = "dropbox_sign_signature_request_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "dropbox-sign",
      );
      data = await this.dropboxSignApi.listSignatureRequests(credentials);
    } else if (name === "dropboxSign.listAwaitingSignatureRequests") {
      action = "dropbox_sign_signature_request_list_awaiting";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "dropbox-sign",
      );
      data =
        await this.dropboxSignApi.listAwaitingSignatureRequests(credentials);
    } else if (name === "dropboxSign.getSignatureRequest") {
      action = "dropbox_sign_signature_request_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "dropbox-sign",
      );
      data = await this.dropboxSignApi.getSignatureRequest(credentials, {
        signatureRequestId: this.requiredString(
          input.input.signatureRequestId,
          "signatureRequestId",
        ),
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
      eventType: `marketplace.dropbox_sign.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        signatureRequestIdHash: this.stringOrNull(
          input.input.signatureRequestId,
        )
          ? this.hash(this.stringOrNull(input.input.signatureRequestId)!)
          : null,
      },
    });
    return this.ok(data, `Dropbox Sign ${name.split(".")[1]} completed.`);
  },
};

export const KnowledgeDocumentsExecutors1Registrations = {
  "adobe-acrobat-sign": {
    methodName: "executeAdobeAcrobatSign",
    needsConnection: false,
  },
  airtable: { methodName: "executeAirtable", needsConnection: false },
  anytype: { methodName: "executeAnytype", needsConnection: true },
  archbee: { methodName: "executeArchbee", needsConnection: false },
  "better-proposals": {
    methodName: "executeBetterProposals",
    needsConnection: false,
  },
  box: { methodName: "executeBox", needsConnection: false },
  calibre: { methodName: "executeCalibre", needsConnection: false },
  cloudinary: { methodName: "executeCloudinary", needsConnection: false },
  coda: { methodName: "executeCoda", needsConnection: false },
  concord: { methodName: "executeConcord", needsConnection: false },
  "concrete-cms": { methodName: "executeConcreteCms", needsConnection: false },
  confluence: { methodName: "executeConfluence", needsConnection: false },
  contractbook: { methodName: "executeContractbook", needsConnection: false },
  craft: { methodName: "executeCraft", needsConnection: false },
  "craft-cms": { methodName: "executeCraftCms", needsConnection: false },
  dataforseo: { methodName: "executeDataForSeo", needsConnection: false },
  "directus-self-hosted": {
    methodName: "executeDirectusSelfHosted",
    needsConnection: false,
  },
  document360: { methodName: "executeDocument360", needsConnection: false },
  docusign: { methodName: "executeDocusign", needsConnection: false },
  "docusign-identify": {
    methodName: "executeDocusignIdentify",
    needsConnection: false,
  },
  dropbox: { methodName: "executeDropbox", needsConnection: false },
  "dropbox-paper": {
    methodName: "executeDropboxPaper",
    needsConnection: false,
  },
  "dropbox-sign": { methodName: "executeDropboxSign", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof KnowledgeDocumentsExecutors1>;
