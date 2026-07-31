import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { FlickrApiError } from "../../../flickr/flickr-api.adapter";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const ContentCreativeExecutors1 = {
  async executeAssetBank(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "asset-bank",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const baseUrl = this.requiredString(
      connection.metadata?.assetBankBaseUrl,
      "Asset Bank site",
    );
    const tool = this.registry.getTool("asset-bank", input.toolName)!;
    const path = this.requiredString(input.input.path, "path");
    const query =
      input.input.query &&
      typeof input.input.query === "object" &&
      !Array.isArray(input.input.query)
        ? (input.input.query as Record<string, unknown>)
        : undefined;
    let data: unknown;
    if (tool.name === "asset-bank.read") {
      data = await this.assetBankApi.request(token.accessToken, baseUrl, {
        method: "GET",
        path,
        query,
      });
    } else if (tool.name === "asset-bank.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "asset_bank_dam_manage",
        "asset-bank",
      );
      data = await this.assetBankApi.request(token.accessToken, baseUrl, {
        method: this.requiredString(input.input.method, "method"),
        path,
        query,
        json: input.input.json,
        contentBase64:
          this.stringOrNull(input.input.contentBase64) ?? undefined,
        contentType: this.stringOrNull(input.input.contentType) ?? undefined,
        multipartField:
          this.stringOrNull(input.input.multipartField) ?? undefined,
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
      eventType: `marketplace.asset-bank.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "asset-bank.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path,
      },
    });
    return this.ok(data, `Asset Bank ${tool.name.split(".")[1]} completed.`);
  },

  async executeAudiomack(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "audiomack",
      input.connectionId,
    );
    const credentials = this.audiomackCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("audiomack", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.name === "audiomack.manage")
      await this.requireConnectorApproval(
        input,
        connection,
        "audiomack_manage",
        "audiomack",
      );
    else if (tool.name !== "audiomack.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.audiomackApi.execute(credentials, operation, {
      path: this.objectOrNull(input.input.path) ?? {},
      query: this.objectOrNull(input.input.query) ?? {},
      body: input.input.body ?? {},
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.audiomack.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Audiomack ${tool.name.split(".")[1]} completed.`);
  },

  async executeAudius(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "audius",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("audius", input.toolName)!;
    const path = this.requiredString(input.input.path, "path");
    let data: unknown;
    let method = "GET";
    if (tool.name === "audius.read")
      data = await this.audiusApi.read(
        token.accessToken,
        path,
        this.objectOrNull(input.input.query) ?? {},
      );
    else if (tool.name === "audius.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "audius_manage",
        "audius",
      );
      method = this.requiredString(input.input.method, "method");
      data = await this.audiusApi.manage(
        token.accessToken,
        method,
        path,
        this.objectOrNull(input.input.json) ?? {},
      );
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.audius.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method,
        path: path.slice(0, 500),
      },
    });
    return this.ok(data, `Audius ${tool.name.split(".")[1]} completed.`);
  },

  async executeBandcamp(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "bandcamp",
      input.connectionId,
    );
    const credentials = this.bandcampCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("bandcamp", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = this.objectOrNull(input.input.input) ?? {};
    let data: unknown;
    if (tool.name === "bandcamp.read")
      data = await this.bandcampApi.read(
        credentials,
        operation,
        operationInput,
      );
    else if (tool.name === "bandcamp.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "bandcamp_manage",
        "bandcamp",
      );
      data = await this.bandcampApi.manage(
        credentials,
        operation,
        operationInput,
      );
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.bandcamp.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Bandcamp ${tool.name.split(".")[1]} completed.`);
  },

  async executeBeehiiv(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "beehiiv",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.beehiivCredentials(
      { accessToken: token.accessToken },
      connection,
    );
    const tool = this.registry.getTool("beehiiv", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "beehiiv.getAccountSummary") {
      action = "beehiiv_account_get";
      await this.requireConnectorApproval(input, connection, action, "beehiiv");
      data = await this.beehiivApi.getAccountSummary(credentials);
    } else if (name === "beehiiv.listPublications") {
      action = "beehiiv_publication_list";
      await this.requireConnectorApproval(input, connection, action, "beehiiv");
      data = await this.beehiivApi.listPublications(credentials);
    } else if (name === "beehiiv.listPosts") {
      action = "beehiiv_post_list";
      await this.requireConnectorApproval(input, connection, action, "beehiiv");
      data = await this.beehiivApi.listPosts(
        credentials,
        this.requiredString(input.input.publicationId, "publicationId"),
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
      eventType: `marketplace.beehiiv.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        organizationIdHash: this.hash(credentials.organizationId),
        publicationIdHash: this.stringOrNull(input.input.publicationId)
          ? this.hash(this.stringOrNull(input.input.publicationId)!)
          : null,
      },
    });
    return this.ok(data, `beehiiv ${name.split(".")[1]} completed.`);
  },

  async executeBluesky(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    return this.blueskyActions
      ? this.blueskyActions.execute({
          workspaceId: input.workspaceId,
          connectionId: input.connectionId,
          agentId: input.agentId,
          userId: input.userId,
          toolName: input.toolName,
          payload: input.input,
          installMetadata: input.installMetadata,
        })
      : this.safeError(
          "tool_unavailable",
          "Bluesky executor is not registered",
        );
  },

  async executeBuzzsprout(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "buzzsprout",
      input.connectionId,
    );
    const credentials = this.buzzsproutCredentials(
      this.credentials.decrypt(connection),
      connection.metadata,
    );
    const tool = this.registry.getTool("buzzsprout", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "buzzsprout.getPodcast") {
      data = await this.buzzsproutApi.getPodcast(credentials);
    } else if (name === "buzzsprout.listEpisodes") {
      await this.requireConnectorApproval(
        input,
        connection,
        "episode_read",
        "buzzsprout",
      );
      data = await this.buzzsproutApi.listEpisodes(credentials, input.input);
    } else if (name === "buzzsprout.getEpisode") {
      await this.requireConnectorApproval(
        input,
        connection,
        "episode_read",
        "buzzsprout",
      );
      data = await this.buzzsproutApi.getEpisode(credentials, input.input);
    } else if (name === "buzzsprout.createEpisode") {
      await this.requireConnectorApproval(
        input,
        connection,
        "episode_publish",
        "buzzsprout",
      );
      data = await this.buzzsproutApi.createEpisode(credentials, input.input);
    } else if (name === "buzzsprout.updateEpisode") {
      await this.requireConnectorApproval(
        input,
        connection,
        "episode_publish",
        "buzzsprout",
      );
      data = await this.buzzsproutApi.updateEpisode(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.buzzsprout.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        podcastId: credentials.podcastId,
        episodeId: this.stringOrNull(input.input.episodeId),
      },
    });
    return this.ok(data, `Buzzsprout ${name.split(".")[1]} completed.`);
  },

  async executeBynder(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "bynder",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const portalOrigin = this.requiredString(
      connection.metadata?.bynderPortalOrigin,
      "Bynder portal",
    );
    const tool = this.registry.getTool("bynder", input.toolName)!;
    const path = this.requiredString(input.input.path, "path");
    const query =
      input.input.query &&
      typeof input.input.query === "object" &&
      !Array.isArray(input.input.query)
        ? (input.input.query as Record<string, unknown>)
        : undefined;
    let data: unknown;
    if (tool.name === "bynder.read") {
      data = await this.bynderApi.request(token.accessToken, portalOrigin, {
        method: "GET",
        path,
        query,
      });
    } else if (tool.name === "bynder.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "bynder_dam_manage",
        "bynder",
      );
      data = await this.bynderApi.request(token.accessToken, portalOrigin, {
        method: this.requiredString(input.input.method, "method"),
        path,
        query,
        json:
          input.input.json &&
          typeof input.input.json === "object" &&
          !Array.isArray(input.input.json)
            ? (input.input.json as Record<string, unknown>)
            : undefined,
        form:
          input.input.form &&
          typeof input.input.form === "object" &&
          !Array.isArray(input.input.form)
            ? (input.input.form as Record<string, unknown>)
            : undefined,
        contentBase64:
          this.stringOrNull(input.input.contentBase64) ?? undefined,
        contentType: this.stringOrNull(input.input.contentType) ?? undefined,
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
      eventType: `marketplace.bynder.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "bynder.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path,
      },
    });
    return this.ok(data, `Bynder ${tool.name.split(".")[1]} completed.`);
  },

  async executeCanto(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "canto",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const accountOrigin = this.requiredString(
      connection.metadata?.cantoAccountOrigin,
      "Canto account",
    );
    const tool = this.registry.getTool("canto", input.toolName)!;
    const path = this.requiredString(input.input.path, "path");
    const query =
      input.input.query &&
      typeof input.input.query === "object" &&
      !Array.isArray(input.input.query)
        ? (input.input.query as Record<string, unknown>)
        : undefined;
    let data: unknown;
    if (tool.name === "canto.read") {
      data = await this.cantoApi.request(token.accessToken, accountOrigin, {
        method: "GET",
        path,
        query,
      });
    } else if (tool.name === "canto.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "canto_dam_manage",
        "canto",
      );
      data = await this.cantoApi.request(token.accessToken, accountOrigin, {
        method: this.requiredString(input.input.method, "method"),
        path,
        query,
        json: input.input.json,
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.canto.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "canto.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path,
      },
    });
    return this.ok(data, `Canto ${tool.name.split(".")[1]} completed.`);
  },

  async executeCanva(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "canva",
      input.connectionId,
    );
    const tool = this.registry.getTool("canva", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action = tool.functionName;

    if (name === "canva.prepareDesign") {
      data = this.canvaApi.prepareDesign(input.input);
    } else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "canva.getCurrentUser") {
        data = await this.canvaApi.getCurrentUser(token.accessToken);
      } else if (name === "canva.listDesigns") {
        data = await this.canvaApi.listDesigns(token.accessToken, input.input);
      } else if (name === "canva.getDesign") {
        data = await this.canvaApi.getDesign(token.accessToken, input.input);
      } else if (name === "canva.listFolderItems") {
        data = await this.canvaApi.listFolderItems(
          token.accessToken,
          input.input,
        );
      } else if (name === "canva.createDesign") {
        action = "canva_design_create";
        await this.requireCanvaApproval(input, connection, action);
        data = await this.canvaApi.createDesign(token.accessToken, input.input);
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
      eventType: `marketplace.canva.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        designId: this.stringOrNull(input.input.designId),
        folderId: this.stringOrNull(input.input.folderId),
        designType: this.stringOrNull(input.input.designType),
        ...(isWrite
          ? {
              idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
              resultHash: this.hash(JSON.stringify(data)),
            }
          : {}),
      },
    });
    return this.ok(data, `Canva ${name.split(".")[1]} completed.`);
  },

  async executeCaptivateFm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "captivate-fm",
      input.connectionId,
    );
    const credentials = this.captivateFmCredentials(
      this.credentials.decrypt(connection),
      connection.metadata,
    );
    const tool = this.registry.getTool("captivate-fm", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "captivate.getShow")
      data = await this.captivateFmApi.getShow(credentials);
    else {
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "captivate-fm",
      );
      if (name === "captivate.listEpisodes")
        data = await this.captivateFmApi.listEpisodes(credentials, input.input);
      else if (name === "captivate.getEpisode")
        data = await this.captivateFmApi.getEpisode(credentials, input.input);
      else if (name === "captivate.listMedia")
        data = await this.captivateFmApi.listMedia(credentials, input.input);
      else if (name === "captivate.getMedia")
        data = await this.captivateFmApi.getMedia(credentials, input.input);
      else if (name === "captivate.getAnalytics")
        data = await this.captivateFmApi.getAnalytics(credentials, input.input);
      else if (name === "captivate.createEpisode")
        data = await this.captivateFmApi.createEpisode(
          credentials,
          input.input,
        );
      else if (name === "captivate.updateEpisode")
        data = await this.captivateFmApi.updateEpisode(
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
      eventType: `marketplace.captivate.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        showId: credentials.showId,
        episodeId: this.stringOrNull(input.input.episodeId),
        mediaId: this.stringOrNull(input.input.mediaId),
        metric: this.stringOrNull(input.input.metric),
      },
    });
    return this.ok(data, `Captivate ${name.split(".")[1]} completed.`);
  },

  async executeClaygent(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "claygent",
      input.connectionId,
    );
    const credentials = this.claygentCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("claygent", input.toolName)!;
    if (tool.name !== "claygent.getWorkspace")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "claygent_workspace_get";
    await this.requireConnectorApproval(input, connection, action, "claygent");
    const data = await this.clayApi.getWorkspace(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.claygent.getWorkspace.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        providerWorkspaceIdHash: this.hash(data.workspace.workspaceId ?? ""),
        executionEnabled: false,
      },
    });
    return this.ok(
      data,
      "Claygent workspace binding read completed; Claygent execution remains disabled.",
    );
  },

  async executeContentful(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "contentful",
      input.connectionId,
    );
    const tool = this.registry.getTool("contentful", input.toolName)!;
    const name = tool.name;
    const origin = this.requiredString(
      connection.metadata?.contentfulCmaOrigin,
      "contentfulCmaOrigin",
    );
    let data: unknown;
    let action = tool.functionName;

    if (name === "contentful.prepareEntryChange") {
      data = this.contentfulApi.prepareEntryChange(input.input);
    } else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "contentful.listSpaces")
        data = await this.contentfulApi.listSpaces(
          token.accessToken,
          origin,
          input.input,
        );
      else if (name === "contentful.getSpace")
        data = await this.contentfulApi.getSpace(
          token.accessToken,
          origin,
          input.input,
        );
      else if (name === "contentful.listEnvironments")
        data = await this.contentfulApi.listEnvironments(
          token.accessToken,
          origin,
          input.input,
        );
      else if (name === "contentful.listContentTypes")
        data = await this.contentfulApi.listContentTypes(
          token.accessToken,
          origin,
          input.input,
        );
      else if (name === "contentful.getContentType")
        data = await this.contentfulApi.getContentType(
          token.accessToken,
          origin,
          input.input,
        );
      else if (name === "contentful.listEntries")
        data = await this.contentfulApi.listEntries(
          token.accessToken,
          origin,
          input.input,
        );
      else if (name === "contentful.getEntry")
        data = await this.contentfulApi.getEntry(
          token.accessToken,
          origin,
          input.input,
        );
      else if (name === "contentful.createDraft") {
        action = "contentful_entry_create_draft";
        await this.requireContentfulApproval(input, connection, action);
        data = await this.contentfulApi.createDraft(
          token.accessToken,
          origin,
          input.input,
        );
      } else if (name === "contentful.updateDraft") {
        action = "contentful_entry_update_draft";
        await this.requireContentfulApproval(input, connection, action);
        data = await this.contentfulApi.updateDraft(
          token.accessToken,
          origin,
          input.input,
        );
      } else if (name === "contentful.publishEntry") {
        action = "contentful_entry_publish";
        await this.requireContentfulApproval(input, connection, action);
        data = await this.contentfulApi.publishEntry(
          token.accessToken,
          origin,
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
      eventType: `marketplace.contentful.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        spaceId: this.stringOrNull(input.input.spaceId),
        environmentId: this.stringOrNull(input.input.environmentId),
        contentTypeId: this.stringOrNull(input.input.contentTypeId),
        entryId: this.stringOrNull(input.input.entryId),
        expectedVersion: input.input.expectedVersion ?? null,
        ...(tool.action === "write"
          ? {
              idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
              resultHash: this.hash(JSON.stringify(data)),
            }
          : {}),
      },
    });
    return this.ok(data, `Contentful ${name.split(".")[1]} completed.`);
  },

  async executeDaminion(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "daminion",
      input.connectionId,
    );
    const credentials = this.daminionCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("daminion", input.toolName)!;
    const path = this.requiredString(input.input.path, "path");
    const query =
      input.input.query &&
      typeof input.input.query === "object" &&
      !Array.isArray(input.input.query)
        ? (input.input.query as Record<string, unknown>)
        : undefined;
    let data: unknown;
    if (tool.name === "daminion.read") {
      data = await this.daminionApi.request(credentials, {
        method: "GET",
        path,
        query,
      });
    } else if (tool.name === "daminion.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "daminion_dam_manage",
        "daminion",
      );
      data = await this.daminionApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path,
        query,
        json:
          input.input.json &&
          typeof input.input.json === "object" &&
          !Array.isArray(input.input.json)
            ? (input.input.json as Record<string, unknown>)
            : undefined,
        multipartFields:
          input.input.multipartFields &&
          typeof input.input.multipartFields === "object" &&
          !Array.isArray(input.input.multipartFields)
            ? (input.input.multipartFields as Record<string, unknown>)
            : undefined,
        multipartField:
          this.stringOrNull(input.input.multipartField) ?? undefined,
        fileName: this.stringOrNull(input.input.fileName) ?? undefined,
        contentType: this.stringOrNull(input.input.contentType) ?? undefined,
        contentBase64:
          this.stringOrNull(input.input.contentBase64) ?? undefined,
        apiArg:
          input.input.apiArg &&
          typeof input.input.apiArg === "object" &&
          !Array.isArray(input.input.apiArg)
            ? (input.input.apiArg as Record<string, unknown>)
            : undefined,
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
      eventType: `marketplace.daminion.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "daminion.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path,
      },
    });
    return this.ok(data, `Daminion ${tool.name.split(".")[1]} completed.`);
  },

  async executeDescript(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "descript",
      input.connectionId,
    );
    const credentials = this.descriptCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("descript", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "descript.listProjects")
      data = await this.descriptApi.listProjects(credentials, input.input);
    else if (name === "descript.getProject")
      data = await this.descriptApi.getProject(credentials, input.input);
    else if (name === "descript.listJobs")
      data = await this.descriptApi.listJobs(credentials, input.input);
    else if (name === "descript.getJob")
      data = await this.descriptApi.getJob(credentials, input.input);
    else if (name === "descript.listAgentModels")
      data = await this.descriptApi.listAgentModels(credentials);
    else if (name === "descript.exportTranscript")
      data = await this.descriptApi.exportTranscript(credentials, input.input);
    else if (name === "descript.importMedia") {
      await this.requireConnectorApproval(
        input,
        connection,
        "production",
        "descript",
      );
      data = await this.descriptApi.importMedia(credentials, input.input);
    } else if (name === "descript.agentEdit") {
      await this.requireConnectorApproval(
        input,
        connection,
        "production",
        "descript",
      );
      data = await this.descriptApi.agentEdit(credentials, input.input);
    } else if (name === "descript.publish") {
      await this.requireConnectorApproval(
        input,
        connection,
        "publishing",
        "descript",
      );
      data = await this.descriptApi.publish(credentials, input.input);
    } else if (name === "descript.cancelJob") {
      await this.requireConnectorApproval(
        input,
        connection,
        "publishing",
        "descript",
      );
      data = await this.descriptApi.cancelJob(credentials, input.input);
    } else if (name === "descript.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "administration",
        "descript",
      );
      data = await this.descriptApi.request(credentials, {
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
      eventType: `marketplace.descript.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        projectId:
          this.stringOrNull(input.input.projectId) ??
          this.stringOrNull(input.input.project_id),
        jobId: this.stringOrNull(input.input.jobId),
      },
    });
    return this.ok(data, `Descript ${name.split(".")[1]} completed.`);
  },

  async executeDeviantArt(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "deviantart",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("deviantart", input.toolName)!;
    const route = this.requiredString(input.input.route, "route");
    const parameters = this.objectOrNull(input.input.parameters) ?? {};
    let data: unknown;
    if (tool.name === "deviantart.read")
      data = await this.deviantArtApi.read(
        token.accessToken,
        route,
        parameters,
      );
    else if (tool.name === "deviantart.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "deviantart_manage",
        "deviantart",
      );
      data = await this.deviantArtApi.manage(
        token.accessToken,
        route,
        parameters,
      );
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.deviantart.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        route: route.slice(0, 300),
      },
    });
    return this.ok(data, `DeviantArt ${tool.name.split(".")[1]} completed.`);
  },

  async executeDrawIo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "draw-io",
      input.connectionId,
    );
    const tool = this.registry.getTool("draw-io", input.toolName)!;
    if (tool.name !== "draw-io.use") {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    const data = await this.drawIoMcp.call(input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.draw-io.use.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerTool: this.stringOrNull(input.input.toolName),
        argumentKeys: Object.keys(
          this.objectOrNull(input.input.arguments) ?? {},
        ).slice(0, 50),
      },
    });
    return this.ok(data, "Draw.io MCP action completed.");
  },

  async executeDribbble(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "dribbble",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("dribbble", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      path: this.objectOrNull(input.input.path) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
      base64: this.stringOrNull(input.input.base64) ?? undefined,
      fileName: this.stringOrNull(input.input.fileName) ?? undefined,
      mimeType: this.stringOrNull(input.input.mimeType) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "dribbble.read") {
      data = await this.dribbbleApi.read(
        token.accessToken,
        operation,
        operationInput,
      );
    } else if (tool.name === "dribbble.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "dribbble_manage",
        "dribbble",
      );
      data = await this.dribbbleApi.manage(
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
      eventType: `marketplace.dribbble.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Dribbble ${tool.name.split(".")[1]} completed.`);
  },

  async executeFigJam(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "figjam",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("figjam", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "figjam.read") {
      data = await this.figJamApi.callRead(token.accessToken, input.input);
    } else if (name === "figjam.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "figjam",
      );
      data = await this.figJamApi.callWrite(token.accessToken, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.figjam.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "figjam.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        queryKeys: Object.keys(
          this.objectOrNull(input.input.query) ?? {},
        ).slice(0, 50),
        bodyKeys: Object.keys(this.objectOrNull(input.input.json) ?? {}).slice(
          0,
          50,
        ),
      },
    });
    return this.ok(data, `FigJam ${name.split(".")[1]} completed.`);
  },

  async executeFigma(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "figma",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("figma", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "figma.read") {
      data = await this.figmaApi.callRead(token.accessToken, input.input);
    } else if (name === "figma.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "figma",
      );
      data = await this.figmaApi.callWrite(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.figma.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "figma.read" ? "GET" : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        queryKeys: Object.keys(
          this.objectOrNull(input.input.query) ?? {},
        ).slice(0, 50),
        bodyKeys: Object.keys(this.objectOrNull(input.input.json) ?? {}).slice(
          0,
          50,
        ),
      },
    });
    return this.ok(data, `Figma ${name.split(".")[1]} completed.`);
  },

  async executeFlickr(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "flickr",
      input.connectionId,
    );
    const credentials = this.flickrCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("flickr", input.toolName)!;
    const method = this.stringOrNull(input.input.method) ?? "";
    const args = this.objectOrNull(input.input.arguments) ?? {};
    let data: unknown;
    if (tool.name === "flickr.describe") {
      data = await this.flickrApi.describe(
        credentials,
        this.requiredString(method, "method"),
      );
    } else if (tool.name === "flickr.read") {
      data = await this.flickrApi.read(
        credentials,
        this.requiredString(method, "method"),
        args,
      );
    } else if (tool.name === "flickr.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "flickr_manage",
        "flickr",
      );
      data = await this.flickrApi.manage(
        credentials,
        this.requiredString(method, "method"),
        args,
      );
    } else if (tool.name === "flickr.upload") {
      await this.requireConnectorApproval(
        input,
        connection,
        "flickr_upload",
        "flickr",
      );
      const operation = this.requiredString(input.input.operation, "operation");
      if (!["upload", "replace"].includes(operation))
        throw new FlickrApiError(
          "provider_validation_error",
          "Flickr upload operation is invalid.",
          400,
        );
      data = await this.flickrApi.upload(
        credentials,
        input.input,
        operation === "replace",
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
      eventType: `marketplace.flickr.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method: method.slice(0, 200),
      },
    });
    return this.ok(data, `Flickr ${tool.name.split(".")[1]} completed.`);
  },

  async executeFrameIo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "frame-io",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("frame-io", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "frameIo.getMe")
      data = await this.frameIoApi.getMe(token.accessToken);
    else if (name === "frameIo.listAccounts")
      data = await this.frameIoApi.listAccounts(token.accessToken, input.input);
    else if (name === "frameIo.listWorkspaces")
      data = await this.frameIoApi.listWorkspaces(
        token.accessToken,
        input.input,
      );
    else if (name === "frameIo.listProjects")
      data = await this.frameIoApi.listProjects(token.accessToken, input.input);
    else if (name === "frameIo.listFolderChildren")
      data = await this.frameIoApi.listFolderChildren(
        token.accessToken,
        input.input,
      );
    else if (name === "frameIo.getFile")
      data = await this.frameIoApi.getFile(token.accessToken, input.input);
    else if (name === "frameIo.listComments")
      data = await this.frameIoApi.listComments(token.accessToken, input.input);
    else if (name === "frameIo.search")
      data = await this.frameIoApi.search(token.accessToken, input.input);
    else if (name === "frameIo.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "frame-io",
      );
      data = await this.frameIoApi.request(token.accessToken, {
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
      eventType: `marketplace.frame_io.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        accountId: this.stringOrNull(input.input.accountId),
        workspaceId: this.stringOrNull(input.input.workspaceId),
        fileId: this.stringOrNull(input.input.fileId),
        folderId: this.stringOrNull(input.input.folderId),
      },
    });
    return this.ok(data, `Frame.io ${name.split(".")[1]} completed.`);
  },

  async executeFreshmarketer(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "freshmarketer",
      input.connectionId,
    );
    const credentials = this.freshmarketerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("freshmarketer", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "freshmarketer.listContactFilters") {
      action = "freshmarketer_filter_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshmarketer",
      );
      data = await this.freshmarketerApi.listContactFilters(credentials);
    } else if (name === "freshmarketer.listContactMetadata") {
      action = "freshmarketer_contact_metadata_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshmarketer",
      );
      data = await this.freshmarketerApi.listContactMetadata(credentials, {
        viewId: Number(input.input.viewId),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "freshmarketer.request") {
      action = "freshmarketer_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshmarketer",
      );
      data = await this.freshmarketerApi.request(credentials, {
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
      eventType: `marketplace.freshmarketer.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        bundleUrlHash: this.hash(credentials.bundleUrl),
        viewIdHash: this.stringOrNull(input.input.viewId)
          ? this.hash(this.stringOrNull(input.input.viewId)!)
          : null,
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Freshmarketer ${name.split(".")[1]} completed.`);
  },

  async executeFrontify(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "frontify",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const accountOrigin = this.requiredString(
      connection.metadata?.frontifyAccountOrigin,
      "Frontify account",
    );
    const tool = this.registry.getTool("frontify", input.toolName)!;
    const document = this.requiredString(input.input.document, "document");
    const variables =
      input.input.variables &&
      typeof input.input.variables === "object" &&
      !Array.isArray(input.input.variables)
        ? (input.input.variables as Record<string, unknown>)
        : undefined;
    const operationName =
      this.stringOrNull(input.input.operationName) ?? undefined;
    let data: unknown;
    if (tool.name === "frontify.query") {
      data = await this.frontifyApi.query(token.accessToken, accountOrigin, {
        document,
        variables,
        operationName,
      });
    } else if (tool.name === "frontify.mutate") {
      await this.requireConnectorApproval(
        input,
        connection,
        "frontify_brand_manage",
        "frontify",
      );
      data = await this.frontifyApi.mutate(token.accessToken, accountOrigin, {
        document,
        variables,
        operationName,
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
      eventType: `marketplace.frontify.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operationName: operationName ?? null,
      },
    });
    return this.ok(data, `Frontify ${tool.name.split(".")[1]} completed.`);
  },
};

export const ContentCreativeExecutors1Registrations = {
  "asset-bank": { methodName: "executeAssetBank", needsConnection: false },
  audiomack: { methodName: "executeAudiomack", needsConnection: false },
  audius: { methodName: "executeAudius", needsConnection: false },
  bandcamp: { methodName: "executeBandcamp", needsConnection: false },
  beehiiv: { methodName: "executeBeehiiv", needsConnection: false },
  bluesky: { methodName: "executeBluesky", needsConnection: false },
  buzzsprout: { methodName: "executeBuzzsprout", needsConnection: false },
  bynder: { methodName: "executeBynder", needsConnection: false },
  canto: { methodName: "executeCanto", needsConnection: false },
  canva: { methodName: "executeCanva", needsConnection: false },
  "captivate-fm": { methodName: "executeCaptivateFm", needsConnection: false },
  claygent: { methodName: "executeClaygent", needsConnection: false },
  contentful: { methodName: "executeContentful", needsConnection: false },
  daminion: { methodName: "executeDaminion", needsConnection: false },
  descript: { methodName: "executeDescript", needsConnection: false },
  deviantart: { methodName: "executeDeviantArt", needsConnection: false },
  "draw-io": { methodName: "executeDrawIo", needsConnection: false },
  dribbble: { methodName: "executeDribbble", needsConnection: false },
  figjam: { methodName: "executeFigJam", needsConnection: false },
  figma: { methodName: "executeFigma", needsConnection: false },
  flickr: { methodName: "executeFlickr", needsConnection: false },
  "frame-io": { methodName: "executeFrameIo", needsConnection: false },
  freshmarketer: { methodName: "executeFreshmarketer", needsConnection: false },
  frontify: { methodName: "executeFrontify", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof ContentCreativeExecutors1>;
