import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const CrmSupportExecutors2 = {
  async executeFront(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "front",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.frontCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("front", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "front.listConversations") {
      action = "front_conversation_list";
      data = await this.frontApi.listConversations(credentials, input.input);
    } else if (name === "front.getConversation") {
      action = "front_conversation_get";
      data = await this.frontApi.getConversation(
        credentials,
        input.input as { conversationId: string },
      );
    } else if (name === "front.request") {
      action = "front_full_api";
      await this.requireConnectorApproval(input, connection, action, "front");
      data = await this.frontApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.recordOrUndefined(input.input.query),
        json: this.recordOrUndefined(input.input.json),
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
      eventType: `marketplace.front.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        companyIdHash: this.hash(credentials.companyId),
        conversationIdHash: this.stringOrNull(input.input.conversationId)
          ? this.hash(this.stringOrNull(input.input.conversationId)!)
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Front ${name.split(".")[1]} completed.`);
  },

  async executeFullstory(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "fullstory",
      input.connectionId,
    );
    const credentials = this.fullstoryCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("fullstory", input.toolName)!;
    if (tool.name !== "fullstory.getConnectionSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.fullstoryApi.read(credentials, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.fullstory.connection_summary_read",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "FullStory connection summary completed.");
  },

  async executeGetResponse(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "getresponse",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const boundaries = this.getResponseBoundaries(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("getresponse", input.toolName)!;
    let data: unknown;
    if (tool.name === "getresponse.getContactSummary")
      data = await this.getResponseApi.getContactSummary(
        token.accessToken,
        boundaries,
      );
    else if (tool.name === "getresponse.getNewsletterSummary")
      data = await this.getResponseApi.getNewsletterSummary(
        token.accessToken,
        boundaries,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.getresponse.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        retailOriginPinned: true,
        selectedResourcesBound: true,
      },
    });
    return this.ok(data, `GetResponse ${tool.name.split(".")[1]} completed.`);
  },

  async executeGladly(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "gladly",
      input.connectionId,
    );
    const credentials = this.gladlyCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("gladly", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "gladly.listBusinessHours") {
      action = "gladly_business_hours_list";
      await this.requireConnectorApproval(input, connection, action, "gladly");
      data = await this.gladlyApi.listBusinessHours(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "gladly.getBusinessHours") {
      action = "gladly_business_hours_get";
      await this.requireConnectorApproval(input, connection, action, "gladly");
      data = await this.gladlyApi.getBusinessHours(
        credentials,
        this.requiredString(input.input.businessHoursId, "businessHoursId"),
      );
    } else if (name === "gladly.request") {
      action = "gladly_full_api";
      await this.requireConnectorApproval(input, connection, action, "gladly");
      data = await this.gladlyApi.request(credentials, {
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
      eventType: `marketplace.gladly.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        businessHoursIdHash:
          typeof input.input.businessHoursId === "string"
            ? this.hash(input.input.businessHoursId)
            : null,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Gladly ${name.split(".")[1]} completed.`);
  },

  async executeGong(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "gong",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("gong", input.toolName)!;
    if (tool.name !== "gong.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const apiBaseUrl = this.requiredString(
      connection.metadata?.gongApiBaseUrl ??
        connection.metadata?.GONG_API_BASE_URL,
      "Gong customer API base URL",
    );
    const data = await this.gongApi.read(
      token.accessToken,
      apiBaseUrl,
      operation,
      {
        fromDateTime: input.input.fromDateTime,
        toDateTime: input.input.toDateTime,
      },
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.gong.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Gong call-summary read completed.");
  },

  async executeGoogleAds(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-ads",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-ads", input.toolName)!;
    const requestedCustomerId = this.stringOrNull(input.input.customerId);
    const boundCustomerId = this.stringOrNull(connection.metadata?.customerId);
    if (!boundCustomerId || requestedCustomerId !== boundCustomerId)
      return this.safeError(
        "connection_not_ready",
        "Google Ads requires the explicit customer bound during OAuth connection setup.",
      );
    const token = await this.oauth.refreshIfNeeded(connection);
    const developerToken =
      this.configService?.get<string>("GOOGLE_ADS_DEVELOPER_TOKEN")?.trim() ??
      "";
    const loginCustomerId =
      this.stringOrNull(connection.metadata?.loginCustomerId) ??
      this.configService?.get<string>("GOOGLE_ADS_LOGIN_CUSTOMER_ID")?.trim() ??
      null;
    let data: unknown;
    if (tool.name === "googleAds.getCustomerSummary")
      data = await this.googleAdsApi.getCustomerSummary(
        token.accessToken,
        developerToken,
        input.input,
        loginCustomerId,
      );
    else if (tool.name === "googleAds.getCampaignPerformance")
      data = await this.googleAdsApi.getCampaignPerformance(
        token.accessToken,
        developerToken,
        input.input,
        loginCustomerId,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.google-ads.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        customerIdHash: this.stringOrNull(input.input.customerId)
          ? this.hash(this.stringOrNull(input.input.customerId)!)
          : null,
        reportingOnly: true,
        explicitCustomerOnly: true,
        arbitraryGAQLEnabled: false,
        searchStreamEnabled: false,
        accountDiscoveryEnabled: false,
        mutationsEnabled: false,
        sensitiveAudienceOrClickDataAccessed: false,
        billingOrUserDataAccessed: false,
        automaticPagination: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Ads ${tool.name.split(".")[1]} completed.`);
  },

  async executeGoogleBusinessProfile(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-business-profile",
      input.connectionId,
    );
    const tool = this.registry.getTool(
      "google-business-profile",
      input.toolName,
    )!;
    const boundAccountName = this.stringOrNull(
      connection.metadata?.selectedAccountName,
    );
    const boundLocationName = this.stringOrNull(
      connection.metadata?.selectedLocationName,
    );
    if (!boundAccountName || !boundLocationName)
      return this.safeError(
        "connection_not_ready",
        "Google Business Profile requires an account and location bound during OAuth setup.",
      );
    const requestedAccount = this.stringOrNull(input.input.accountName);
    const requestedLocation = this.stringOrNull(input.input.locationName);
    if (
      (requestedAccount && requestedAccount !== boundAccountName) ||
      (requestedLocation && requestedLocation !== boundLocationName)
    )
      return this.safeError(
        "connection_not_ready",
        "Google Business Profile actions cannot leave the account or location bound during OAuth setup.",
      );
    const scoped = {
      ...input.input,
      accountName: boundAccountName,
      locationName: boundLocationName,
    };
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "googleBusinessProfile.getAccount")
      data = await this.googleBusinessProfileApi.getAccount(
        token.accessToken,
        scoped,
      );
    else if (tool.name === "googleBusinessProfile.getLocation")
      data = await this.googleBusinessProfileApi.getLocation(
        token.accessToken,
        scoped,
      );
    else if (tool.name === "googleBusinessProfile.getPerformance")
      data = await this.googleBusinessProfileApi.getPerformance(
        token.accessToken,
        scoped,
      );
    else if (tool.name === "googleBusinessProfile.listSearchKeywords")
      data = await this.googleBusinessProfileApi.listSearchKeywords(
        token.accessToken,
        scoped,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.google-business-profile.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        accountNameHash: this.hash(boundAccountName),
        locationNameHash: this.hash(boundLocationName),
        readOnlyV1: true,
        providerScopeCanWrite: true,
        writesEnabled: false,
        arbitraryMetricsEnabled: false,
        automaticPagination: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      `Google Business Profile ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeGorgias(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "gorgias",
      input.connectionId,
    );
    const credentials = this.gorgiasCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("gorgias", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "gorgias.listTickets") {
      action = "gorgias_ticket_list";
      await this.requireConnectorApproval(input, connection, action, "gorgias");
      data = await this.gorgiasApi.listTickets(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "gorgias.getTicket") {
      action = "gorgias_ticket_get";
      await this.requireConnectorApproval(input, connection, action, "gorgias");
      data = await this.gorgiasApi.getTicket(
        credentials,
        Number(input.input.ticketId),
      );
    } else if (name === "gorgias.request") {
      action = "gorgias_full_api";
      await this.requireConnectorApproval(input, connection, action, "gorgias");
      data = await this.gorgiasApi.request(credentials, {
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
      eventType: `marketplace.gorgias.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        ticketIdHash:
          typeof input.input.ticketId === "number"
            ? this.hash(String(input.input.ticketId))
            : null,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Gorgias ${name.split(".")[1]} completed.`);
  },

  async executeGroove(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "groove",
      input.connectionId,
    );
    const credentials = this.grooveCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const tool = this.registry.getTool("groove", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "groove.getAccount") {
      action = "groove_account_get";
      data = await this.grooveApi.getAccount(credentials);
    } else if (name === "groove.listChannels") {
      action = "groove_channel_list";
      data = await this.grooveApi.listChannels(credentials, input.input);
    } else if (name === "groove.graphql") {
      action = "groove_full_api";
      await this.requireConnectorApproval(input, connection, action, "groove");
      data = await this.grooveApi.graphql(credentials, {
        query: this.requiredString(input.input.query, "query"),
        variables: this.recordOrUndefined(input.input.variables),
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
      eventType: `marketplace.groove.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        queryHash: this.stringOrNull(input.input.query)
          ? this.hash(this.stringOrNull(input.input.query)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Groove ${name.split(".")[1]} completed.`);
  },

  async executeHelpScout(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "help-scout",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.helpScoutCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("help-scout", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "helpScout.conversationCount") {
      action = "help_scout_conversation_count";
      data = await this.helpScoutApi.conversationCount(credentials);
    } else if (name === "helpScout.listConversations") {
      action = "help_scout_conversation_list";
      data = await this.helpScoutApi.listConversations(
        credentials,
        input.input,
      );
    } else if (name === "helpScout.getConversation") {
      action = "help_scout_conversation_get";
      data = await this.helpScoutApi.getConversation(
        credentials,
        input.input as { conversationId: string },
      );
    } else if (name === "helpScout.request") {
      action = "help_scout_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "help-scout",
      );
      data = await this.helpScoutApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.recordOrUndefined(input.input.query),
        json: this.recordOrUndefined(input.input.json),
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
      eventType: `marketplace.help-scout.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        userIdHash: this.hash(credentials.userId),
        conversationIdHash: this.stringOrNull(input.input.conversationId)
          ? this.hash(this.stringOrNull(input.input.conversationId)!)
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Help Scout ${name.split(".")[1]} completed.`);
  },

  async executeHubSpot(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "hubspot",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.hubSpotCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("hubspot", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "hubspot.listCompanies") {
      action = "hubspot_company_list";
      await this.requireConnectorApproval(input, connection, action, "hubspot");
      data = await this.hubSpotApi.listCompanies(credentials, input.input);
    } else if (name === "hubspot.listDeals") {
      action = "hubspot_deal_list";
      await this.requireConnectorApproval(input, connection, action, "hubspot");
      data = await this.hubSpotApi.listDeals(credentials, input.input);
    } else if (name === "hubspot.getDeal") {
      action = "hubspot_deal_get";
      await this.requireConnectorApproval(input, connection, action, "hubspot");
      data = await this.hubSpotApi.getDeal(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.hubspot.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        hubIdHash: this.hash(credentials.hubId),
        dealIdHash: this.stringOrNull(input.input.dealId)
          ? this.hash(this.stringOrNull(input.input.dealId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `HubSpot ${name.split(".")[1]} completed.`);
  },

  async executeHunter(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "hunter-io",
      input.connectionId,
    );
    const tool = this.registry.getTool("hunter-io", input.toolName)!;
    const credentials = this.hunterCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    let data: unknown;
    let eventType: string;
    if (tool.name === "relay_hunter_get_account_usage") {
      data = await this.hunterApi.getAccountUsage(credentials);
      eventType = "marketplace.hunter.account_usage_get.executed";
    } else if (tool.name === "relay_hunter_get_domain_email_count") {
      data = await this.hunterApi.getDomainEmailCount(
        credentials,
        input.input.domain,
      );
      eventType = "marketplace.hunter.domain_email_count_get.executed";
    } else if (tool.name === "relay_hunter_verify_email") {
      data = await this.hunterApi.verifyEmail(credentials, input.input.email);
      eventType = "marketplace.hunter.email_verify.executed";
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
        fixedReducedRead: true,
        personalInputExcludedFromAudit: true,
        providerContentStored: false,
      },
    });
    return this.ok(data, "Hunter bounded read completed.");
  },

  async executeInstapage(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "instapage",
      input.connectionId,
    );
    const credentials = this.instapageCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("instapage", input.toolName)!;
    if (tool.name !== "instapage.listWorkspaces")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.instapageApi.read(credentials, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.instapage.workspaces_listed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Instapage workspace list completed.");
  },

  async executeIntercom(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "intercom",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.intercomCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("intercom", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "intercom.conversationCount") {
      action = "intercom_conversation_count";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "intercom",
      );
      data = await this.intercomApi.conversationCount(credentials);
    } else if (name === "intercom.listConversations") {
      action = "intercom_conversation_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "intercom",
      );
      data = await this.intercomApi.listConversations(credentials, input.input);
    } else if (name === "intercom.getConversation") {
      action = "intercom_conversation_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "intercom",
      );
      data = await this.intercomApi.getConversation(
        credentials,
        input.input as { conversationId: string },
      );
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.intercom.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        workspaceIdHash: this.hash(credentials.workspaceId),
        adminIdHash: this.hash(credentials.adminId),
        region: credentials.region,
        conversationIdHash: this.stringOrNull(input.input.conversationId)
          ? this.hash(this.stringOrNull(input.input.conversationId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Intercom ${name.split(".")[1]} completed.`);
  },

  async executeJiraServiceManagement(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "jira-service-management",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const cloudId = this.stringOrNull(connection.metadata?.cloudId);
    if (!cloudId)
      return this.safeError(
        "connection_not_ready",
        "Jira Service Management connection is not bound to one Atlassian site.",
      );
    const tool = this.registry.getTool(
      "jira-service-management",
      input.toolName,
    )!;
    let data: unknown;
    if (tool.name === "jsm.read") {
      data = await this.jiraServiceManagementApi.read(
        token.accessToken,
        cloudId,
        input.input,
      );
    } else if (tool.name === "jsm.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "jsm_manage",
        "jira-service-management",
      );
      data = await this.jiraServiceManagementApi.manage(
        token.accessToken,
        cloudId,
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
      eventType: `marketplace.jira-service-management.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "jsm.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        cloudId,
      },
    });
    return this.ok(
      data,
      `Jira Service Management ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeKayako(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "kayako",
      input.connectionId,
    );
    const credentials = this.kayakoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("kayako", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "kayako.listCases") {
      action = "kayako_case_list";
      await this.requireConnectorApproval(input, connection, action, "kayako");
      data = await this.kayakoApi.listCases(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "kayako.getCase") {
      action = "kayako_case_get";
      await this.requireConnectorApproval(input, connection, action, "kayako");
      data = await this.kayakoApi.getCase(
        credentials,
        Number(input.input.caseId),
      );
    } else if (name === "kayako.request") {
      action = "kayako_full_api";
      await this.requireConnectorApproval(input, connection, action, "kayako");
      data = await this.kayakoApi.request(credentials, {
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
      eventType: `marketplace.kayako.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        caseIdHash:
          typeof input.input.caseId === "number"
            ? this.hash(String(input.input.caseId))
            : null,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Kayako ${name.split(".")[1]} completed.`);
  },

  async executeKeapMaxClassic(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "keap-max-classic",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.keapMaxClassicCredentials(token.accessToken);
    const tool = this.registry.getTool("keap-max-classic", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "keapMaxClassic.read") {
      data = await this.keapMaxClassicApi.read(credentials, input.input);
    } else if (name === "keapMaxClassic.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "keap_max_classic_api_manage",
        "keap-max-classic",
      );
      data = await this.keapMaxClassicApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.keap_max_classic.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "keapMaxClassic.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Keap Max Classic ${name.split(".")[1]} completed.`);
  },

  async executeKustomer(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "kustomer",
      input.connectionId,
    );
    const credentials = this.kustomerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("kustomer", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "kustomer.listConversations") {
      action = "kustomer_conversation_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "kustomer",
      );
      data = await this.kustomerApi.listConversations(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "kustomer.getConversation") {
      action = "kustomer_conversation_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "kustomer",
      );
      data = await this.kustomerApi.getConversation(
        credentials,
        this.requiredString(input.input.conversationId, "conversationId"),
      );
    } else if (name === "kustomer.request") {
      action = "kustomer_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "kustomer",
      );
      data = await this.kustomerApi.request(credentials, {
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
      eventType: `marketplace.kustomer.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        conversationIdHash:
          typeof input.input.conversationId === "string"
            ? this.hash(input.input.conversationId)
            : null,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Kustomer ${name.split(".")[1]} completed.`);
  },

  async executeLeadfeeder(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "leadfeeder",
      input.connectionId,
    );
    const credentials = this.leadfeederCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("leadfeeder", input.toolName)!;
    if (tool.name !== "leadfeeder.listAccounts")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.leadfeederApi.read(credentials, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.leadfeeder.accounts_listed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Leadfeeder account list completed.");
  },

  async executeLeadIq(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "leadiq",
      input.connectionId,
    );
    const tool = this.registry.getTool("leadiq", input.toolName)!;
    if (
      tool.name !== "relay_leadiq_get_account_usage" ||
      Object.keys(input.input ?? {}).length
    )
      return this.safeError(
        "tool_unavailable",
        "LeadIQ V1 permits exactly one parameterless account-usage read",
      );
    const credentials = this.leadIqCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const data = await this.leadIqApi.getAccountUsage(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.leadiq.account_usage_get.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        fixedAccountQueryOnly: true,
        creditConsumed: false,
        peopleCompanyDataAccessed: false,
        providerContentStored: false,
      },
    });
    return this.ok(data, "LeadIQ account usage read completed.");
  },

  async executeLemlist(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "lemlist",
      input.connectionId,
    );
    const credentials = this.lemlistCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("lemlist", input.toolName)!;
    if (tool.name !== "lemlist.getCampaignStatus")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "lemlist_campaign_status_get";
    await this.requireConnectorApproval(input, connection, action, "lemlist");
    const data = await this.lemlistApi.getCampaignStatus(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.lemlist.getCampaignStatus.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        campaignIdHash: this.hash(credentials.campaignId),
        identitiesAndMessagesRedacted: true,
      },
    });
    return this.ok(
      data,
      "lemlist campaign status read completed with private identities and messaging data redacted.",
    );
  },

  async executeLessAnnoyingCrm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "less-annoying-crm",
      input.connectionId,
    );
    const credentials = this.lessAnnoyingCrmCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("less-annoying-crm", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "lessAnnoyingCrm.getCurrentUser") {
      action = "less_annoying_crm_user_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "less-annoying-crm",
      );
      data = await this.lessAnnoyingCrmApi.getCurrentUser(credentials);
    } else if (name === "lessAnnoyingCrm.searchContacts") {
      action = "less_annoying_crm_contact_search";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "less-annoying-crm",
      );
      data = await this.lessAnnoyingCrmApi.searchContacts(
        credentials,
        input.input,
      );
    } else if (name === "lessAnnoyingCrm.getContact") {
      action = "less_annoying_crm_contact_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "less-annoying-crm",
      );
      data = await this.lessAnnoyingCrmApi.getContact(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.less-annoying-crm.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        contactIdHash: this.stringOrNull(input.input.contactId)
          ? this.hash(this.stringOrNull(input.input.contactId)!)
          : null,
        searchTermsHash: this.stringOrNull(input.input.searchTerms)
          ? this.hash(this.stringOrNull(input.input.searchTerms)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Less Annoying CRM ${name.split(".")[1]} completed.`);
  },

  async executeLiveAgent(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "liveagent",
      input.connectionId,
    );
    const credentials = this.liveAgentCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("liveagent", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "liveagent.listTickets") {
      action = "liveagent_ticket_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "liveagent",
      );
      data = await this.liveAgentApi.listTickets(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "liveagent.getTicket") {
      action = "liveagent_ticket_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "liveagent",
      );
      data = await this.liveAgentApi.getTicket(
        credentials,
        this.requiredString(input.input.ticketId, "ticketId"),
      );
    } else if (name === "liveagent.request") {
      action = "liveagent_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "liveagent",
      );
      data = await this.liveAgentApi.request(credentials, {
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
      eventType: `marketplace.liveagent.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        domainHash: this.hash(credentials.domain),
        ticketIdHash: this.stringOrNull(input.input.ticketId)
          ? this.hash(this.stringOrNull(input.input.ticketId)!)
          : null,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `LiveAgent ${name.split(".")[1]} completed.`);
  },

  async executeLusha(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "lusha",
      input.connectionId,
    );
    const tool = this.registry.getTool("lusha", input.toolName)!;
    if (
      tool.name !== "relay_lusha_get_account_usage" ||
      Object.keys(input.input ?? {}).length
    )
      return this.safeError(
        "tool_unavailable",
        "Lusha V1 permits exactly one parameterless account-usage read",
      );
    const credentials = this.lushaCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const data = await this.lushaApi.getAccountUsage(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.lusha.account_usage_get.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        fixedAccountUsageOnly: true,
        businessProfileDataAccessed: false,
        providerContentStored: false,
      },
    });
    return this.ok(data, "Lusha account usage read completed.");
  },

  async executeMailercloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mailercloud",
      input.connectionId,
    );
    const credentials = this.mailercloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("mailercloud", input.toolName)!;
    let data: unknown;
    if (tool.name === "mailercloud.getContactSummary")
      data = await this.mailercloudApi.getContactSummary(credentials);
    else if (tool.name === "mailercloud.getCampaignSummary")
      data = await this.mailercloudApi.getCampaignSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mailercloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        nonEmailContactIdBound: true,
        selectedResourcesBound: true,
        privateDetailsExcluded: true,
      },
    });
    return this.ok(data, `Mailercloud ${tool.name.split(".")[1]} completed.`);
  },

  async executeMailerLite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mailerlite",
      input.connectionId,
    );
    const credentials = this.mailerLiteCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("mailerlite", input.toolName)!;
    let data: unknown;
    if (tool.name === "mailerlite.getSubscriberSummary")
      data = await this.mailerLiteApi.getSubscriberSummary(credentials);
    else if (tool.name === "mailerlite.getCampaignSummary")
      data = await this.mailerLiteApi.getCampaignSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mailerlite.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        numericSubscriberIdBound: true,
        selectedResourcesBound: true,
        apiVersionPinned: "2026-07-17",
      },
    });
    return this.ok(data, `MailerLite ${tool.name.split(".")[1]} completed.`);
  },

  async executeMailshake(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mailshake",
      input.connectionId,
    );
    const credentials = this.mailshakeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("mailshake", input.toolName)!;
    if (tool.name !== "mailshake.getCampaignStatus")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "mailshake_campaign_status_get";
    await this.requireConnectorApproval(input, connection, action, "mailshake");
    const data = await this.mailshakeApi.getCampaignStatus(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.mailshake.getCampaignStatus.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        campaignIdHash: this.hash(credentials.campaignId),
        senderPeopleAndContentRedacted: true,
      },
    });
    return this.ok(
      data,
      "Mailshake campaign status read completed with sender, people, and message content redacted.",
    );
  },

  async executeMarketo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "marketo",
      input.connectionId,
    );
    const credentials = this.marketoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("marketo", input.toolName)!;
    let data: unknown;
    if (tool.name === "marketo.getLeadSummary")
      data = await this.marketoApi.getLeadSummary(credentials);
    else if (tool.name === "marketo.getProgramSummary")
      data = await this.marketoApi.getProgramSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.marketo.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedSubscriptionBound: true,
        selectedApiUserBound: true,
        selectedResourcesBound: true,
      },
    });
    return this.ok(data, `Marketo ${tool.name.split(".")[1]} completed.`);
  },
};

export const CrmSupportExecutors2Registrations = {
  front: { methodName: "executeFront", needsConnection: false },
  fullstory: { methodName: "executeFullstory", needsConnection: false },
  getresponse: { methodName: "executeGetResponse", needsConnection: false },
  gladly: { methodName: "executeGladly", needsConnection: false },
  gong: { methodName: "executeGong", needsConnection: false },
  "google-ads": { methodName: "executeGoogleAds", needsConnection: false },
  "google-business-profile": {
    methodName: "executeGoogleBusinessProfile",
    needsConnection: false,
  },
  gorgias: { methodName: "executeGorgias", needsConnection: false },
  groove: { methodName: "executeGroove", needsConnection: false },
  "help-scout": { methodName: "executeHelpScout", needsConnection: false },
  hubspot: { methodName: "executeHubSpot", needsConnection: false },
  "hunter-io": { methodName: "executeHunter", needsConnection: false },
  instapage: { methodName: "executeInstapage", needsConnection: false },
  intercom: { methodName: "executeIntercom", needsConnection: false },
  "jira-service-management": {
    methodName: "executeJiraServiceManagement",
    needsConnection: false,
  },
  kayako: { methodName: "executeKayako", needsConnection: false },
  "keap-max-classic": {
    methodName: "executeKeapMaxClassic",
    needsConnection: false,
  },
  kustomer: { methodName: "executeKustomer", needsConnection: false },
  leadfeeder: { methodName: "executeLeadfeeder", needsConnection: false },
  leadiq: { methodName: "executeLeadIq", needsConnection: false },
  lemlist: { methodName: "executeLemlist", needsConnection: false },
  "less-annoying-crm": {
    methodName: "executeLessAnnoyingCrm",
    needsConnection: false,
  },
  liveagent: { methodName: "executeLiveAgent", needsConnection: false },
  lusha: { methodName: "executeLusha", needsConnection: false },
  mailercloud: { methodName: "executeMailercloud", needsConnection: false },
  mailerlite: { methodName: "executeMailerLite", needsConnection: false },
  mailshake: { methodName: "executeMailshake", needsConnection: false },
  marketo: { methodName: "executeMarketo", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof CrmSupportExecutors2>;
