import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { SmugMugApiError } from "../../../smugmug/smugmug-api.adapter";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const ContentCreativeExecutors3 = {
  async executeRiversideFm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "riverside-fm",
      input.connectionId,
    );
    const credentials = this.riversideFmCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("riverside-fm", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "riverside.listWorkspace")
      data = await this.riversideFmApi.listWorkspace(credentials);
    else {
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "riverside-fm",
      );
      if (name === "riverside.listRecordings")
        data = await this.riversideFmApi.listRecordings(
          credentials,
          input.input,
        );
      else if (name === "riverside.getRecording")
        data = await this.riversideFmApi.getRecording(credentials, input.input);
      else if (name === "riverside.downloadRecordingFile")
        data = await this.riversideFmApi.downloadRecordingFile(
          credentials,
          input.input,
        );
      else if (name === "riverside.downloadTranscript")
        data = await this.riversideFmApi.downloadTranscript(
          credentials,
          input.input,
        );
      else if (name === "riverside.deleteRecording")
        data = await this.riversideFmApi.deleteRecording(
          credentials,
          input.input,
        );
      else if (name === "riverside.listExports")
        data = await this.riversideFmApi.listExports(credentials, input.input);
      else if (name === "riverside.getExport")
        data = await this.riversideFmApi.getExport(credentials, input.input);
      else if (name === "riverside.downloadExport")
        data = await this.riversideFmApi.downloadExport(
          credentials,
          input.input,
        );
      else if (name === "riverside.deleteExport")
        data = await this.riversideFmApi.deleteExport(credentials, input.input);
      else if (name === "riverside.listRegistrants")
        data = await this.riversideFmApi.listRegistrants(
          credentials,
          input.input,
        );
      else if (name === "riverside.registerAttendee")
        data = await this.riversideFmApi.registerAttendee(
          credentials,
          input.input,
        );
      else if (name === "riverside.listEdits")
        data = await this.riversideFmApi.listEdits(credentials, input.input);
      else if (name === "riverside.createTimeline")
        data = await this.riversideFmApi.createTimeline(
          credentials,
          input.input,
        );
      else if (name === "riverside.getTimeline")
        data = await this.riversideFmApi.getTimeline(credentials, input.input);
      else if (name === "riverside.downloadTimeline")
        data = await this.riversideFmApi.downloadTimeline(
          credentials,
          input.input,
        );
      else
        return this.safeError(
          "tool_unavailable",
          `${input.toolName} is not implemented`,
        );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.riverside.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        recordingId: this.stringOrNull(input.input.recordingId),
        exportId: this.stringOrNull(input.input.exportId),
        eventId: this.stringOrNull(input.input.eventId),
        clipId: this.stringOrNull(input.input.clipId),
        timelineId: this.stringOrNull(input.input.timelineId),
        target: this.stringOrNull(input.input.target),
      },
    });
    return this.ok(data, `Riverside ${name.split(".")[1]} completed.`);
  },

  async executeSanity(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sanity",
      input.connectionId,
    );
    const credentials = this.sanityCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sanity", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "sanity.listDocumentTypes")
      data = await this.sanityApi.listDocumentTypes(credentials, input.input);
    else if (name === "sanity.listDocuments")
      data = await this.sanityApi.listDocuments(credentials, input.input);
    else if (name === "sanity.getDocument")
      data = await this.sanityApi.getDocument(credentials, input.input);
    else if (name === "sanity.prepareDocumentChange")
      data = this.sanityApi.prepareDocumentChange(input.input);
    else if (name === "sanity.createDraft") {
      action = "sanity_document_create_draft";
      await this.requireSanityApproval(input, connection, action);
      data = await this.sanityApi.createDraft(credentials, input.input);
    } else if (name === "sanity.updateDraft") {
      action = "sanity_document_update_draft";
      await this.requireSanityApproval(input, connection, action);
      data = await this.sanityApi.updateDraft(credentials, input.input);
    } else if (name === "sanity.publishDocument") {
      action = "sanity_document_publish";
      await this.requireSanityApproval(input, connection, action);
      data = await this.sanityApi.publishDocument(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.sanity.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        documentId: this.stringOrNull(input.input.documentId),
        documentType: this.stringOrNull(input.input.type),
        expectedRevisionId: this.stringOrNull(input.input.expectedRevisionId),
        ...(tool.action === "write"
          ? {
              idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
              resultHash: this.hash(JSON.stringify(data)),
            }
          : {}),
      },
    });
    return this.ok(data, `Sanity ${name.split(".")[1]} completed.`);
  },

  async executeSendFox(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sendfox",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.sendFoxCredentials(
      { accessToken: token.accessToken },
      connection,
    );
    const tool = this.registry.getTool("sendfox", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "sendfox.getAccountSummary") {
      action = "sendfox_account_get";
      await this.requireConnectorApproval(input, connection, action, "sendfox");
      data = await this.sendFoxApi.getAccountSummary(credentials);
    } else if (name === "sendfox.listContactLists") {
      action = "sendfox_list_list";
      await this.requireConnectorApproval(input, connection, action, "sendfox");
      data = await this.sendFoxApi.listContactLists(credentials);
    } else if (name === "sendfox.listCampaigns") {
      action = "sendfox_campaign_list";
      await this.requireConnectorApproval(input, connection, action, "sendfox");
      data = await this.sendFoxApi.listCampaigns(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.sendfox.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
      },
    });
    return this.ok(data, `SendFox ${name.split(".")[1]} completed.`);
  },

  async executeShootProof(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "shootproof",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("shootproof", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "shootproof.read") {
      data = await this.shootProofApi.read(
        token.accessToken,
        operation,
        operationInput,
      );
    } else if (tool.name === "shootproof.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "shootproof_manage",
        "shootproof",
      );
      data = await this.shootProofApi.manage(
        token.accessToken,
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
      eventType: `marketplace.shootproof.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `ShootProof ${tool.name.split(".")[1]} completed.`);
  },

  async executeSmugMug(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "smugmug",
      input.connectionId,
    );
    const credentials = this.smugMugCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("smugmug", input.toolName)!;
    let data: unknown;
    if (tool.name === "smugmug.describe") {
      data = await this.smugMugApi.describe(credentials, {
        uri: this.requiredString(input.input.uri, "uri"),
        query: this.objectOrNull(input.input.query) ?? undefined,
      });
    } else if (tool.name === "smugmug.read") {
      data = await this.smugMugApi.read(credentials, {
        uri: this.requiredString(input.input.uri, "uri"),
        query: this.objectOrNull(input.input.query) ?? undefined,
      });
    } else if (tool.name === "smugmug.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "smugmug_manage",
        "smugmug",
      );
      const method = this.requiredString(input.input.method, "method");
      if (!["POST", "PATCH", "DELETE"].includes(method))
        throw new SmugMugApiError(
          "provider_validation_error",
          "SmugMug manage method is invalid.",
          400,
        );
      data = await this.smugMugApi.manage(
        credentials,
        method as "POST" | "PATCH" | "DELETE",
        {
          uri: this.requiredString(input.input.uri, "uri"),
          query: this.objectOrNull(input.input.query) ?? undefined,
          json: this.objectOrNull(input.input.json) ?? undefined,
        },
      );
    } else if (tool.name === "smugmug.upload") {
      await this.requireConnectorApproval(
        input,
        connection,
        "smugmug_upload",
        "smugmug",
      );
      data = await this.smugMugApi.upload(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.smugmug.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        uri:
          typeof input.input.uri === "string"
            ? input.input.uri.slice(0, 2_000)
            : null,
      },
    });
    return this.ok(data, `SmugMug ${tool.name.split(".")[1]} completed.`);
  },

  async executeStrapiCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "strapi-cloud",
      input.connectionId,
    );
    const credentials = this.strapiCloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("strapi-cloud", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "strapiCloud.listConfiguredContentTypes")
      data = this.strapiCloudApi.listConfiguredContentTypes(credentials);
    else if (name === "strapiCloud.listDocuments")
      data = await this.strapiCloudApi.listDocuments(credentials, input.input);
    else if (name === "strapiCloud.getDocument")
      data = await this.strapiCloudApi.getDocument(credentials, input.input);
    else if (name === "strapiCloud.prepareDocumentChange")
      data = this.strapiCloudApi.prepareDocumentChange(
        credentials,
        input.input,
      );
    else if (name === "strapiCloud.createDraft") {
      action = "strapi_cloud_document_create_draft";
      await this.requireStrapiCloudApproval(input, connection, action);
      data = await this.strapiCloudApi.createDraft(credentials, input.input);
    } else if (name === "strapiCloud.updateDraft") {
      action = "strapi_cloud_document_update_draft";
      await this.requireStrapiCloudApproval(input, connection, action);
      data = await this.strapiCloudApi.updateDraft(credentials, input.input);
    } else if (name === "strapiCloud.publishDocument") {
      action = "strapi_cloud_document_publish";
      await this.requireStrapiCloudApproval(input, connection, action);
      data = await this.strapiCloudApi.publishDocument(
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
      eventType: `marketplace.strapi_cloud.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        pluralApiId: this.stringOrNull(input.input.pluralApiId),
        documentId: this.stringOrNull(input.input.documentId),
        expectedUpdatedAt: this.stringOrNull(input.input.expectedUpdatedAt),
        ...(tool.action === "write"
          ? {
              idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
              resultHash: this.hash(JSON.stringify(data)),
            }
          : {}),
      },
    });
    return this.ok(data, `Strapi Cloud ${name.split(".")[1]} completed.`);
  },

  async executeSubstack(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "substack",
      input.connectionId,
    );
    const credentials = this.substackCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const tool = this.registry.getTool("substack", input.toolName)!;
    if (tool.name !== "substack.searchProfilesByLinkedIn")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const linkedinHandle = this.requiredString(
      input.input.linkedinHandle,
      "linkedinHandle",
    );
    const data = await this.substackApi.searchProfilesByLinkedIn(
      credentials,
      linkedinHandle,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.substack.searchProfilesByLinkedIn.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        linkedinHandleHash: this.hash(linkedinHandle.toLowerCase()),
      },
    });
    return this.ok(data, "Substack public creator-profile search completed.");
  },

  async executeThreads(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "threads",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("threads", input.toolName)!;
    const profileId = this.stringOrNull(connection.metadata?.threadsProfileId);
    if (!profileId)
      return this.safeError(
        "connection_not_ready",
        "Threads connection is not bound to a profile",
      );
    let data: unknown;
    if (tool.name === "relay_threads_get_profile") {
      data = await this.threadsApi.getProfile(token.accessToken);
      if ((data as { profileId?: string }).profileId !== profileId)
        throw new ConnectorExecutionError(
          "connection_not_ready",
          "Threads connected profile changed; reconnect is required",
        );
    } else if (tool.name === "relay_threads_list_own_posts") {
      const posts = await this.threadsApi.listOwnPosts(
        token.accessToken,
        profileId,
        input.input.limit,
      );
      data = { posts, count: posts.length, nextPageFollowed: false };
    } else if (tool.name === "relay_threads_get_own_post") {
      data = await this.threadsApi.getOwnPost(
        token.accessToken,
        profileId,
        input.input.postId,
      );
    } else if (tool.name === "relay_threads_draft_text_post") {
      data = this.threadsApi.draftText(input.input.text);
    } else if (tool.name === "relay_threads_publish_text_post") {
      await this.requireThreadsPublishApproval(input, connection);
      data = await this.threadsApi.publishText(
        token.accessToken,
        input.input.text,
      );
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.threads.${tool.name}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        profileIdHash: this.hash(profileId),
        postIdHash: this.stringOrNull(input.input.postId)
          ? this.hash(this.stringOrNull(input.input.postId)!)
          : null,
        textHash: this.stringOrNull(input.input.text)
          ? this.hash(this.stringOrNull(input.input.text)!)
          : null,
      },
    });
    return this.ok(
      data,
      `Threads ${tool.name.replace("relay_threads_", "").replaceAll("_", " ")} completed.`,
    );
  },

  async executeTransistorFm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "transistor-fm",
      input.connectionId,
    );
    const credentials = this.transistorFmCredentials(
      this.credentials.decrypt(connection),
      connection.metadata,
    );
    const tool = this.registry.getTool("transistor-fm", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "transistor.getShow")
      data = await this.transistorFmApi.getShow(credentials);
    else {
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "transistor-fm",
      );
      if (name === "transistor.listEpisodes")
        data = await this.transistorFmApi.listEpisodes(
          credentials,
          input.input,
        );
      else if (name === "transistor.getEpisode")
        data = await this.transistorFmApi.getEpisode(credentials, input.input);
      else if (name === "transistor.getAnalytics")
        data = await this.transistorFmApi.getAnalytics(
          credentials,
          input.input,
        );
      else
        return this.safeError(
          "tool_unavailable",
          `${input.toolName} is not implemented`,
        );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.transistor.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        showId: credentials.showId,
        episodeId: this.stringOrNull(input.input.episodeId),
        scope: this.stringOrNull(input.input.scope),
      },
    });
    return this.ok(data, `Transistor ${name.split(".")[1]} completed.`);
  },

  async executeTumblr(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "tumblr",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("tumblr", input.toolName)!;
    const accountName = this.stringOrNull(
      connection.metadata?.tumblrAccountName,
    );
    const blogUuid = this.stringOrNull(
      connection.metadata?.tumblrSelectedBlogUuid,
    );
    const blogName = this.stringOrNull(
      connection.metadata?.tumblrSelectedBlogName,
    );
    if (!accountName || !blogUuid || !blogName)
      return this.safeError(
        "connection_not_ready",
        "Tumblr connection is not bound to an account and owned blog",
      );
    let data: unknown;
    if (tool.name === "relay_tumblr_get_account") {
      data = await this.tumblrApi.getAccount(token.accessToken, blogUuid);
      if ((data as { accountName?: string }).accountName !== accountName)
        throw new ConnectorExecutionError(
          "connection_not_ready",
          "Tumblr connected account changed; reconnect is required",
        );
    } else if (tool.name === "relay_tumblr_get_owned_blog") {
      data = await this.tumblrApi.getOwnedBlog(token.accessToken, blogUuid);
    } else if (tool.name === "relay_tumblr_list_owned_blog_recent_posts") {
      const posts = await this.tumblrApi.listPublishedPosts(
        token.accessToken,
        blogUuid,
        blogName,
        input.input.limit,
        input.input.tag,
      );
      data = { posts, count: posts.length, nextPageFollowed: false };
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.tumblr.${tool.name}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        accountHash: this.hash(accountName),
        blogUuidHash: this.hash(blogUuid),
        tagHash: this.stringOrNull(input.input.tag)
          ? this.hash(this.stringOrNull(input.input.tag)!)
          : null,
        limit: input.input.limit ?? null,
        providerDataPersisted: false,
      },
    });
    return this.ok(
      data,
      `Tumblr ${tool.name.replace("relay_tumblr_", "").replaceAll("_", " ")} completed.`,
    );
  },

  async executeTypeform(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "typeform",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.typeformCredentials(
      { accessToken: token.accessToken },
      connection,
    );
    const tool = this.registry.getTool("typeform", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "typeform.listWorkspaceForms") {
      action = "typeform_form_list_recent";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "typeform",
      );
      data = await this.typeformApi.listWorkspaceForms(credentials);
    } else if (name === "typeform.getFormSummary") {
      action = "typeform_form_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "typeform",
      );
      data = await this.typeformApi.getFormSummary(credentials, {
        formId: this.requiredString(input.input.formId, "formId"),
      });
    } else if (name === "typeform.listRecentResponses") {
      action = "typeform_response_list_recent";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "typeform",
      );
      data = await this.typeformApi.listRecentResponses(credentials, {
        formId: this.requiredString(input.input.formId, "formId"),
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
      eventType: `marketplace.typeform.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        workspaceIdHash: this.hash(credentials.workspaceId),
        formIdHash: this.stringOrNull(input.input.formId)
          ? this.hash(this.stringOrNull(input.input.formId)!)
          : null,
      },
    });
    return this.ok(data, `Typeform ${name.split(".")[1]} completed.`);
  },

  async executeVidyard(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vidyard",
      input.connectionId,
    );
    const credentials = this.vidyardCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("vidyard", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "vidyard.listAccounts")
      data = await this.vidyardApi.listAccounts(credentials);
    else if (name === "vidyard.listPlayers")
      data = await this.vidyardApi.listPlayers(credentials, input.input);
    else if (name === "vidyard.getPlayer")
      data = await this.vidyardApi.getPlayer(credentials, input.input);
    else if (name === "vidyard.listVideos")
      data = await this.vidyardApi.listVideos(credentials, input.input);
    else if (name === "vidyard.getVideo")
      data = await this.vidyardApi.getVideo(credentials, input.input);
    else if (name === "vidyard.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "vidyard",
      );
      data = await this.vidyardApi.request(credentials, {
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
      eventType: `marketplace.vidyard.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        playerId: this.stringOrNull(input.input.playerId),
        videoId: this.stringOrNull(input.input.videoId),
      },
    });
    return this.ok(data, `Vidyard ${name.split(".")[1]} completed.`);
  },

  async executeVimeo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vimeo",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("vimeo", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "vimeo.getMe")
      data = await this.vimeoApi.getMe(token.accessToken);
    else if (name === "vimeo.listVideos")
      data = await this.vimeoApi.listVideos(token.accessToken, input.input);
    else if (name === "vimeo.getVideo")
      data = await this.vimeoApi.getVideo(token.accessToken, input.input);
    else if (name === "vimeo.listFolders")
      data = await this.vimeoApi.listFolders(token.accessToken, input.input);
    else if (name === "vimeo.getFolder")
      data = await this.vimeoApi.getFolder(token.accessToken, input.input);
    else if (name === "vimeo.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "vimeo",
      );
      data = await this.vimeoApi.request(token.accessToken, {
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
      eventType: `marketplace.vimeo.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        videoId: this.stringOrNull(input.input.videoId),
        folderId: this.stringOrNull(input.input.folderId),
      },
    });
    return this.ok(data, `Vimeo ${name.split(".")[1]} completed.`);
  },

  async executeWebflow(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "webflow",
      input.connectionId,
    );
    const tool = this.registry.getTool("webflow", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action = tool.functionName;

    if (name === "webflow.prepareItemChange") {
      data = this.webflowApi.prepareItemChange(input.input);
    } else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "webflow.listSites") {
        data = await this.webflowApi.listSites(token.accessToken);
      } else if (name === "webflow.getSite") {
        data = await this.webflowApi.getSite(token.accessToken, input.input);
      } else if (name === "webflow.listCollections") {
        data = await this.webflowApi.listCollections(
          token.accessToken,
          input.input,
        );
      } else if (name === "webflow.getCollection") {
        data = await this.webflowApi.getCollection(
          token.accessToken,
          input.input,
        );
      } else if (name === "webflow.listStagedItems") {
        data = await this.webflowApi.listStagedItems(
          token.accessToken,
          input.input,
        );
      } else if (name === "webflow.getStagedItem") {
        data = await this.webflowApi.getStagedItem(
          token.accessToken,
          input.input,
        );
      } else if (name === "webflow.updateStagedItem") {
        action = "webflow_item_update";
        await this.requireWebflowApproval(input, connection, action);
        data = await this.webflowApi.updateStagedItem(
          token.accessToken,
          input.input,
        );
      } else if (name === "webflow.publishItems") {
        action = "webflow_item_publish";
        await this.requireWebflowApproval(input, connection, action);
        data = await this.webflowApi.publishItems(
          token.accessToken,
          input.input,
        );
      } else {
        return this.safeError(
          "tool_unavailable",
          `${input.toolName} is not implemented`,
        );
      }
    }

    const isWrite = tool.action === "write";
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.webflow.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        siteId: this.stringOrNull(input.input.siteId),
        collectionId: this.stringOrNull(input.input.collectionId),
        itemId: this.stringOrNull(input.input.itemId),
        itemCount: Array.isArray(input.input.itemIds)
          ? input.input.itemIds.length
          : null,
        ...(isWrite
          ? {
              idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
              resultHash: this.hash(JSON.stringify(data)),
            }
          : {}),
      },
    });
    return this.ok(data, `Webflow ${name.split(".")[1]} completed.`);
  },

  async executeWhimsical(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "whimsical",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("whimsical", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "whimsical.read") {
      data = await this.whimsicalMcp.callRead(token.accessToken, input.input);
    } else if (name === "whimsical.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "content_management",
        "whimsical",
      );
      data = await this.whimsicalMcp.callWrite(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.whimsical.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Whimsical ${name.split(".")[1]} completed.`);
  },

  async executeWidenCollective(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "widen-collective",
      input.connectionId,
    );
    const credentials = this.widenCollectiveCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("widen-collective", input.toolName)!;
    const apiVersion = this.requiredString(
      input.input.apiVersion,
      "apiVersion",
    );
    const path = this.requiredString(input.input.path, "path");
    const query =
      input.input.query &&
      typeof input.input.query === "object" &&
      !Array.isArray(input.input.query)
        ? (input.input.query as Record<string, unknown>)
        : undefined;
    let data: unknown;
    if (tool.name === "widen-collective.read") {
      data = await this.widenCollectiveApi.request(credentials, {
        apiVersion,
        method: "GET",
        path,
        query,
      });
    } else if (tool.name === "widen-collective.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "widen_collective_dam_manage",
        "widen-collective",
      );
      data = await this.widenCollectiveApi.request(credentials, {
        apiVersion,
        method: this.requiredString(input.input.method, "method"),
        path,
        query,
        json:
          input.input.json &&
          typeof input.input.json === "object" &&
          !Array.isArray(input.input.json)
            ? (input.input.json as Record<string, unknown>)
            : undefined,
        contentBase64:
          this.stringOrNull(input.input.contentBase64) ?? undefined,
        contentType: this.stringOrNull(input.input.contentType) ?? undefined,
        multipartFields:
          input.input.multipartFields &&
          typeof input.input.multipartFields === "object" &&
          !Array.isArray(input.input.multipartFields)
            ? (input.input.multipartFields as Record<string, unknown>)
            : undefined,
        multipartField:
          this.stringOrNull(input.input.multipartField) ?? undefined,
        fileName: this.stringOrNull(input.input.fileName) ?? undefined,
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
      eventType: `marketplace.widen-collective.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        apiVersion,
        method:
          tool.name === "widen-collective.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path,
      },
    });
    return this.ok(data, `Acquia DAM ${tool.name.split(".")[1]} completed.`);
  },

  async executeWistia(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "wistia",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("wistia", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "wistia.getAccount")
      data = await this.wistiaApi.getAccount(token.accessToken);
    else if (name === "wistia.listMedia")
      data = await this.wistiaApi.listMedia(token.accessToken, input.input);
    else if (name === "wistia.getMedia")
      data = await this.wistiaApi.getMedia(token.accessToken, input.input);
    else if (name === "wistia.listFolders")
      data = await this.wistiaApi.listFolders(token.accessToken, input.input);
    else if (name === "wistia.getFolder")
      data = await this.wistiaApi.getFolder(token.accessToken, input.input);
    else if (name === "wistia.search")
      data = await this.wistiaApi.search(token.accessToken, input.input);
    else if (name === "wistia.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "wistia",
      );
      data = await this.wistiaApi.request(token.accessToken, {
        origin: this.stringOrNull(input.input.origin) ?? undefined,
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
      eventType: `marketplace.wistia.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        origin: this.stringOrNull(input.input.origin),
        path: this.stringOrNull(input.input.path),
        mediaId: this.stringOrNull(input.input.mediaId),
        folderId: this.stringOrNull(input.input.folderId),
      },
    });
    return this.ok(data, `Wistia ${name.split(".")[1]} completed.`);
  },

  async executeWordPressCom(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "wordpress-com",
      input.connectionId,
    );
    const siteId = this.requiredString(
      connection.metadata?.wordpressComBlogId,
      "wordpressComBlogId",
    );
    const tool = this.registry.getTool("wordpress-com", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action = tool.functionName;

    if (name === "wordpressCom.preparePostChange") {
      data = this.wordpressComApi.preparePostChange(siteId, input.input);
    } else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "wordpressCom.listSites") {
        data = await this.wordpressComApi.listSites(token.accessToken, siteId);
      } else if (name === "wordpressCom.getSite") {
        data = await this.wordpressComApi.getSite(
          token.accessToken,
          siteId,
          input.input,
        );
      } else if (name === "wordpressCom.listPosts") {
        data = await this.wordpressComApi.listPosts(
          token.accessToken,
          siteId,
          input.input,
        );
      } else if (name === "wordpressCom.getPost") {
        data = await this.wordpressComApi.getPost(
          token.accessToken,
          siteId,
          input.input,
        );
      } else if (name === "wordpressCom.createDraft") {
        action = "wordpress_com_post_create_draft";
        await this.requireWordPressComApproval(input, connection, action);
        data = await this.wordpressComApi.createDraft(
          token.accessToken,
          siteId,
          input.input,
        );
      } else if (name === "wordpressCom.updateDraft") {
        action = "wordpress_com_post_update_draft";
        await this.requireWordPressComApproval(input, connection, action);
        data = await this.wordpressComApi.updateDraft(
          token.accessToken,
          siteId,
          input.input,
        );
      } else if (name === "wordpressCom.publishPost") {
        action = "wordpress_com_post_publish";
        await this.requireWordPressComApproval(input, connection, action);
        data = await this.wordpressComApi.publishPost(
          token.accessToken,
          siteId,
          input.input,
        );
      } else {
        return this.safeError(
          "tool_unavailable",
          `${input.toolName} is not implemented`,
        );
      }
    }

    const isWrite = tool.action === "write";
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.wordpress_com.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        siteId,
        postId:
          input.input.postId === undefined ? null : String(input.input.postId),
        expectedModified: this.stringOrNull(input.input.expectedModified),
        ...(isWrite
          ? {
              idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
              resultHash: this.hash(JSON.stringify(data)),
            }
          : {}),
      },
    });
    return this.ok(data, `WordPress.com ${name.split(".")[1]} completed.`);
  },

  async executeXMind(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "xmind",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("xmind", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "xmind.read") {
      data = await this.xmindMcp.callRead(token.accessToken, input.input);
    } else if (name === "xmind.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "mind_map_write",
        "xmind",
      );
      data = await this.xmindMcp.callWrite(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.xmind.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `XMind ${name.split(".")[1]} completed.`);
  },

  async executeYouTube(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "youtube",
      input.connectionId,
    );
    const tool = this.registry.getTool("youtube", input.toolName)!;
    const channelId = this.stringOrNull(connection.metadata?.selectedChannelId);
    if (!channelId)
      return this.safeError(
        "connection_not_ready",
        "YouTube requires a creator channel bound during OAuth setup.",
      );
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "youtube.getMyChannel")
      data = await this.youtubeApi.getMyChannel(token.accessToken);
    else if (tool.name === "youtube.listMyPlaylists")
      data = await this.youtubeApi.listMyPlaylists(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "youtube.listPlaylistItems")
      data = await this.youtubeApi.listPlaylistItems(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "youtube.getVideos")
      data = await this.youtubeApi.getVideos(token.accessToken, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.youtube.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        channelIdHash: this.hash(channelId),
        dataApiV3Only: true,
        exactScopeOnly: true,
        connectedChannelOnly: true,
        youtubeAttributionRequired: true,
        writesEnabled: false,
        searchEnabled: false,
        historyEnabled: false,
        analyticsEnabled: false,
        partnerEnabled: false,
        automaticPagination: false,
        serviceAccountEnabled: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `YouTube ${tool.name.split(".")[1]} completed.`);
  },

  async executeZohoCampaigns(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho-campaigns",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zohoCampaignsCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("zoho-campaigns", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "zohoCampaigns.listRecentCampaigns") {
      action = "zoho_campaigns_campaign_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-campaigns",
      );
      data = await this.zohoCampaignsApi.listCampaigns(credentials, {
        status: this.stringOrNull(input.input.status) ?? undefined,
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "zohoCampaigns.getCampaignReport") {
      action = "zoho_campaigns_campaign_report";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-campaigns",
      );
      data = await this.zohoCampaignsApi.campaignReport(credentials, {
        campaignKey: this.requiredString(
          input.input.campaignKey,
          "campaignKey",
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
      eventType: `marketplace.zoho_campaigns.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        userIdHash: this.hash(credentials.userId),
        apiOriginHash: this.hash(credentials.apiOrigin),
        campaignKeyHash: this.stringOrNull(input.input.campaignKey)
          ? this.hash(this.stringOrNull(input.input.campaignKey)!)
          : null,
        status: this.stringOrNull(input.input.status),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Zoho Campaigns ${name.split(".")[1]} completed.`);
  },
};

export const ContentCreativeExecutors3Registrations = {
  "riverside-fm": { methodName: "executeRiversideFm", needsConnection: false },
  sanity: { methodName: "executeSanity", needsConnection: false },
  sendfox: { methodName: "executeSendFox", needsConnection: false },
  shootproof: { methodName: "executeShootProof", needsConnection: false },
  smugmug: { methodName: "executeSmugMug", needsConnection: false },
  "strapi-cloud": { methodName: "executeStrapiCloud", needsConnection: false },
  substack: { methodName: "executeSubstack", needsConnection: false },
  threads: { methodName: "executeThreads", needsConnection: false },
  "transistor-fm": {
    methodName: "executeTransistorFm",
    needsConnection: false,
  },
  tumblr: { methodName: "executeTumblr", needsConnection: false },
  typeform: { methodName: "executeTypeform", needsConnection: false },
  vidyard: { methodName: "executeVidyard", needsConnection: false },
  vimeo: { methodName: "executeVimeo", needsConnection: false },
  webflow: { methodName: "executeWebflow", needsConnection: false },
  whimsical: { methodName: "executeWhimsical", needsConnection: false },
  "widen-collective": {
    methodName: "executeWidenCollective",
    needsConnection: false,
  },
  wistia: { methodName: "executeWistia", needsConnection: false },
  "wordpress-com": {
    methodName: "executeWordPressCom",
    needsConnection: false,
  },
  xmind: { methodName: "executeXMind", needsConnection: false },
  youtube: { methodName: "executeYouTube", needsConnection: false },
  "zoho-campaigns": {
    methodName: "executeZohoCampaigns",
    needsConnection: false,
  },
} satisfies NativeExecutorRegistrationMap<typeof ContentCreativeExecutors3>;
