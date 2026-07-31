import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const CommunicationExecutors1 = {
  async executeAcousticCampaign(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "acoustic-campaign",
      input.connectionId,
    );
    const credentials = this.acousticCampaignCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("acoustic-campaign", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "acoustic-campaign",
      );
    const data =
      tool.action === "read"
        ? await this.acousticCampaignApi.read(
            credentials,
            operation,
            input.input,
          )
        : await this.acousticCampaignApi.manage(
            credentials,
            operation,
            input.input,
          );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.acoustic-campaign.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Acoustic Campaign ${operation} completed.`);
  },

  async executeActiveCampaign(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "activecampaign",
      input.connectionId,
    );
    const credentials = this.activeCampaignCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("activecampaign", input.toolName)!;
    let data: unknown;
    if (tool.name === "activecampaign.getAccountBinding") {
      data = await this.activeCampaignApi.accountBinding(credentials);
    } else if (tool.name === "activecampaign.listRecentLists") {
      data = await this.activeCampaignApi.listRecentLists(credentials);
    } else if (tool.name === "activecampaign.listRecentCampaigns") {
      data = await this.activeCampaignApi.listRecentCampaigns(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.activecampaign.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(
      data,
      `ActiveCampaign ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeAgorapulse(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "agorapulse",
      input.connectionId,
    );
    const credentials = this.agorapulseCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("agorapulse", input.toolName)!;
    let data: unknown;
    if (tool.name === "agorapulse.listProfiles")
      data = await this.agorapulseApi.listProfiles(credentials);
    else if (
      tool.name === "agorapulse.getAudienceReport" ||
      tool.name === "agorapulse.getCommunityReport" ||
      tool.name === "agorapulse.getContentReport"
    ) {
      const type =
        tool.name === "agorapulse.getAudienceReport"
          ? "audience"
          : tool.name === "agorapulse.getCommunityReport"
            ? "communitymanagement"
            : "content";
      data = await this.agorapulseApi.report(credentials, type, {
        profileUid: this.requiredString(input.input.profileUid, "profileUid"),
        since: this.requiredString(input.input.since, "since"),
        until: this.requiredString(input.input.until, "until"),
      });
    } else
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
    return this.ok(data, "Agorapulse redacted analytics read completed.");
  },

  async executeAircall(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "aircall",
      input.connectionId,
    );
    const tool = this.registry.getTool("aircall", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    const binding = await this.oauth.validateAircallCompany(
      connection,
      token.accessToken,
    );
    if (tool.name === "relay_aircall_get_company") {
      return this.ok(
        {
          companyName: this.stringOrNull(binding.aircallCompanyName),
          usersCount: binding.aircallUsersCount ?? null,
          numbersCount: binding.aircallNumbersCount ?? null,
          verified: true,
          companyBindingVerified: true,
        },
        "Aircall connected company read completed.",
      );
    }
    if (tool.name === "relay_aircall_list_numbers") {
      const result = await this.aircallApi.listNumbers(token.accessToken);
      return this.ok(
        result,
        "Aircall privacy-masked phone-number read completed.",
      );
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeAirship(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "airship",
      input.connectionId,
    );
    const credentials = this.airshipCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("airship", input.toolName)!;
    if (tool.name !== "airship.listSegmentReferences")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.airshipApi.listSegmentReferences(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Airship segment-reference read completed.");
  },

  async executeAttentive(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "attentive",
      input.connectionId,
    );
    const credentials = this.attentiveCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("attentive", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "attentive",
      );
    const data =
      tool.action === "read"
        ? await this.attentiveApi.read(credentials, operation, input.input)
        : await this.attentiveApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.attentive.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Attentive ${operation} completed.`);
  },

  async executeBettermode(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "bettermode",
      input.connectionId,
    );
    const credentials = this.bettermodeCredentials(
      this.credentials.decrypt(connection),
      connection.metadata,
    );
    const tool = this.registry.getTool("bettermode", input.toolName)!;
    const name = tool.name;
    const action = tool.functionName;
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "bettermode",
    );
    let data: unknown;
    if (name === "bettermode.getNetwork")
      data = await this.bettermodeApi.getNetwork(credentials);
    else if (name === "bettermode.getCurrentMember")
      data = await this.bettermodeApi.getCurrentMember(credentials);
    else if (name === "bettermode.listSpaces")
      data = await this.bettermodeApi.listSpaces(credentials, input.input);
    else if (name === "bettermode.listMembers")
      data = await this.bettermodeApi.listMembers(credentials, input.input);
    else if (name === "bettermode.listSpaceMembers")
      data = await this.bettermodeApi.listSpaceMembers(
        credentials,
        input.input,
      );
    else if (name === "bettermode.listPosts")
      data = await this.bettermodeApi.listPosts(credentials, input.input);
    else if (name === "bettermode.addSpaceMember")
      data = await this.bettermodeApi.addSpaceMember(credentials, input.input);
    else if (name === "bettermode.removeSpaceMember")
      data = await this.bettermodeApi.removeSpaceMember(
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
      eventType: `marketplace.bettermode.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        networkIdHash: this.hash(credentials.networkId),
        configuredMemberIdHash: this.hash(credentials.memberId),
        spaceIdHash:
          input.input.spaceId != null
            ? this.hash(String(input.input.spaceId))
            : null,
        memberIdHash:
          input.input.memberId != null
            ? this.hash(String(input.input.memberId))
            : null,
        page: input.input.page ?? 1,
        maxResults: input.input.maxResults ?? 25,
      },
    });
    return this.ok(data, `Bettermode ${name.split(".")[1]} completed.`);
  },

  async executeBigMarker(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "bigmarker",
      input.connectionId,
    );
    const credentials = this.bigMarkerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("bigmarker", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      "conference_inventory_count",
      "bigmarker",
    );
    if (tool.name !== "bigmarker.countFutureConferences")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.bigMarkerApi.countFutureConferences(
      credentials,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.bigmarker.countFutureConferences.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerSideEffect: false,
      },
    });
    return this.ok(data, "BigMarker aggregate conference inventory completed.");
  },

  async executeBloomreachEngagement(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "bloomreach-engagement",
      input.connectionId,
    );
    const credentials = this.bloomreachEngagementCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "bloomreach-engagement",
      input.toolName,
    )!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "bloomreach-engagement",
      );
    const data =
      tool.action === "read"
        ? await this.bloomreachEngagementApi.read(
            credentials,
            operation,
            input.input,
          )
        : await this.bloomreachEngagementApi.manage(
            credentials,
            operation,
            input.input,
          );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.bloomreach-engagement.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Bloomreach Engagement ${operation} completed.`);
  },

  async executeBrandwatch(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "brandwatch",
      input.connectionId,
    );
    const credentials = this.brandwatchCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("brandwatch", input.toolName)!;
    let data: unknown;
    if (tool.name === "brandwatch.listProjects")
      data = await this.brandwatchApi.listProjects(credentials);
    else if (tool.name === "brandwatch.listQueries")
      data = await this.brandwatchApi.listQueries(credentials);
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
    return this.ok(data, "Brandwatch redacted project/query read completed.");
  },

  async executeBraze(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "braze",
      input.connectionId,
    );
    const credentials = this.brazeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("braze", input.toolName)!;
    let data: unknown;
    if (tool.name === "braze.listRecentCampaigns")
      data = await this.brazeApi.listCampaigns(credentials);
    else if (tool.name === "braze.listRecentCanvases")
      data = await this.brazeApi.listCanvases(credentials);
    else if (tool.name === "braze.getCampaignAnalytics")
      data = await this.brazeApi.getCampaignAnalytics(credentials, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.braze.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, `Braze ${tool.name.split(".")[1]} completed.`);
  },

  async executeBrevo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "brevo",
      input.connectionId,
    );
    const credentials = this.brevoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("brevo", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "brevo.getAccount")
      data = await this.brevoApi.getAccount(credentials);
    else if (name === "brevo.listSenders")
      data = await this.brevoApi.listSenders(credentials);
    else if (name === "brevo.listTemplates")
      data = await this.brevoApi.listTemplates(credentials, input.input);
    else if (name === "brevo.sendTransactionalEmail") {
      await this.requireConnectorApproval(
        input,
        connection,
        "send_email",
        "brevo",
      );
      data = await this.brevoApi.sendTransactionalEmail(
        credentials,
        input.input,
      );
    } else if (name === "brevo.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "brevo",
      );
      data = await this.brevoApi.request(credentials, {
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
      eventType: `marketplace.brevo.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        senderBoundary: credentials.senderBoundary,
      },
    });
    return this.ok(data, `Brevo ${name.split(".")[1]} completed.`);
  },

  async executeBuffer(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "buffer",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = { accessToken: token.accessToken };
    const tool = this.registry.getTool("buffer", input.toolName)!;
    let data: unknown;
    if (tool.name === "buffer.getAccountStatus")
      data = await this.bufferApi.account(credentials);
    else if (tool.name === "buffer.listOrganizations")
      data = await this.bufferApi.organizations(credentials);
    else if (tool.name === "buffer.listChannels")
      data = await this.bufferApi.channels(
        credentials,
        this.requiredString(input.input.organizationId, "organizationId"),
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
    return this.ok(data, "Buffer redacted structure read completed.");
  },

  async executeCampaignMonitor(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "campaign-monitor",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.campaignMonitorCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("campaign-monitor", input.toolName)!;
    let data: unknown;
    if (tool.name === "campaign-monitor.getClient") {
      data = await this.campaignMonitorApi.getClient(credentials);
    } else if (tool.name === "campaign-monitor.listRecentSentCampaigns") {
      data = await this.campaignMonitorApi.listRecentSentCampaigns(credentials);
    } else if (tool.name === "campaign-monitor.getCampaignSummary") {
      data = await this.campaignMonitorApi.getCampaignSummary(
        credentials,
        input.input,
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
      eventType: `marketplace.campaign_monitor.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        clientIdHash: this.hash(credentials.clientId),
      },
    });
    return this.ok(
      data,
      `Campaign Monitor ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeCircle(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "circle",
      input.connectionId,
    );
    const credentials = this.circleCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("circle", input.toolName)!;
    const name = tool.name;
    const action = tool.functionName;
    await this.requireConnectorApproval(input, connection, action, "circle");
    let data: unknown;
    if (name === "circle.getCommunity")
      data = await this.circleApi.getCommunity(credentials);
    else if (name === "circle.listSpaces")
      data = await this.circleApi.listSpaces(credentials, input.input);
    else if (name === "circle.getSpace")
      data = await this.circleApi.getSpace(credentials, input.input);
    else if (name === "circle.listPosts")
      data = await this.circleApi.listPosts(credentials, input.input);
    else if (name === "circle.getPost")
      data = await this.circleApi.getPost(credentials, input.input);
    else if (name === "circle.listMembers")
      data = await this.circleApi.listMembers(credentials, input.input);
    else if (name === "circle.getMember")
      data = await this.circleApi.getMember(credentials, input.input);
    else if (name === "circle.listAccessGroups")
      data = await this.circleApi.listAccessGroups(credentials, input.input);
    else if (name === "circle.listMemberAccessGroups")
      data = await this.circleApi.listMemberAccessGroups(
        credentials,
        input.input,
      );
    else if (name === "circle.addSpaceMember")
      data = await this.circleApi.addSpaceMember(credentials, input.input);
    else if (name === "circle.removeSpaceMember")
      data = await this.circleApi.removeSpaceMember(credentials, input.input);
    else if (name === "circle.addAccessGroupMember")
      data = await this.circleApi.addAccessGroupMember(
        credentials,
        input.input,
      );
    else if (name === "circle.removeAccessGroupMember")
      data = await this.circleApi.removeAccessGroupMember(
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
      eventType: `marketplace.circle.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        communityIdHash:
          connection.metadata?.circleCommunityId != null
            ? this.hash(String(connection.metadata.circleCommunityId))
            : null,
        spaceIdHash:
          input.input.spaceId != null
            ? this.hash(String(input.input.spaceId))
            : null,
        postIdHash:
          input.input.postId != null
            ? this.hash(String(input.input.postId))
            : null,
        memberIdHash:
          input.input.memberId != null
            ? this.hash(String(input.input.memberId))
            : null,
        accessGroupIdHash:
          input.input.accessGroupId != null
            ? this.hash(String(input.input.accessGroupId))
            : null,
        emailHash: this.stringOrNull(input.input.email)
          ? this.hash(this.stringOrNull(input.input.email)!.toLowerCase())
          : null,
        page: input.input.page ?? 1,
        maxResults: input.input.maxResults ?? 25,
      },
    });
    return this.ok(data, `Circle ${name.split(".")[1]} completed.`);
  },

  async executeCleverTap(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "clevertap",
      input.connectionId,
    );
    const credentials = this.cleverTapCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("clevertap", input.toolName)!;
    if (tool.name !== "clevertap.getBoundUserProfile")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.cleverTapApi.getBoundUserProfile(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "CleverTap bound profile read completed.");
  },

  async executeConstantContact(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "constant-contact",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.constantContactCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("constant-contact", input.toolName)!;
    let data: unknown;
    if (tool.name === "constant-contact.getAccount")
      data = await this.constantContactApi.getAccount(credentials);
    else if (tool.name === "constant-contact.listRecentCampaigns")
      data = await this.constantContactApi.listRecentCampaigns(credentials);
    else if (tool.name === "constant-contact.listRecentCampaignSummaries")
      data =
        await this.constantContactApi.listRecentCampaignSummaries(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.constant_contact.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        accountIdHash: this.hash(credentials.accountId),
      },
    });
    return this.ok(
      data,
      `Constant Contact ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeConvertKit(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "convertkit",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.convertKitCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("convertkit", input.toolName)!;
    let data: unknown;
    if (tool.name === "convertkit.getAccount") {
      data = await this.convertKitApi.getAccount(credentials);
    } else if (tool.name === "convertkit.listActiveForms") {
      data = await this.convertKitApi.listActiveForms(credentials);
    } else if (tool.name === "convertkit.listRecentBroadcasts") {
      data = await this.convertKitApi.listRecentBroadcasts(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.convertkit.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        accountIdHash: this.hash(credentials.accountId),
      },
    });
    return this.ok(data, `Kit ${tool.name.split(".")[1]} completed.`);
  },

  async executeCrisp(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "crisp",
      input.connectionId,
    );
    const credentials = this.crispCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("crisp", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "crisp.listConversations") {
      action = "crisp_conversation_list";
      await this.requireConnectorApproval(input, connection, action, "crisp");
      data = await this.crispApi.listConversations(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "crisp.getConversationState") {
      action = "crisp_conversation_state_get";
      await this.requireConnectorApproval(input, connection, action, "crisp");
      data = await this.crispApi.getConversationState(
        credentials,
        this.requiredString(input.input.sessionId, "sessionId"),
      );
    } else if (name === "crisp.request") {
      action = "crisp_full_api";
      await this.requireConnectorApproval(input, connection, action, "crisp");
      data = await this.crispApi.request(credentials, {
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
      eventType: `marketplace.crisp.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        websiteIdHash: this.hash(credentials.websiteId),
        sessionIdHash: this.stringOrNull(input.input.sessionId)
          ? this.hash(this.stringOrNull(input.input.sessionId)!)
          : null,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Crisp ${name.split(".")[1]} completed.`);
  },

  async executeCustomerIo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "customer-io",
      input.connectionId,
    );
    const credentials = this.customerIoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("customer-io", input.toolName)!;
    let data: unknown;
    if (tool.name === "customer-io.getWorkspaceBinding") {
      data = await this.customerIoApi.workspaceBinding(credentials);
    } else if (tool.name === "customer-io.listCampaigns") {
      data = await this.customerIoApi.listCampaigns(credentials);
    } else if (tool.name === "customer-io.listBroadcasts") {
      data = await this.customerIoApi.listBroadcasts(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.customer_io.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        workspaceIdHash: this.hash(credentials.workspaceId),
      },
    });
    return this.ok(data, `Customer.io ${tool.name.split(".")[1]} completed.`);
  },

  async executeDemio(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "demio",
      input.connectionId,
    );
    const credentials = this.demioCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("demio", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      "event_inventory_count",
      "demio",
    );
    if (tool.name !== "demio.countEventInventory")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.demioApi.countEventInventory(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.demio.countEventInventory.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerSideEffect: false,
      },
    });
    return this.ok(data, "Demio aggregate event inventory completed.");
  },

  async executeDialpad(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "dialpad",
      input.connectionId,
    );
    const tool = this.registry.getTool("dialpad", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_dialpad_get_user") {
      await this.oauth.validateDialpadUser(connection, token.accessToken);
      return this.ok(
        {
          displayName: this.stringOrNull(connection.metadata?.displayName),
          verified: true,
          userBindingVerified: true,
        },
        "Dialpad connected user read completed.",
      );
    }
    if (tool.name === "relay_dialpad_get_caller_id") {
      const result = await this.dialpadApi.getCallerIds(token.accessToken);
      return this.ok(
        result,
        "Dialpad privacy-masked caller-ID read completed.",
      );
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeDiscord(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "discord",
      input.connectionId,
    );
    const stored = this.credentials.decrypt(connection);
    const token = this.stringOrNull(stored?.DISCORD_BOT_TOKEN);
    if (!token)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Discord bot token is missing.",
      );
    const binding = this.discordBinding(connection);
    const tool = this.registry.getTool("discord", input.toolName)!;
    let data: unknown;
    if (tool.name === "discord.getBot")
      data = await this.discordApi.getBot(token);
    else if (tool.name === "discord.getSelectedGuild")
      data = await this.discordApi.getSelectedGuild(token, binding);
    else if (tool.name === "discord.listSelectedGuildChannels")
      data = await this.discordApi.listSelectedGuildChannels(token, binding);
    else if (tool.name === "discord.listSelectedChannelMessages")
      data = await this.discordApi.listSelectedChannelMessages(token, binding);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.discord.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedGuildIdHash: this.hash(binding.guildId),
        selectedChannelIdHash: this.hash(binding.channelId),
        selectedGuildChannelOnly: true,
        authorsPeopleRichContentExcluded: true,
        maxResults: 25,
      },
    });
    return this.ok(data, `Discord ${tool.name.split(".")[1]} completed.`);
  },

  async executeDiscourse(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "discourse",
      input.connectionId,
    );
    const credentials = this.discourseCredentials(
      this.credentials.decrypt(connection),
      connection.metadata,
    );
    const tool = this.registry.getTool("discourse", input.toolName)!;
    const name = tool.name;
    const action = tool.functionName;
    await this.requireConnectorApproval(input, connection, action, "discourse");
    let data: unknown;
    if (name === "discourse.getSite")
      data = await this.discourseApi.getSiteBasicInfo(credentials);
    else if (name === "discourse.getCurrentUser")
      data = await this.discourseApi.getCurrentUser(credentials);
    else if (name === "discourse.listCategories")
      data = await this.discourseApi.listCategories(credentials, input.input);
    else if (name === "discourse.listTags")
      data = await this.discourseApi.listTags(credentials, input.input);
    else if (name === "discourse.listTagGroups")
      data = await this.discourseApi.listTagGroups(credentials, input.input);
    else if (name === "discourse.listGroups")
      data = await this.discourseApi.listGroups(credentials, input.input);
    else if (name === "discourse.getGroup")
      data = await this.discourseApi.getGroup(credentials, input.input);
    else if (name === "discourse.listGroupMembers")
      data = await this.discourseApi.listGroupMembers(credentials, input.input);
    else if (name === "discourse.listLatestTopics")
      data = await this.discourseApi.listLatestTopics(credentials, input.input);
    else if (name === "discourse.addGroupMember")
      data = await this.discourseApi.addGroupMember(credentials, input.input);
    else if (name === "discourse.removeGroupMember")
      data = await this.discourseApi.removeGroupMember(
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
      eventType: `marketplace.discourse.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        siteOriginHash: this.hash(
          this.stringOrNull(connection.metadata?.discourseSiteOrigin) ??
            credentials.baseUrl,
        ),
        apiActorHash: this.hash(credentials.apiUsername.toLowerCase()),
        groupIdHash:
          input.input.groupId != null
            ? this.hash(String(input.input.groupId))
            : null,
        groupNameHash: this.stringOrNull(input.input.groupName)
          ? this.hash(this.stringOrNull(input.input.groupName)!.toLowerCase())
          : null,
        usernameHash: this.stringOrNull(input.input.username)
          ? this.hash(this.stringOrNull(input.input.username)!.toLowerCase())
          : null,
        page: input.input.page ?? 0,
        maxResults: input.input.maxResults ?? 25,
      },
    });
    return this.ok(data, `Discourse ${name.split(".")[1]} completed.`);
  },

  async executeDotdigital(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "dotdigital",
      input.connectionId,
    );
    const credentials = this.dotdigitalCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("dotdigital", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "dotdigital",
      );
    const data =
      tool.action === "read"
        ? await this.dotdigitalApi.read(credentials, operation, input.input)
        : await this.dotdigitalApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.dotdigital.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Dotdigital ${operation} completed.`);
  },

  async executeEmarsys(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "emarsys",
      input.connectionId,
    );
    const credentials = this.emarsysCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("emarsys", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "emarsys",
      );
    const data =
      tool.action === "read"
        ? await this.emarsysApi.read(credentials, operation, input.input)
        : await this.emarsysApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.emarsys.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Emarsys ${operation} completed.`);
  },

  async executeEventbrite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "eventbrite",
      input.connectionId,
    );
    const tool = this.registry.getTool("eventbrite", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_eventbrite_get_user") {
      const user = await this.oauth.validateEventbriteUser(
        connection,
        token.accessToken,
      );
      return this.ok(
        {
          name: this.stringOrNull(user.displayName),
          verified: user.userVerified === true,
          userBindingVerified: user.userBindingVerified === true,
        },
        "Eventbrite connected user read completed.",
      );
    }
    if (tool.name === "relay_eventbrite_list_organizations") {
      const organizations = await this.eventbriteApi.listOrganizations(
        token.accessToken,
        input.input.limit,
      );
      return this.ok(
        { organizations, count: organizations.length },
        "Eventbrite member Organizations read completed.",
      );
    }
    if (tool.name === "relay_eventbrite_list_organization_events") {
      const events = await this.eventbriteApi.listOrganizationEvents(
        token.accessToken,
        input.input.organizationId,
        input.input.limit,
      );
      return this.ok(
        { events, count: events.length },
        "Eventbrite Organization Events read completed.",
      );
    }
    if (tool.name === "relay_eventbrite_get_event") {
      const event = await this.eventbriteApi.getEvent(
        token.accessToken,
        input.input.eventId,
      );
      return this.ok(event, "Eventbrite Event read completed.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeFathom(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "fathom",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("fathom", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "fathom.read") {
      data = await this.fathomMcp.callRead(token.accessToken, input.input);
    } else if (name === "fathom.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "webhook_management",
        "fathom",
      );
      data = await this.fathomMcp.callWrite(token.accessToken, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.fathom.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Fathom ${name.split(".")[1]} completed.`);
  },

  async executeFirebaseCloudMessaging(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "firebase-cloud-messaging",
        input.connectionId,
      ),
      credentials = this.firebaseCloudMessagingCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("firebase-cloud-messaging", input.toolName)!;
    if (tool.name !== "firebaseCloudMessaging.publishTopicNotification")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "topic_notification_publish",
      "firebase-cloud-messaging",
    );
    const title = this.requiredString(input.input.title, "title"),
      body = this.requiredString(input.input.body, "body"),
      data = await this.firebaseCloudMessagingApi.publishTopicNotification(
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
        topicHash: this.hash(credentials.topic),
        titleHash: this.hash(title),
        bodyHash: this.hash(body),
        messageName: data.messageName,
      },
    });
    return this.ok(data, "FCM topic notification published.");
  },

  async executeFirefliesAi(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "fireflies-ai",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("fireflies-ai", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "fireflies.read") {
      data = await this.firefliesAiMcp.callRead(token.accessToken, input.input);
    } else if (name === "fireflies.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "meeting_management",
        "fireflies-ai",
      );
      data = await this.firefliesAiMcp.callWrite(
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
      eventType: `marketplace.fireflies_ai.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Fireflies.ai ${name.split(".")[1]} completed.`);
  },

  async executeFreshcaller(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "freshcaller",
      input.connectionId,
    );
    const credentials = this.freshcallerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("freshcaller", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "freshcaller.listCallMetrics") {
      action = "freshcaller_call_metric_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshcaller",
      );
      data = await this.freshcallerApi.listCallMetrics(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "freshcaller.getCallMetrics") {
      action = "freshcaller_call_metric_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshcaller",
      );
      data = await this.freshcallerApi.getCallMetrics(
        credentials,
        Number(input.input.callId),
      );
    } else if (name === "freshcaller.request") {
      action = "freshcaller_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshcaller",
      );
      data = await this.freshcallerApi.request(credentials, {
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
      eventType: `marketplace.freshcaller.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        domainHash: this.hash(credentials.domain),
        callIdHash: this.stringOrNull(input.input.callId)
          ? this.hash(this.stringOrNull(input.input.callId)!)
          : null,
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Freshcaller ${name.split(".")[1]} completed.`);
  },

  async executeGmail(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "gmail",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.gmailCredentials(token.credentials);
    const tool = this.registry.getTool("gmail", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "gmail.searchMessages") {
      action = "gmail_message_search";
      await this.requireConnectorApproval(input, connection, action, "gmail");
      data = await this.gmailApi.searchMessages(credentials, input.input);
    } else if (name === "gmail.getMessage") {
      action = "gmail_message_read";
      await this.requireConnectorApproval(input, connection, action, "gmail");
      data = await this.gmailApi.getMessage(credentials, input.input);
    } else if (name === "gmail.listLabels") {
      action = "gmail_label_list";
      await this.requireConnectorApproval(input, connection, action, "gmail");
      data = await this.gmailApi.listLabels(credentials);
    } else if (name === "gmail.createDraft") {
      action = "gmail_draft_create";
      await this.requireConnectorApproval(input, connection, action, "gmail");
      data = await this.gmailApi.createDraft(credentials, input.input);
    } else if (name === "gmail.sendMessage") {
      action = "gmail_message_send";
      await this.requireConnectorApproval(input, connection, action, "gmail");
      data = await this.gmailApi.sendMessage(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.gmail.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountHash: this.hash(credentials.accountEmail),
        tokenRefreshed: token.refreshed,
        limit: input.input.limit ?? null,
        recipientCount: Array.isArray(input.input.to)
          ? input.input.to.length
          : null,
        attachmentsReturned: false,
      },
    });
    return this.ok(data, `Gmail ${name.split(".")[1]} completed.`);
  },
};

export const CommunicationExecutors1Registrations = {
  "acoustic-campaign": {
    methodName: "executeAcousticCampaign",
    needsConnection: false,
  },
  activecampaign: {
    methodName: "executeActiveCampaign",
    needsConnection: false,
  },
  agorapulse: { methodName: "executeAgorapulse", needsConnection: false },
  aircall: { methodName: "executeAircall", needsConnection: false },
  airship: { methodName: "executeAirship", needsConnection: false },
  attentive: { methodName: "executeAttentive", needsConnection: false },
  bettermode: { methodName: "executeBettermode", needsConnection: false },
  bigmarker: { methodName: "executeBigMarker", needsConnection: false },
  "bloomreach-engagement": {
    methodName: "executeBloomreachEngagement",
    needsConnection: false,
  },
  brandwatch: { methodName: "executeBrandwatch", needsConnection: false },
  braze: { methodName: "executeBraze", needsConnection: false },
  brevo: { methodName: "executeBrevo", needsConnection: false },
  buffer: { methodName: "executeBuffer", needsConnection: false },
  "campaign-monitor": {
    methodName: "executeCampaignMonitor",
    needsConnection: false,
  },
  circle: { methodName: "executeCircle", needsConnection: false },
  clevertap: { methodName: "executeCleverTap", needsConnection: false },
  "constant-contact": {
    methodName: "executeConstantContact",
    needsConnection: false,
  },
  convertkit: { methodName: "executeConvertKit", needsConnection: false },
  crisp: { methodName: "executeCrisp", needsConnection: false },
  "customer-io": { methodName: "executeCustomerIo", needsConnection: false },
  demio: { methodName: "executeDemio", needsConnection: false },
  dialpad: { methodName: "executeDialpad", needsConnection: false },
  discord: { methodName: "executeDiscord", needsConnection: false },
  discourse: { methodName: "executeDiscourse", needsConnection: false },
  dotdigital: { methodName: "executeDotdigital", needsConnection: false },
  emarsys: { methodName: "executeEmarsys", needsConnection: false },
  eventbrite: { methodName: "executeEventbrite", needsConnection: false },
  fathom: { methodName: "executeFathom", needsConnection: false },
  "firebase-cloud-messaging": {
    methodName: "executeFirebaseCloudMessaging",
    needsConnection: false,
  },
  "fireflies-ai": { methodName: "executeFirefliesAi", needsConnection: false },
  freshcaller: { methodName: "executeFreshcaller", needsConnection: false },
  gmail: { methodName: "executeGmail", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof CommunicationExecutors1>;
