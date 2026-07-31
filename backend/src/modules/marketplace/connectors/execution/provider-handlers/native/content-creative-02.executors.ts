import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import {
  ApprovalEntity,
  MarketplaceConnectionEntity,
} from "../../../../../../entities";
import { NextdoorApiAdapter } from "../../../nextdoor/nextdoor-api.adapter";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const ContentCreativeExecutors2 = {
  async executeGhost(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ghost",
      input.connectionId,
    );
    const credentials = this.ghostCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("ghost", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action = tool.functionName;

    if (name === "ghost.getSite") {
      data = await this.ghostApi.getSite(credentials);
    } else if (name === "ghost.listPosts") {
      data = await this.ghostApi.listPosts(credentials, input.input);
    } else if (name === "ghost.getPost") {
      data = await this.ghostApi.getPost(credentials, input.input);
    } else if (name === "ghost.preparePostChange") {
      data = this.ghostApi.preparePostChange(input.input);
    } else if (name === "ghost.createDraft") {
      action = "ghost_post_create_draft";
      await this.requireGhostApproval(input, connection, action);
      data = await this.ghostApi.createDraft(credentials, input.input);
    } else if (name === "ghost.updateDraft") {
      action = "ghost_post_update_draft";
      await this.requireGhostApproval(input, connection, action);
      data = await this.ghostApi.updateDraft(credentials, input.input);
    } else if (name === "ghost.publishPost") {
      action = "ghost_post_publish";
      await this.requireGhostApproval(input, connection, action);
      data = await this.ghostApi.publishPost(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }

    const isWrite = tool.action === "write";
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.ghost.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        publicationOriginHash: this.hash(credentials.adminUrl),
        postId: this.stringOrNull(input.input.postId),
        expectedUpdatedAt: this.stringOrNull(input.input.expectedUpdatedAt),
        ...(isWrite
          ? {
              idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
              resultHash: this.hash(JSON.stringify(data)),
            }
          : {}),
      },
    });
    return this.ok(data, `Ghost ${name.split(".")[1]} completed.`);
  },

  async executeGhostSelfHosted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ghost-self-hosted",
      input.connectionId,
    );
    const credentials = this.ghostSelfHostedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("ghost-self-hosted", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "ghost-self-hosted",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "ghostSelfHosted.listPosts")
      data = await this.ghostSelfHostedApi.listPosts(credentials, payload);
    else if (tool.name === "ghostSelfHosted.getPost")
      data = await this.ghostSelfHostedApi.getPost(credentials, payload);
    else if (tool.name === "ghostSelfHosted.createDraft")
      data = await this.ghostSelfHostedApi.createDraft(credentials, payload);
    else if (tool.name === "ghostSelfHosted.updatePost")
      data = await this.ghostSelfHostedApi.updatePost(credentials, payload);
    else if (tool.name === "ghostSelfHosted.setStatus")
      data = await this.ghostSelfHostedApi.setStatus(credentials, payload);
    else if (tool.name === "ghostSelfHosted.deletePost")
      data = await this.ghostSelfHostedApi.deletePost(credentials, payload);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.ghost_self_hosted.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        postIdHash: input.input.postId
          ? this.hash(String(input.input.postId))
          : null,
        installationBound: true,
        limit: input.input.limit ?? null,
        postContentLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(
      data,
      `Ghost Self-Hosted ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeGooglePhotos(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-photos",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-photos", input.toolName)!;
    const name = tool.name;
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (name === "googlePhotos.createPickerSession") {
      await this.requireConnectorApproval(
        input,
        connection,
        "google_photos_picker_session_create",
        "google-photos",
      );
      data = await this.googlePhotosApi.createPickerSession(
        token.accessToken,
        input.input,
      );
    } else if (name === "googlePhotos.getPickerSession")
      data = await this.googlePhotosApi.getPickerSession(
        token.accessToken,
        input.input,
      );
    else if (name === "googlePhotos.listPickedMedia")
      data = await this.googlePhotosApi.listPickedMedia(
        token.accessToken,
        input.input,
      );
    else if (name === "googlePhotos.deletePickerSession") {
      await this.requireConnectorApproval(
        input,
        connection,
        "google_photos_picker_session_delete",
        "google-photos",
      );
      data = await this.googlePhotosApi.deletePickerSession(
        token.accessToken,
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
      eventType: `marketplace.google-photos.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        sessionIdHash: this.stringOrNull(input.input.sessionId)
          ? this.hash(this.stringOrNull(input.input.sessionId)!)
          : null,
        pickerOnly: true,
        userSelectionRequired: true,
        rawMediaAccessed: false,
        automaticPolling: false,
        automaticPagination: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Photos ${name.split(".")[1]} completed.`);
  },

  async executeGoogleSlides(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-slides",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-slides", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "googleSlides.prepareUpdate")
      data = this.googleSlidesApi.prepareUpdate(input.input);
    else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "googleSlides.getPresentation")
        data = await this.googleSlidesApi.getPresentation(
          token.accessToken,
          input.input,
        );
      else if (name === "googleSlides.getPage")
        data = await this.googleSlidesApi.getPage(
          token.accessToken,
          input.input,
        );
      else if (name === "googleSlides.replaceText") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_slides_text_replace",
          "google-slides",
        );
        data = await this.googleSlidesApi.replaceText(
          token.accessToken,
          input.input,
        );
      } else if (name === "googleSlides.createSlide") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_slides_slide_create",
          "google-slides",
        );
        data = await this.googleSlidesApi.createSlide(
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
      eventType: `marketplace.google-slides.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        presentationIdHash: this.stringOrNull(input.input.presentationId)
          ? this.hash(this.stringOrNull(input.input.presentationId)!)
          : null,
        pageObjectIdHash: this.stringOrNull(input.input.pageObjectId)
          ? this.hash(this.stringOrNull(input.input.pageObjectId)!)
          : null,
        idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Slides ${name.split(".")[1]} completed.`);
  },

  async executeJellyfin(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "jellyfin",
      input.connectionId,
    );
    const credentials = this.jellyfinCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("jellyfin", input.toolName)!;
    if (tool.name !== "jellyfin.getSelectedItemLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.jellyfinApi.getSelectedItemLifecycle(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.jellyfin.getSelectedItemLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        publicHttpsServerBaseUrlBound: true,
        selectedItemIdBound: true,
        privateMetadataAndMediaContentExcluded: true,
        playbackAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(data, "Jellyfin getSelectedItemLifecycle completed.");
  },

  async executeKontainer(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "kontainer",
      input.connectionId,
    );
    const credentials = this.kontainerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("kontainer", input.toolName)!;
    const path = this.requiredString(input.input.path, "path");
    const query =
      input.input.query &&
      typeof input.input.query === "object" &&
      !Array.isArray(input.input.query)
        ? (input.input.query as Record<string, unknown>)
        : undefined;
    let data: unknown;
    if (tool.name === "kontainer.read") {
      data = await this.kontainerApi.request(credentials, {
        method: "GET",
        path,
        query,
      });
    } else if (tool.name === "kontainer.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "kontainer_dam_manage",
        "kontainer",
      );
      data = await this.kontainerApi.request(credentials, {
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
      eventType: `marketplace.kontainer.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "kontainer.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path,
      },
    });
    return this.ok(data, `Kontainer ${tool.name.split(".")[1]} completed.`);
  },

  async executeLinkedIn(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "linkedin",
      input.connectionId,
    );
    const tool = this.registry.getTool("linkedin", input.toolName)!;
    const name = tool.name;
    if (name === "linkedin.createDraft") {
      const text = this.requiredString(input.input.text, "text");
      if (text.length > 3000)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "LinkedIn draft text must be 3,000 characters or fewer.",
        );
      const data = {
        draftId: `linkedin-draft-${this.hash(text).slice(0, 16)}`,
        text,
        characterCount: text.length,
        providerCallMade: false,
      };
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.linkedin.draft.created",
        resourceId: connection.id,
        metadata: {
          textHash: this.hash(text),
          characterCount: text.length,
          providerCallMade: false,
        },
      });
      return this.ok(data, "LinkedIn local text draft created.");
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (name === "linkedin.getProfile") {
      const data = await this.linkedInApi.getMe(token.accessToken);
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.linkedin.profile.read",
        resourceId: connection.id,
        metadata: {
          memberSubjectHash: this.hash(
            this.stringOrNull(connection.metadata?.memberId) ?? "unknown",
          ),
          emailPictureExcluded: true,
        },
      });
      return this.ok(data, "LinkedIn profile read completed.");
    }
    if (name === "linkedin.createTextPost") {
      await this.requireConnectorApproval(
        input,
        connection,
        "linkedin_text_post_create",
        "linkedin",
      );
      const text = this.requiredString(input.input.text, "text");
      const data = await this.linkedInApi.createTextPost(
        token.accessToken,
        text,
        this.stringOrNull(connection.metadata?.memberUrn),
      );
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.linkedin.post.published",
        resourceId: connection.id,
        metadata: {
          textHash: this.hash(text),
          characterCount: text.length,
          connectedMemberOnly: true,
          textOnly: true,
          postUrn: this.stringOrNull(this.objectOrNull(data)?.postUrn),
        },
      });
      return this.ok(data, "Approved LinkedIn post published.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeLocalWordPressOrg(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
  ) {
    if (!this.localWordPressOrgCli)
      return this.safeError(
        "tool_unavailable",
        "Local WordPress.org source-host executor is not registered",
      );
    const tool = this.registry.getTool("local-wordpress-org", input.toolName);
    if (!tool)
      return this.safeError(
        "tool_unavailable",
        "Local WordPress.org tool is not registered",
      );
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "local-wordpress-org",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    const result = await this.localWordPressOrgCli.execute({
      workspaceId: input.workspaceId,
      toolName: tool.functionName,
      credentials: this.localWordPressOrgCredentials(connection),
      payload,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.local_wordpress_org.${tool.functionName}.completed`,
      resourceId: connection.id,
      metadata: {
        ...(result.auditMetadata ?? {}),
        sourceHostBound: true,
        sitePathBound: true,
      },
    });
    return result;
  },

  async executeLucidchart(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "lucidchart",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("lucidchart", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "lucidchart.read") {
      data = await this.lucidchartApi.callRead(token.accessToken, input.input);
    } else if (name === "lucidchart.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "lucidchart",
      );
      data = await this.lucidchartApi.callWrite(token.accessToken, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.lucidchart.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "lucidchart.read"
            ? (this.stringOrNull(input.input.method) ?? "GET")
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
    return this.ok(data, `Lucidchart ${name.split(".")[1]} completed.`);
  },

  async executeLucidspark(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "lucidspark",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("lucidspark", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "lucidspark.read") {
      data = await this.lucidsparkApi.callRead(token.accessToken, input.input);
    } else if (name === "lucidspark.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "lucidspark",
      );
      data = await this.lucidsparkApi.callWrite(token.accessToken, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.lucidspark.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "lucidspark.read"
            ? (this.stringOrNull(input.input.method) ?? "GET")
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
    return this.ok(data, `Lucidspark ${name.split(".")[1]} completed.`);
  },

  async executeMastodon(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mastodon",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("mastodon", input.toolName)!;
    const origin = this.stringOrNull(
      connection.metadata?.mastodonInstanceOrigin,
    );
    const accountId = this.stringOrNull(connection.metadata?.mastodonAccountId);
    const maxCharacters = Number(
      connection.metadata?.mastodonMaxCharacters ?? 500,
    );
    if (!origin || !accountId)
      return this.safeError(
        "connection_not_ready",
        "Mastodon connection is not bound to an instance and local account",
      );
    let data: unknown;
    if (tool.name === "relay_mastodon_get_account") {
      data = await this.mastodonApi.getAccount(origin, token.accessToken);
      if ((data as { accountId?: string }).accountId !== accountId)
        throw new ConnectorExecutionError(
          "connection_not_ready",
          "Mastodon connected account changed; reconnect is required",
        );
    } else if (tool.name === "relay_mastodon_list_own_statuses") {
      const statuses = await this.mastodonApi.listOwnStatuses(
        origin,
        token.accessToken,
        accountId,
        input.input.limit,
      );
      data = { statuses, count: statuses.length, nextPageFollowed: false };
    } else if (tool.name === "relay_mastodon_draft_text_status") {
      data = this.mastodonApi.draftText(
        input.input.text,
        input.input.visibility,
        input.input.language,
        maxCharacters,
      );
    } else if (tool.name === "relay_mastodon_publish_text_status") {
      await this.requireMastodonPublishApproval(input, connection);
      data = await this.mastodonApi.publishText(
        origin,
        token.accessToken,
        input.input.text,
        input.input.visibility,
        input.input.language,
        maxCharacters,
        `relay-${this.hash(`${connection.id}:${input.dispatchId}`).slice(0, 48)}`,
      );
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mastodon.${tool.name}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        instanceHash: this.hash(origin),
        accountIdHash: this.hash(accountId),
        textHash: this.stringOrNull(input.input.text)
          ? this.hash(this.stringOrNull(input.input.text)!)
          : null,
        visibility: this.stringOrNull(input.input.visibility),
        limit: input.input.limit ?? null,
        providerDataPersisted: false,
        automaticRetry: false,
      },
    });
    return this.ok(
      data,
      `Mastodon ${tool.name.replace("relay_mastodon_", "").replaceAll("_", " ")} completed.`,
    );
  },

  async executeMindMeister(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mindmeister",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("mindmeister", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "mindmeister.read")
      data = await this.mindMeisterApi.callRead(token.accessToken, input.input);
    else if (name === "mindmeister.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "mindmeister",
      );
      data = await this.mindMeisterApi.callWrite(
        token.accessToken,
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
      eventType: `marketplace.mindmeister.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        parameterKeys: Object.keys(
          this.objectOrNull(input.input.params) ?? {},
        ).slice(0, 100),
        queryKeys: Object.keys(
          this.objectOrNull(input.input.query) ?? {},
        ).slice(0, 50),
      },
    });
    return this.ok(data, `MindMeister ${name.split(".")[1]} completed.`);
  },

  async executeMiro(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "miro",
      input.connectionId,
    );
    const tool = this.registry.getTool("miro", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action = tool.functionName;

    if (name === "miro.prepareItemChange") {
      data = this.miroApi.prepareItemChange(input.input);
    } else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "miro.listBoards") {
        data = await this.miroApi.listBoards(token.accessToken, input.input);
      } else if (name === "miro.getBoard") {
        data = await this.miroApi.getBoard(token.accessToken, input.input);
      } else if (name === "miro.listBoardItems") {
        data = await this.miroApi.listBoardItems(
          token.accessToken,
          input.input,
        );
      } else if (name === "miro.getBoardItem") {
        data = await this.miroApi.getBoardItem(token.accessToken, input.input);
      } else if (name === "miro.createStickyNote") {
        action = "miro_sticky_note_create";
        await this.requireMiroApproval(input, connection, action);
        data = await this.miroApi.createStickyNote(
          token.accessToken,
          input.input,
        );
      } else if (name === "miro.createCard") {
        action = "miro_card_create";
        await this.requireMiroApproval(input, connection, action);
        data = await this.miroApi.createCard(token.accessToken, input.input);
      } else if (name === "miro.updateItem") {
        action = "miro_item_update";
        await this.requireMiroApproval(input, connection, action);
        data = await this.miroApi.updateItem(token.accessToken, input.input);
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
      eventType: `marketplace.miro.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        boardId: this.stringOrNull(input.input.boardId),
        itemId: this.stringOrNull(input.input.itemId),
        itemType: this.stringOrNull(input.input.itemType),
        ...(isWrite
          ? {
              idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
              resultHash: this.hash(JSON.stringify(data)),
            }
          : {}),
      },
    });
    return this.ok(data, `Miro ${name.split(".")[1]} completed.`);
  },

  async executeMixcloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mixcloud",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("mixcloud", input.toolName)!;
    let data: unknown;
    let operation: string;
    if (tool.name === "mixcloud.read") {
      operation = "read";
      data = await this.mixcloudApi.read(
        token.accessToken,
        this.requiredString(input.input.key, "key"),
        this.objectOrNull(input.input.query) ?? {},
      );
    } else if (tool.name === "mixcloud.engage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "mixcloud_engage",
        "mixcloud",
      );
      operation = this.requiredString(input.input.operation, "operation");
      data = await this.mixcloudApi.engage(
        token.accessToken,
        this.requiredString(input.input.key, "key"),
        this.requiredString(input.input.action, "action"),
        operation === "remove",
      );
    } else if (tool.name === "mixcloud.upload") {
      await this.requireConnectorApproval(
        input,
        connection,
        "mixcloud_upload",
        "mixcloud",
      );
      operation = this.requiredString(input.input.operation, "operation");
      data = await this.mixcloudApi.upload(
        token.accessToken,
        {
          key: this.stringOrNull(input.input.key) ?? undefined,
          base64: this.stringOrNull(input.input.base64) ?? undefined,
          fileName: this.stringOrNull(input.input.fileName) ?? undefined,
          pictureBase64:
            this.stringOrNull(input.input.pictureBase64) ?? undefined,
          pictureFileName:
            this.stringOrNull(input.input.pictureFileName) ?? undefined,
          fields: this.objectOrNull(input.input.fields) ?? undefined,
        },
        operation === "edit",
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
      eventType: `marketplace.mixcloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Mixcloud ${tool.name.split(".")[1]} completed.`);
  },

  async executeMural(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mural",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("mural", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "mural.read") {
      data = await this.muralApi.callRead(token.accessToken, input.input);
    } else if (name === "mural.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "collaboration_write",
        "mural",
      );
      data = await this.muralApi.callWrite(token.accessToken, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mural.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "mural.read" ? "GET" : this.stringOrNull(input.input.method),
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
    return this.ok(data, `Mural ${name.split(".")[1]} completed.`);
  },

  async executeNextdoor(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "nextdoor",
      input.connectionId,
    );
    const tool = this.registry.getTool("nextdoor", input.toolName)!;
    const name = tool.name;
    const selectedProfileId = this.stringOrNull(
      connection.metadata?.selectedProfileId,
    );
    if (!selectedProfileId) {
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "Nextdoor selected profile binding is missing",
      );
    }
    if (name === "relay_nextdoor_draft_text_post") {
      const prepared = this.nextdoorApi.prepareTextPost(
        this.requiredString(input.input.text, "text"),
      );
      return this.ok(prepared, "Nextdoor text draft prepared locally.");
    }
    let pendingPublish: {
      prepared: ReturnType<NextdoorApiAdapter["prepareTextPost"]>;
      approval: ApprovalEntity | null;
    } | null = null;
    if (name === "relay_nextdoor_publish_text_post") {
      const prepared = this.nextdoorApi.prepareTextPost(
        this.requiredString(input.input.text, "text"),
      );
      pendingPublish = {
        prepared,
        approval: await this.requireNextdoorPublishApproval(
          input,
          connection,
          prepared.text,
        ),
      };
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (name === "relay_nextdoor_get_profile") {
      await this.oauth.validateNextdoorProfile(connection, token.accessToken);
      return this.ok(
        {
          profileType: this.stringOrNull(
            connection.metadata?.selectedProfileType,
          ),
          displayName: this.stringOrNull(connection.metadata?.displayName),
          neighborhoodName: this.stringOrNull(
            connection.metadata?.neighborhoodName,
          ),
          cityName: this.stringOrNull(connection.metadata?.cityName),
          verified: connection.metadata?.profileVerified === true,
          profileBindingVerified:
            connection.metadata?.selectedProfileIdBound === true,
        },
        "Nextdoor selected profile read completed.",
      );
    }
    if (name === "relay_nextdoor_list_own_posts") {
      const requested = Number(input.input.limit ?? 10);
      const limit = Number.isFinite(requested)
        ? Math.max(1, Math.min(10, Math.trunc(requested)))
        : 10;
      const posts = await this.nextdoorApi.listOwnPosts(
        token.accessToken,
        selectedProfileId,
        limit,
      );
      return this.ok(
        { posts, count: posts.length },
        "Nextdoor own posts read completed.",
      );
    }
    if (name === "relay_nextdoor_publish_text_post") {
      const { prepared, approval } = pendingPublish!;
      let post: Awaited<ReturnType<NextdoorApiAdapter["createTextPost"]>>;
      try {
        post = await this.nextdoorApi.createTextPost(
          token.accessToken,
          selectedProfileId,
          prepared.text,
        );
      } catch (error) {
        if (approval) {
          approval.status = "execution_uncertain";
          approval.metadata = {
            ...approval.metadata,
            executionUncertainAt: new Date().toISOString(),
          };
          await this.approvalRepo.save(approval);
        }
        throw error;
      }
      if (approval) {
        approval.status = "executed";
        approval.metadata = {
          ...approval.metadata,
          executedAt: new Date().toISOString(),
        };
        await this.approvalRepo.save(approval);
      }
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.nextdoor.post.published",
        resourceId: connection.id,
        metadata: {
          approvalId: approval?.id ?? null,
          directWrite: !approval,
          textHash: this.hash(prepared.text),
          postId: this.stringOrNull((post as any).postId),
        },
      });
      return this.ok(post, "Nextdoor text post published.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executePadlet(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "padlet",
      input.connectionId,
    );
    const credentials = this.padletCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("padlet", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "padlet.getCurrentUser")
      data = await this.padletApi.getCurrentUser(credentials, input.input);
    else if (name === "padlet.getBoard")
      data = await this.padletApi.getBoard(credentials, input.input);
    else if (name === "padlet.getOrganization")
      data = await this.padletApi.getOrganization(credentials, input.input);
    else if (name === "padlet.getUserInOrganization")
      data = await this.padletApi.getUserInOrganization(
        credentials,
        input.input,
      );
    else if (name === "padlet.getPostAttachmentData")
      data = await this.padletApi.getPostAttachmentData(
        credentials,
        input.input,
      );
    else if (name === "padlet.getAiRecipeBoardStatus")
      data = await this.padletApi.getAiRecipeBoardStatus(
        credentials,
        input.input,
      );
    else if (name === "padlet.createPost") {
      await this.requireConnectorApproval(
        input,
        connection,
        "create_post",
        "padlet",
      );
      data = await this.padletApi.createPost(credentials, input.input);
    } else if (name === "padlet.createComment") {
      await this.requireConnectorApproval(
        input,
        connection,
        "create_comment",
        "padlet",
      );
      data = await this.padletApi.createComment(credentials, input.input);
    } else if (name === "padlet.createReaction") {
      await this.requireConnectorApproval(
        input,
        connection,
        "create_reaction",
        "padlet",
      );
      data = await this.padletApi.createReaction(credentials, input.input);
    } else if (name === "padlet.createAiRecipeBoard") {
      await this.requireConnectorApproval(
        input,
        connection,
        "create_ai_recipe_board",
        "padlet",
      );
      data = await this.padletApi.createAiRecipeBoard(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.padlet.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        boardId: this.stringOrNull(input.input.boardId),
        organizationId: this.stringOrNull(input.input.organizationId),
        userId: this.stringOrNull(input.input.userId),
        postId: this.stringOrNull(input.input.postId),
        statusKey: this.stringOrNull(input.input.statusKey),
      },
    });
    return this.ok(data, `Padlet ${name.split(".")[1]} completed.`);
  },

  async executePinterest(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "pinterest",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("pinterest", input.toolName)!;
    const username = this.stringOrNull(connection.metadata?.pinterestUsername);
    const accountId = this.stringOrNull(
      connection.metadata?.pinterestUserAccountId,
    );
    if (!username || !accountId)
      return this.safeError(
        "connection_not_ready",
        "Pinterest connection is not bound to a user account",
      );
    let data: unknown;
    if (tool.name === "relay_pinterest_get_user_account") {
      data = await this.pinterestApi.getUserAccount(token.accessToken);
      if ((data as { userAccountId?: string }).userAccountId !== accountId)
        throw new ConnectorExecutionError(
          "connection_not_ready",
          "Pinterest connected account changed; reconnect is required",
        );
    } else if (tool.name === "relay_pinterest_list_public_boards") {
      const boards = await this.pinterestApi.listBoards(
        token.accessToken,
        username,
        input.input.limit,
      );
      data = { boards, count: boards.length, nextPageFollowed: false };
    } else if (tool.name === "relay_pinterest_list_public_pins") {
      const pins = await this.pinterestApi.listPins(
        token.accessToken,
        username,
        input.input.limit,
      );
      data = { pins, count: pins.length, nextPageFollowed: false };
    } else if (tool.name === "relay_pinterest_get_public_pin")
      data = await this.pinterestApi.getPin(
        token.accessToken,
        username,
        input.input.pinId,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.pinterest.${tool.name}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        accountIdHash: this.hash(accountId),
        pinIdHash: this.stringOrNull(input.input.pinId)
          ? this.hash(this.stringOrNull(input.input.pinId)!)
          : null,
        limit: input.input.limit ?? null,
        providerDataPersisted: false,
      },
    });
    return this.ok(
      data,
      `Pinterest ${tool.name.replace("relay_pinterest_", "").replaceAll("_", " ")} completed.`,
    );
  },

  async executePlexPersonalMediaServer(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "plex-personal-media-server",
      input.connectionId,
    );
    const credentials = this.plexPersonalMediaServerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "plex-personal-media-server",
      input.toolName,
    )!;
    if (tool.name !== "plex-personal-media-server.getSelectedItemLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.plexPersonalMediaServerApi.getSelectedItemLifecycle(
        credentials,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.plex-personal-media-server.getSelectedItemLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        publicPlexDirectOriginBound: true,
        selectedRatingKeyBound: true,
        privateMetadataAndMediaContentExcluded: true,
        playbackAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(
      data,
      "Plex Personal Media Server getSelectedItemLifecycle completed.",
    );
  },

  async executePodbean(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "podbean",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("podbean", input.toolName)!;
    let data: unknown;
    let operation = "upload";
    if (tool.name === "podbean.read") {
      operation = this.requiredString(input.input.operation, "operation");
      data = await this.podbeanApi.execute(token.accessToken, operation, {
        path: this.objectOrNull(input.input.path) ?? {},
        parameters: this.objectOrNull(input.input.parameters) ?? {},
      });
    } else if (tool.name === "podbean.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "podbean_manage",
        "podbean",
      );
      operation = this.requiredString(input.input.operation, "operation");
      data = await this.podbeanApi.execute(token.accessToken, operation, {
        path: this.objectOrNull(input.input.path) ?? {},
        parameters: this.objectOrNull(input.input.parameters) ?? {},
      });
    } else if (tool.name === "podbean.upload") {
      await this.requireConnectorApproval(
        input,
        connection,
        "podbean_upload",
        "podbean",
      );
      data = await this.podbeanApi.upload(token.accessToken, {
        base64: this.requiredString(input.input.base64, "base64"),
        fileName: this.requiredString(input.input.fileName, "fileName"),
        contentType: this.requiredString(
          input.input.contentType,
          "contentType",
        ),
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.podbean.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Podbean ${tool.name.split(".")[1]} completed.`);
  },

  async executeRestream(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "restream",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("restream", input.toolName)!;
    const name = tool.name;
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "restream",
      );

    let data: unknown;
    if (name === "restream.getProfile")
      data = await this.restreamApi.getProfile(token.accessToken);
    else if (name === "restream.listChannels")
      data = await this.restreamApi.listChannels(token.accessToken);
    else if (name === "restream.listEvents")
      data = await this.restreamApi.listEvents(token.accessToken, input.input);
    else if (name === "restream.getEvent")
      data = await this.restreamApi.getEvent(token.accessToken, input.input);
    else if (name === "restream.getEventChatHistory")
      data = await this.restreamApi.getEventChatHistory(
        token.accessToken,
        input.input,
      );
    else if (name === "restream.getEventAnalytics")
      data = await this.restreamApi.getEventAnalytics(
        token.accessToken,
        input.input,
      );
    else if (name === "restream.listStorageFiles")
      data = await this.restreamApi.listStorageFiles(token.accessToken);
    else if (name === "restream.listClipProjects")
      data = await this.restreamApi.listClipProjects(
        token.accessToken,
        input.input,
      );
    else if (name === "restream.getClipProject")
      data = await this.restreamApi.getClipProject(
        token.accessToken,
        input.input,
      );
    else if (name === "restream.listStudioAssets")
      data = await this.restreamApi.listStudioAssets(
        token.accessToken,
        input.input,
      );
    else if (name === "restream.request")
      data = await this.restreamApi.requestDocumented(
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
      eventType: `marketplace.restream.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        eventId: this.stringOrNull(input.input.eventId),
        projectId: this.stringOrNull(input.input.projectId),
        kind: this.stringOrNull(input.input.kind),
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Restream ${name.split(".")[1]} completed.`);
  },

  async executeRev(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "rev",
      input.connectionId,
    );
    const credentials = this.revCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("rev", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "rev.listOrders")
      data = await this.revApi.listOrders(credentials, input.input);
    else if (name === "rev.getOrder")
      data = await this.revApi.getOrder(credentials, input.input);
    else if (name === "rev.getAttachment")
      data = await this.revApi.getAttachment(credentials, input.input);
    else if (name === "rev.getAttachmentContent")
      data = await this.revApi.getAttachmentContent(credentials, input.input);
    else if (name === "rev.listWorkspaces")
      data = await this.revApi.listWorkspaces(credentials);
    else if (name === "rev.listTemplates")
      data = await this.revApi.listTemplates(credentials);
    else if (name === "rev.createInput") {
      await this.requireConnectorApproval(input, connection, "ordering", "rev");
      data = await this.revApi.createInput(credentials, input.input);
    } else if (name === "rev.placeOrder") {
      await this.requireConnectorApproval(input, connection, "ordering", "rev");
      data = await this.revApi.placeOrder(credentials, input.input);
    } else if (name === "rev.cancelOrder") {
      await this.requireConnectorApproval(input, connection, "ordering", "rev");
      data = await this.revApi.cancelOrder(credentials, input.input);
    } else if (name === "rev.deleteOrderData") {
      await this.requireConnectorApproval(input, connection, "sharing", "rev");
      data = await this.revApi.deleteOrderData(credentials, input.input);
    } else if (name === "rev.createShareLink") {
      await this.requireConnectorApproval(input, connection, "sharing", "rev");
      data = await this.revApi.createShareLink(credentials, input.input);
    } else if (name === "rev.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "administration",
        "rev",
      );
      data = await this.revApi.request(credentials, {
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
      eventType: `marketplace.rev.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        orderNumber:
          this.stringOrNull(input.input.orderNumber) ??
          this.stringOrNull(input.input.order_number),
        attachmentId: this.stringOrNull(input.input.attachmentId),
        sandboxMode: input.input.sandbox_mode === true,
      },
    });
    return this.ok(data, `Rev ${name.split(".")[1]} completed.`);
  },
};

export const ContentCreativeExecutors2Registrations = {
  ghost: { methodName: "executeGhost", needsConnection: false },
  "ghost-self-hosted": {
    methodName: "executeGhostSelfHosted",
    needsConnection: false,
  },
  "google-photos": {
    methodName: "executeGooglePhotos",
    needsConnection: false,
  },
  "google-slides": {
    methodName: "executeGoogleSlides",
    needsConnection: false,
  },
  jellyfin: { methodName: "executeJellyfin", needsConnection: false },
  kontainer: { methodName: "executeKontainer", needsConnection: false },
  linkedin: { methodName: "executeLinkedIn", needsConnection: false },
  "local-wordpress-org": {
    methodName: "executeLocalWordPressOrg",
    needsConnection: true,
  },
  lucidchart: { methodName: "executeLucidchart", needsConnection: false },
  lucidspark: { methodName: "executeLucidspark", needsConnection: false },
  mastodon: { methodName: "executeMastodon", needsConnection: false },
  mindmeister: { methodName: "executeMindMeister", needsConnection: false },
  miro: { methodName: "executeMiro", needsConnection: false },
  mixcloud: { methodName: "executeMixcloud", needsConnection: false },
  mural: { methodName: "executeMural", needsConnection: false },
  nextdoor: { methodName: "executeNextdoor", needsConnection: false },
  padlet: { methodName: "executePadlet", needsConnection: false },
  pinterest: { methodName: "executePinterest", needsConnection: false },
  "plex-personal-media-server": {
    methodName: "executePlexPersonalMediaServer",
    needsConnection: false,
  },
  podbean: { methodName: "executePodbean", needsConnection: false },
  restream: { methodName: "executeRestream", needsConnection: false },
  rev: { methodName: "executeRev", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof ContentCreativeExecutors2>;
