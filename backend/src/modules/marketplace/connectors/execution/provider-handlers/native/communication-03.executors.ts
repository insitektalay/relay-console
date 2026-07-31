import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const CommunicationExecutors3 = {
  async executeMessageGears(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "messagegears",
      input.connectionId,
    );
    const credentials = this.messageGearsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("messagegears", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "messagegears",
      );
    const data =
      tool.action === "read"
        ? await this.messageGearsApi.read(credentials, operation, input.input)
        : await this.messageGearsApi.manage(
            credentials,
            operation,
            input.input,
          );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.messagegears.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `MessageGears ${operation} completed.`);
  },

  async executeMetricool(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "metricool",
      input.connectionId,
    );
    const credentials = this.metricoolCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("metricool", input.toolName)!;
    let data: unknown;
    if (tool.name === "metricool.listBrands")
      data = await this.metricoolApi.listBrands(credentials);
    else if (tool.name === "metricool.listConnectedNetworks")
      data = await this.metricoolApi.listConnectedNetworks(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Metricool redacted brand-structure read completed.");
  },

  async executeMicrosoftTeamsReadOnly(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-teams",
      input.connectionId,
    );
    const tool = this.registry.getTool("microsoft-teams", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "microsoftTeams.listJoinedTeams")
      data = await this.microsoftTeamsGraph.listJoinedTeams(token.accessToken);
    else if (tool.name === "microsoftTeams.getTeam")
      data = await this.microsoftTeamsGraph.getTeam(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "microsoftTeams.listChannels")
      data = await this.microsoftTeamsGraph.listChannels(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "microsoftTeams.getChannel")
      data = await this.microsoftTeamsGraph.getChannel(
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
      eventType: `marketplace.microsoft-teams.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        teamIdHash: input.input.teamId
          ? this.hash(String(input.input.teamId))
          : null,
        channelIdHash: input.input.channelId
          ? this.hash(String(input.input.channelId))
          : null,
        exactDelegatedMetadataScopes: true,
        workSchoolOnly: true,
        maxResults: 25,
        messageContentEnabled: false,
        membersDirectoryEnabled: false,
        otherWorkloadsEnabled: false,
        writesEnabled: false,
        applicationPermissionsEnabled: false,
        meteredApisEnabled: false,
        automaticPagination: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      `Microsoft Teams ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeMicrosoftVivaEngage(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-viva-engage",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const binding = this.microsoftVivaEngageBinding(connection);
    const tool = this.registry.getTool(
      "microsoft-viva-engage",
      input.toolName,
    )!;
    let data: unknown;
    if (tool.name === "microsoft-viva-engage.getNetwork")
      data = await this.microsoftVivaEngageApi.getNetwork(
        token.accessToken,
        binding,
      );
    else if (tool.name === "microsoft-viva-engage.getCurrentUser")
      data = await this.microsoftVivaEngageApi.getCurrentUser(
        token.accessToken,
        binding,
      );
    else if (tool.name === "microsoft-viva-engage.listMyCommunities")
      data = await this.microsoftVivaEngageApi.listMyCommunities(
        token.accessToken,
        binding,
      );
    else if (
      tool.name === "microsoft-viva-engage.listSelectedCommunityMessages"
    )
      data = await this.microsoftVivaEngageApi.listSelectedCommunityMessages(
        token.accessToken,
        binding,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.microsoft_viva_engage.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        networkIdHash: this.hash(binding.networkId),
        currentUserIdHash: this.hash(binding.currentUserId),
        selectedCommunityIdHash: this.hash(binding.communityId),
        privateFeedsIdentitiesFilesSearchWritesExcluded: true,
        maxResults: 25,
      },
    });
    return this.ok(
      data,
      `Microsoft Viva Engage ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeMightyNetworks(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mighty-networks",
      input.connectionId,
    );
    const credentials = this.mightyNetworksCredentials(
      this.credentials.decrypt(connection),
      connection.metadata,
    );
    const tool = this.registry.getTool("mighty-networks", input.toolName)!;
    const name = tool.name;
    const action = tool.functionName;
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "mighty-networks",
    );
    let data: unknown;
    if (name === "mightyNetworks.getNetwork")
      data = await this.mightyNetworksApi.getNetwork(credentials);
    else if (name === "mightyNetworks.listSpaces")
      data = await this.mightyNetworksApi.listSpaces(credentials, input.input);
    else if (name === "mightyNetworks.getSpace")
      data = await this.mightyNetworksApi.getSpace(credentials, input.input);
    else if (name === "mightyNetworks.listMembers")
      data = await this.mightyNetworksApi.listMembers(credentials, input.input);
    else if (name === "mightyNetworks.getMember")
      data = await this.mightyNetworksApi.getMember(credentials, input.input);
    else if (name === "mightyNetworks.listPosts")
      data = await this.mightyNetworksApi.listPosts(credentials, input.input);
    else if (name === "mightyNetworks.getPost")
      data = await this.mightyNetworksApi.getPost(credentials, input.input);
    else if (name === "mightyNetworks.listSpaceMembers")
      data = await this.mightyNetworksApi.listSpaceMembers(
        credentials,
        input.input,
      );
    else if (name === "mightyNetworks.addSpaceMember")
      data = await this.mightyNetworksApi.addSpaceMember(
        credentials,
        input.input,
      );
    else if (name === "mightyNetworks.removeSpaceMember")
      data = await this.mightyNetworksApi.removeSpaceMember(
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
      eventType: `marketplace.mighty_networks.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        networkIdHash:
          connection.metadata?.mightyNetworkId != null
            ? this.hash(String(connection.metadata.mightyNetworkId))
            : this.hash(credentials.networkId),
        spaceIdHash:
          input.input.spaceId != null
            ? this.hash(String(input.input.spaceId))
            : null,
        memberIdHash:
          input.input.memberId != null
            ? this.hash(String(input.input.memberId))
            : null,
        userIdHash:
          input.input.userId != null
            ? this.hash(String(input.input.userId))
            : null,
        postIdHash:
          input.input.postId != null
            ? this.hash(String(input.input.postId))
            : null,
        page: input.input.page ?? 1,
        maxResults: input.input.maxResults ?? 25,
      },
    });
    return this.ok(data, `Mighty Networks ${name.split(".")[1]} completed.`);
  },

  async executeMoEngage(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "moengage",
      input.connectionId,
    );
    const credentials = this.moEngageCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("moengage", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "moengage",
      );
    const data =
      tool.action === "read"
        ? await this.moEngageApi.read(credentials, operation, input.input)
        : await this.moEngageApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.moengage.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `MoEngage ${operation} completed.`);
  },

  async executeOlark(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "olark",
      input.connectionId,
    );
    const credentials = this.olarkCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("olark", input.toolName)!;
    if (tool.name !== "olark.projectTranscript")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "olark_transcript_project";
    await this.requireConnectorApproval(input, connection, action, "olark");
    const transcript = this.objectOrNull(input.input.transcript);
    if (!transcript)
      return this.safeError(
        "provider_validation_error",
        "transcript must be an object",
      );
    const data = this.olarkWebhook.projectTranscript(credentials, transcript);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.olark.projectTranscript.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        conversationIdHash: this.hash(data.conversation.conversationId),
      },
    });
    return this.ok(data, "Olark transcript projection completed.");
  },

  async executeOneSignal(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "onesignal",
      input.connectionId,
    );
    const credentials = this.oneSignalCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("onesignal", input.toolName)!;
    if (tool.name !== "onesignal.listNotificationDeliverySummaries")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.oneSignalApi.listNotificationDeliverySummaries(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "OneSignal delivery-summary read completed.");
  },

  async executeOpenPhone(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "openphone",
      input.connectionId,
    );
    const tool = this.registry.getTool("openphone", input.toolName)!;
    if (tool.name !== "relay_openphone_list_phone_numbers")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const credentials = this.openPhoneCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const data = await this.openPhoneApi.listPhoneNumbers(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.openphone.phone_numbers_list.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        resultCount: data.count,
        truncated: data.truncated,
        privacyMasked: true,
        providerContentStored: false,
      },
    });
    return this.ok(data, "Quo privacy-masked phone-number read completed.");
  },

  async executeOrtto(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ortto",
      input.connectionId,
    );
    const credentials = this.orttoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("ortto", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "ortto",
      );
    const data =
      tool.action === "read"
        ? await this.orttoApi.read(credentials, operation, input.input)
        : await this.orttoApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.ortto.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Ortto ${operation} completed.`);
  },

  async executeOtterAi(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "otter-ai",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("otter-ai", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "otter.getUserInfo")
      data = await this.otterAiMcp.getUserInfo(token.accessToken);
    else if (name === "otter.search")
      data = await this.otterAiMcp.search(token.accessToken, input.input);
    else if (name === "otter.fetch")
      data = await this.otterAiMcp.fetch(token.accessToken, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.otter_ai.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        queryLength:
          typeof input.input.query === "string"
            ? input.input.query.length
            : null,
        conversationReference:
          typeof input.input.id === "string" ? "provided" : null,
      },
    });
    return this.ok(data, `Otter.ai ${name.split(".")[1]} completed.`);
  },

  async executeOutlookReadOnly(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "outlook",
      input.connectionId,
    );
    const tool = this.registry.getTool("outlook", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "outlook.listMailFolders")
      data = await this.outlookGraph.listRootMailFolders(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "outlook.listInboxMessages")
      data = await this.outlookGraph.listInboxMessages(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "outlook.listUnreadMessages")
      data = await this.outlookGraph.listUnreadMessages(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "outlook.getMessage")
      data = await this.outlookGraph.getMessage(token.accessToken, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.outlook.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        messageIdHash: input.input.messageId
          ? this.hash(String(input.input.messageId))
          : null,
        exactDelegatedMailRead: true,
        selfMailboxOnly: true,
        maxResults: 25,
        maxBodyCharacters: 8_000,
        sharedMailEnabled: false,
        applicationPermissionsEnabled: false,
        attachmentsEnabled: false,
        searchEnabled: false,
        writesEnabled: false,
        automaticPagination: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Outlook ${tool.name.split(".")[1]} completed.`);
  },

  async executePostmark(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "postmark",
      input.connectionId,
    );
    const credentials = this.postmarkCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("postmark", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "postmark.getServer")
      data = await this.postmarkApi.getServer(credentials);
    else if (name === "postmark.listMessageStreams")
      data = await this.postmarkApi.listMessageStreams(credentials);
    else if (name === "postmark.getOutboundStats")
      data = await this.postmarkApi.getOutboundStats(credentials, input.input);
    else if (name === "postmark.sendEmail") {
      await this.requireConnectorApproval(
        input,
        connection,
        "send_email",
        "postmark",
      );
      data = await this.postmarkApi.sendEmail(credentials, input.input);
    } else if (name === "postmark.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "postmark",
      );
      data = await this.postmarkApi.request(credentials, {
        authority:
          this.stringOrNull(input.input.authority) === "account"
            ? "account"
            : "server",
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        json: this.jsonContainerOrUndefined(input.input.json),
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.postmark.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        senderBoundary: credentials.senderBoundary,
        messageStream: credentials.messageStream,
      },
    });
    return this.ok(data, `Postmark ${name.split(".")[1]} completed.`);
  },

  async executePostscript(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "postscript",
      input.connectionId,
    );
    const credentials = this.postscriptCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("postscript", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "postscript",
      );
    const data =
      tool.action === "read"
        ? await this.postscriptApi.read(credentials, operation, input.input)
        : await this.postscriptApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.postscript.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Postscript ${operation} completed.`);
  },

  async executePubler(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "publer",
      input.connectionId,
    );
    const credentials = this.publerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("publer", input.toolName)!;
    let data: unknown;
    if (tool.name === "publer.listWorkspaces")
      data = await this.publerApi.listWorkspaces(credentials);
    else if (tool.name === "publer.listAccounts")
      data = await this.publerApi.listAccounts(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Publer redacted workspace/account read completed.");
  },

  async executePusherBeams(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "pusher-beams",
        input.connectionId,
      ),
      credentials = this.pusherBeamsCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("pusher-beams", input.toolName)!;
    if (tool.name !== "pusherBeams.publishInterestNotification")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "interest_notification_publish",
      "pusher-beams",
    );
    const title = this.requiredString(input.input.title, "title"),
      body = this.requiredString(input.input.body, "body"),
      data = await this.pusherBeamsApi.publishInterestNotification(
        credentials,
        { title, body },
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        interestHash: this.hash(credentials.interest),
        titleHash: this.hash(title),
        bodyHash: this.hash(body),
        publishId: data.publishId,
      },
    });
    return this.ok(data, "Pusher Beams interest notification published.");
  },

  async executePushwoosh(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "pushwoosh",
      input.connectionId,
    );
    const credentials = this.pushwooshCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("pushwoosh", input.toolName)!;
    if (tool.name !== "pushwoosh.getSubscriberStatusSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.pushwooshApi.getSubscriberStatusSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Pushwoosh subscriber-status summary read completed.");
  },

  async executeResend(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "resend",
      input.connectionId,
    );
    const credentials = this.resendCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("resend", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "resend.listEmails")
      data = await this.resendApi.listEmails(credentials, input.input);
    else if (name === "resend.listDomains")
      data = await this.resendApi.listDomains(credentials, input.input);
    else if (name === "resend.sendEmail") {
      await this.requireConnectorApproval(
        input,
        connection,
        "send_email",
        "resend",
      );
      data = await this.resendApi.sendEmail(credentials, input.input);
    } else if (name === "resend.sendBatch") {
      await this.requireConnectorApproval(
        input,
        connection,
        "send_batch",
        "resend",
      );
      data = await this.resendApi.sendBatch(credentials, input.input);
    } else if (name === "resend.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "resend",
      );
      data = await this.resendApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        json: this.jsonContainerOrUndefined(input.input.json),
        idempotencyKey:
          this.stringOrNull(input.input.idempotencyKey) ?? undefined,
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.resend.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        keyPermission: credentials.keyPermission,
        domain: credentials.domain,
      },
    });
    return this.ok(data, `Resend ${name.split(".")[1]} completed.`);
  },

  async executeRingCentral(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ringcentral",
      input.connectionId,
    );
    const tool = this.registry.getTool("ringcentral", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_ringcentral_get_extension") {
      await this.oauth.validateRingCentralExtension(
        connection,
        token.accessToken,
      );
      return this.ok(
        {
          displayName: this.stringOrNull(connection.metadata?.displayName),
          verified: true,
          extensionBindingVerified: true,
        },
        "RingCentral connected extension read completed.",
      );
    }
    if (tool.name === "relay_ringcentral_list_call_log") {
      const result = await this.ringCentralApi.listCallLog(
        token.accessToken,
        input.input.limit,
      );
      return this.ok(
        {
          records: result.records,
          count: result.records.length,
          truncated: result.truncated,
        },
        "RingCentral privacy-masked call-log read completed.",
      );
    }
    if (tool.name === "relay_ringcentral_get_call_log_record") {
      const record = await this.ringCentralApi.getCallLogRecord(
        token.accessToken,
        input.input.recordId,
      );
      return this.ok(
        record,
        "RingCentral privacy-masked call-log record read completed.",
      );
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeSailthru(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sailthru",
      input.connectionId,
    );
    const credentials = this.sailthruCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sailthru", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "sailthru",
      );
    const data =
      tool.action === "read"
        ? await this.sailthruApi.read(credentials, operation, input.input)
        : await this.sailthruApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.sailthru.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Sailthru ${operation} completed.`);
  },

  async executeSendGrid(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sendgrid",
      input.connectionId,
    );
    const credentials = this.sendGridCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sendgrid", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "sendgrid.getProfile")
      data = await this.sendGridApi.getProfile(credentials);
    else if (name === "sendgrid.listVerifiedSenders")
      data = await this.sendGridApi.listVerifiedSenders(
        credentials,
        input.input,
      );
    else if (name === "sendgrid.getStats")
      data = await this.sendGridApi.getStats(credentials, input.input);
    else if (name === "sendgrid.sendMail") {
      await this.requireConnectorApproval(
        input,
        connection,
        "send_mail",
        "sendgrid",
      );
      data = await this.sendGridApi.sendMail(credentials, input.input);
    } else if (name === "sendgrid.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "sendgrid",
      );
      data = await this.sendGridApi.request(credentials, {
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
      eventType: `marketplace.sendgrid.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        region: credentials.region,
        senderBoundary: credentials.senderBoundary,
      },
    });
    return this.ok(data, `SendGrid ${name.split(".")[1]} completed.`);
  },

  async executeSendlane(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sendlane",
      input.connectionId,
    );
    const credentials = this.sendlaneCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sendlane", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "sendlane",
      );
    const data =
      tool.action === "read"
        ? await this.sendlaneApi.read(credentials, operation, input.input)
        : await this.sendlaneApi.track(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.sendlane.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Sendlane ${operation} completed.`);
  },

  async executeMailjet(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "sinch-mailjet",
        input.connectionId,
      ),
      credentials = this.mailjetCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("sinch-mailjet", input.toolName)!,
      name = tool.name;
    let data: unknown;
    if (name === "mailjet.getProfile")
      data = await this.mailjetApi.getProfile(credentials);
    else if (name === "mailjet.listMessages")
      data = await this.mailjetApi.listMessages(credentials, input.input);
    else if (name === "mailjet.getStatistics")
      data = await this.mailjetApi.getStatistics(credentials, input.input);
    else if (name === "mailjet.send") {
      await this.requireConnectorApproval(
        input,
        connection,
        "send",
        "sinch-mailjet",
      );
      data = await this.mailjetApi.send(credentials, input.input);
    } else if (name === "mailjet.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "sinch-mailjet",
      );
      data = await this.mailjetApi.request(credentials, {
        apiVersion:
          this.stringOrNull(input.input.apiVersion) === "v3.1" ? "v3.1" : "v3",
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        json: this.jsonContainerOrUndefined(input.input.json),
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mailjet.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        senderBoundary: credentials.senderBoundary,
      },
    });
    return this.ok(data, `Mailjet ${name.split(".")[1]} completed.`);
  },

  async executeSlack(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "slack",
      input.connectionId,
    );
    const tool = this.registry.getTool("slack", input.toolName)!;
    if (tool.name === "relay_slack_draft_message") {
      const channelId = this.requiredString(input.input.channelId, "channelId");
      const text = this.requiredString(input.input.text, "text");
      if (text.length > 4000) {
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "text must be 4000 characters or fewer",
        );
      }
      if (/<!?(channel|everyone|here)>/i.test(text)) {
        throw new ConnectorExecutionError(
          "policy_blocked",
          "Channel-wide Slack mentions are blocked",
        );
      }
      return this.ok(
        {
          channelId,
          threadTs: this.stringOrNull(input.input.threadTs),
          text,
          textHash: this.hash(text),
          providerSideEffect: false,
        },
        "Slack message draft prepared locally.",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_slack_search_conversations") {
      const result = await this.slackApi.listPublicChannels(
        token.accessToken,
        input.input.query,
        input.input.limit,
      );
      return this.ok(result, "Slack public channels listed.");
    }
    if (tool.name === "relay_slack_read_conversation") {
      const result = await this.slackApi.readConversation(
        token.accessToken,
        input.input.channelId,
        input.input.threadTs,
        input.input.limit,
      );
      return this.ok(result, "Slack conversation history read completed.");
    }
    if (tool.name === "relay_slack_send_message") {
      const channelId = this.requiredString(input.input.channelId, "channelId");
      const text = this.requiredString(input.input.text, "text");
      const threadTs = this.stringOrNull(input.input.threadTs);
      const idempotencyKey = this.requiredString(
        input.input.idempotencyKey,
        "idempotencyKey",
      );
      if (text.length > 4000) {
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "text must be 4000 characters or fewer",
        );
      }
      if (/<!?(channel|everyone|here)>/i.test(text)) {
        throw new ConnectorExecutionError(
          "policy_blocked",
          "Channel-wide Slack mentions are blocked",
        );
      }
      await this.requireSlackApproval(input, connection, {
        channelId,
        text,
        threadTs,
        idempotencyKey,
      });
      const result = await this.slackApi.postMessage(token.accessToken, {
        channelId,
        text,
        threadTs,
        idempotencyKey,
      });
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: "marketplace.slack.message.sent",
        resourceId: connection.id,
        metadata: {
          channelId,
          threadTs,
          textHash: this.hash(text),
          idempotencyKey,
          timestamp: this.stringOrNull(
            (result as Record<string, unknown>).timestamp,
          ),
        },
      });
      return this.ok(result, "Approved Slack message sent.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeSlackEnterpriseGrid(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "slack-enterprise-grid",
      input.connectionId,
    );
    const credentials = this.slackEnterpriseGridCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "slack-enterprise-grid",
      input.toolName,
    )!;
    const name = tool.name;
    let data: unknown;
    if (name === "slackEnterprise.identity")
      data = await this.slackEnterpriseGridApi.identity(credentials);
    else if (name === "slackEnterprise.listWorkspaces")
      data = await this.slackEnterpriseGridApi.listWorkspaces(
        credentials,
        input.input,
      );
    else if (name === "slackEnterprise.listWorkspaceAdmins")
      data = await this.slackEnterpriseGridApi.listWorkspaceAdmins(
        credentials,
        input.input,
      );
    else if (name === "slackEnterprise.listWorkspaceOwners")
      data = await this.slackEnterpriseGridApi.listWorkspaceOwners(
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
      eventType: `marketplace.slack-enterprise-grid.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: name, capability: tool.capability },
    });
    return this.ok(data, `Slack Enterprise ${name.split(".")[1]} completed.`);
  },

  async executeSparkPost(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sparkpost",
      input.connectionId,
    );
    const credentials = this.sparkPostCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sparkpost", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "sparkpost.getAccount")
      data = await this.sparkPostApi.getAccount(credentials);
    else if (name === "sparkpost.listMessageEvents")
      data = await this.sparkPostApi.listMessageEvents(
        credentials,
        input.input,
      );
    else if (name === "sparkpost.getDeliverabilityMetrics")
      data = await this.sparkPostApi.getDeliverabilityMetrics(
        credentials,
        input.input,
      );
    else if (name === "sparkpost.createTransmission") {
      await this.requireConnectorApproval(
        input,
        connection,
        "create_transmission",
        "sparkpost",
      );
      data = await this.sparkPostApi.createTransmission(
        credentials,
        input.input,
      );
    } else if (name === "sparkpost.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "sparkpost",
      );
      data = await this.sparkPostApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        json: this.jsonContainerOrUndefined(input.input.json),
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.sparkpost.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        region: credentials.region,
        senderDomain: credentials.senderDomain,
        subaccountBound: Boolean(credentials.subaccountId),
      },
    });
    return this.ok(data, `SparkPost ${name.split(".")[1]} completed.`);
  },

  async executeSprinklr(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sprinklr",
      input.connectionId,
    );
    const credentials = this.sprinklrCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sprinklr", input.toolName)!;
    if (tool.name !== "sprinklr.getGovernanceStatus")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.sprinklrApi.getGovernanceStatus(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Sprinklr redacted governance read completed.");
  },

  async executeSproutSocial(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sprout-social",
      input.connectionId,
    );
    const credentials = this.sproutSocialCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sprout-social", input.toolName)!;
    let data: unknown;
    if (tool.name === "sproutSocial.listCustomerIds")
      data = await this.sproutSocialApi.customers(credentials);
    else if (tool.name === "sproutSocial.listProfileStructure")
      data = await this.sproutSocialApi.profiles(
        credentials,
        this.requiredString(input.input.customerId, "customerId"),
      );
    else if (tool.name === "sproutSocial.listGroupIds")
      data = await this.sproutSocialApi.groups(
        credentials,
        this.requiredString(input.input.customerId, "customerId"),
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Sprout Social redacted structure read completed.");
  },

  async executeTeamsPhone(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "teams-phone",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("teams-phone", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      "number_inventory",
      "teams-phone",
    );
    const name = tool.name;
    let data: unknown;
    if (name === "teamsPhone.listAssignments")
      data = await this.teamsPhoneGraph.listAssignments(
        token.accessToken,
        input.input,
      );
    else if (name === "teamsPhone.listUnassigned")
      data = await this.teamsPhoneGraph.listUnassigned(
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
      eventType: `marketplace.teams-phone.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        numberType: this.stringOrNull(input.input.numberType),
        providerSideEffect: false,
      },
    });
    return this.ok(data, `Teams Phone ${name.split(".")[1]} completed.`);
  },

  async executeTelegramPersonalBots(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "telegram-personal-bots",
      input.connectionId,
    );
    const credentials = this.telegramPersonalBotsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "telegram-personal-bots",
      input.toolName,
    )!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "telegramPersonalBots.getMe")
      data = await this.telegramPersonalBotsApi.getMe(credentials);
    else if (name === "telegramPersonalBots.getWebhookInfo")
      data = await this.telegramPersonalBotsApi.getWebhookInfo(credentials);
    else if (name === "telegramPersonalBots.getChat")
      data = await this.telegramPersonalBotsApi.getChat(
        credentials,
        input.input,
      );
    else if (name === "telegramPersonalBots.getUpdates")
      data = await this.telegramPersonalBotsApi.getUpdates(
        credentials,
        input.input,
      );
    else if (name === "telegramPersonalBots.sendMessage") {
      action = "telegram_bot_send_message";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "telegram-personal-bots",
      );
      data = await this.telegramPersonalBotsApi.sendMessage(
        credentials,
        input.input,
      );
    } else if (name === "telegramPersonalBots.editMessageText") {
      action = "telegram_bot_edit_message";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "telegram-personal-bots",
      );
      data = await this.telegramPersonalBotsApi.editMessageText(
        credentials,
        input.input,
      );
    } else if (name === "telegramPersonalBots.deleteMessage") {
      action = "telegram_bot_delete_message";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "telegram-personal-bots",
      );
      data = await this.telegramPersonalBotsApi.deleteMessage(
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
      eventType: `marketplace.telegram_personal_bots.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        chatIdHash: this.stringOrNull(input.input.chatId)
          ? this.hash(this.stringOrNull(input.input.chatId)!)
          : null,
        messageId: input.input.messageId ?? null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Telegram bot ${name.split(".")[1]} completed.`);
  },
};

export const CommunicationExecutors3Registrations = {
  messagegears: { methodName: "executeMessageGears", needsConnection: false },
  metricool: { methodName: "executeMetricool", needsConnection: false },
  "microsoft-teams": {
    methodName: "executeMicrosoftTeamsReadOnly",
    needsConnection: false,
  },
  "microsoft-viva-engage": {
    methodName: "executeMicrosoftVivaEngage",
    needsConnection: false,
  },
  "mighty-networks": {
    methodName: "executeMightyNetworks",
    needsConnection: false,
  },
  moengage: { methodName: "executeMoEngage", needsConnection: false },
  olark: { methodName: "executeOlark", needsConnection: false },
  onesignal: { methodName: "executeOneSignal", needsConnection: false },
  openphone: { methodName: "executeOpenPhone", needsConnection: false },
  ortto: { methodName: "executeOrtto", needsConnection: false },
  "otter-ai": { methodName: "executeOtterAi", needsConnection: false },
  outlook: { methodName: "executeOutlookReadOnly", needsConnection: false },
  postmark: { methodName: "executePostmark", needsConnection: false },
  postscript: { methodName: "executePostscript", needsConnection: false },
  publer: { methodName: "executePubler", needsConnection: false },
  "pusher-beams": { methodName: "executePusherBeams", needsConnection: false },
  pushwoosh: { methodName: "executePushwoosh", needsConnection: false },
  resend: { methodName: "executeResend", needsConnection: false },
  ringcentral: { methodName: "executeRingCentral", needsConnection: false },
  sailthru: { methodName: "executeSailthru", needsConnection: false },
  sendgrid: { methodName: "executeSendGrid", needsConnection: false },
  sendlane: { methodName: "executeSendlane", needsConnection: false },
  "sinch-mailjet": { methodName: "executeMailjet", needsConnection: false },
  slack: { methodName: "executeSlack", needsConnection: false },
  "slack-enterprise-grid": {
    methodName: "executeSlackEnterpriseGrid",
    needsConnection: false,
  },
  sparkpost: { methodName: "executeSparkPost", needsConnection: false },
  sprinklr: { methodName: "executeSprinklr", needsConnection: false },
  "sprout-social": {
    methodName: "executeSproutSocial",
    needsConnection: false,
  },
  "teams-phone": { methodName: "executeTeamsPhone", needsConnection: false },
  "telegram-personal-bots": {
    methodName: "executeTelegramPersonalBots",
    needsConnection: false,
  },
} satisfies NativeExecutorRegistrationMap<typeof CommunicationExecutors3>;
