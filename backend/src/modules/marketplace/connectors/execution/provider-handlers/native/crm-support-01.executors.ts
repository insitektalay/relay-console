import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const CrmSupportExecutors1 = {
  async executeAbTasty(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ab-tasty",
      input.connectionId,
    );
    const credentials = this.abTastyCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("ab-tasty", input.toolName)!;
    if (tool.name !== "abTasty.listProjects")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.abTastyApi.read(credentials, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.ab_tasty.projects_listed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "AB Tasty project list completed.");
  },

  async executeAcquire(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "acquire",
      input.connectionId,
    );
    const credentials = this.acquireCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("acquire", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "acquire.listCases") {
      action = "acquire_case_list";
      await this.requireConnectorApproval(input, connection, action, "acquire");
      data = await this.acquireApi.listCases(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "acquire.getCase") {
      action = "acquire_case_get";
      await this.requireConnectorApproval(input, connection, action, "acquire");
      data = await this.acquireApi.getCase(
        credentials,
        Number(input.input.caseId),
      );
    } else if (name === "acquire.request") {
      action = "acquire_full_api";
      await this.requireConnectorApproval(input, connection, action, "acquire");
      data = await this.acquireApi.request(credentials, {
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
      eventType: `marketplace.acquire.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Acquire ${name.split(".")[1]} completed.`);
  },

  async executeAdobeMarketoEngage(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "adobe-marketo-engage",
      input.connectionId,
    );
    const credentials = this.adobeMarketoEngageCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("adobe-marketo-engage", input.toolName)!;
    if (tool.name !== "adobe-marketo-engage.listPrograms")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.adobeMarketoEngageApi.read(
      credentials,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.adobe_marketo_engage.programs_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
      },
    });
    return this.ok(data, "Adobe Marketo Engage programs listed.");
  },

  async executeAdobeRealTimeCdp(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "adobe-real-time-cdp",
      input.connectionId,
    );
    const credentials = this.adobeRealTimeCdpCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("adobe-real-time-cdp", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "adobe-real-time-cdp",
      );
    const data = await this.adobeRealTimeCdpApi.read(
      credentials,
      operation,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.adobe-real-time-cdp.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Adobe Real-Time CDP ${operation} completed.`);
  },

  async executeAgileCrm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "agile-crm",
      input.connectionId,
    );
    const credentials = this.agileCrmCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("agile-crm", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "agileCrm.listDeals") {
      action = "agile_crm_deal_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "agile-crm",
      );
      data = await this.agileCrmApi.listDeals(credentials, input.input);
    } else if (name === "agileCrm.getDeal") {
      action = "agile_crm_deal_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "agile-crm",
      );
      data = await this.agileCrmApi.getDeal(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.agile-crm.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        dealIdHash: this.stringOrNull(input.input.dealId)
          ? this.hash(this.stringOrNull(input.input.dealId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Agile CRM ${name.split(".")[1]} completed.`);
  },

  async executeApolloIo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "apollo-io",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("apollo-io", input.toolName)!;
    if (tool.name !== "apolloIo.search")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.apolloIoApi.read(token.accessToken, operation, {
      query: input.input.query,
      page: input.input.page,
      limit: input.input.limit,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.apollo_io.search.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Apollo search completed.");
  },

  async executeAttio(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "attio",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.attioCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("attio", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "attio.read") {
      data = await this.attioApi.read(credentials, input.input);
    } else if (name === "attio.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "attio_api_manage",
        "attio",
      );
      data = await this.attioApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.attio.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        attioWorkspaceIdHash: this.hash(credentials.workspaceId),
      },
    });
    return this.ok(data, `Attio ${name.split(".")[1]} completed.`);
  },

  async executeAWeber(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "aweber",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const boundaries = this.aweberBoundaries(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("aweber", input.toolName)!;
    let data: unknown;
    if (tool.name === "aweber.getSubscriberSummary")
      data = await this.aweberApi.getSubscriberSummary(
        token.accessToken,
        boundaries,
      );
    else if (tool.name === "aweber.getCampaignSummary")
      data = await this.aweberApi.getCampaignSummary(
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
      eventType: `marketplace.aweber.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedAccountBound: true,
        selectedListBound: true,
        numericSubscriberIdBound: true,
        selectedCampaignTypeBound: true,
        selectedResourcesBound: true,
      },
    });
    return this.ok(data, `AWeber ${tool.name.split(".")[1]} completed.`);
  },

  async executeBenchmarkEmail(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "benchmark-email",
      input.connectionId,
    );
    const credentials = this.benchmarkEmailCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("benchmark-email", input.toolName)!;
    let data: unknown;
    if (tool.name === "benchmarkEmail.getContactSummary")
      data = await this.benchmarkEmailApi.getContactSummary(credentials);
    else if (tool.name === "benchmarkEmail.getCampaignSummary")
      data = await this.benchmarkEmailApi.getCampaignSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.benchmark-email.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        regionalOriginValidated: true,
        nonEmailContactIdBound: true,
        selectedResourcesBound: true,
        privateDetailsExcluded: true,
      },
    });
    return this.ok(
      data,
      `Benchmark Email ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeBitrix24(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "bitrix24",
      input.connectionId,
    );
    const credentials = this.bitrix24Credentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("bitrix24", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "bitrix24.getProfile") {
      action = "bitrix24_profile_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "bitrix24",
      );
      data = await this.bitrix24Api.getProfile(credentials);
    } else if (name === "bitrix24.listDeals") {
      action = "bitrix24_deal_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "bitrix24",
      );
      data = await this.bitrix24Api.listDeals(credentials, input.input);
    } else if (name === "bitrix24.getDeal") {
      action = "bitrix24_deal_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "bitrix24",
      );
      data = await this.bitrix24Api.getDeal(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.bitrix24.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        dealIdHash: this.stringOrNull(input.input.dealId)
          ? this.hash(this.stringOrNull(input.input.dealId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Bitrix24 ${name.split(".")[1]} completed.`);
  },

  async executeChimeCrm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "chime-crm",
      input.connectionId,
    );
    const credentials = this.chimeCrmCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("chime-crm", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "chime-crm.read") {
      data = await this.chimeCrmApi.read(credentials, input.input);
    } else if (name === "chime-crm.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "chime_crm_api_manage",
        "chime-crm",
      );
      data = await this.chimeCrmApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.chime-crm.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "chime-crm.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        chimeCrmApiKeyHash: this.hash(credentials.apiKey),
      },
    });
    return this.ok(data, `Chime CRM ${name.split(".")[1]} completed.`);
  },

  async executeChorusAi(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "chorus-ai",
      input.connectionId,
    );
    const credentials = this.chorusAiCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("chorus-ai", input.toolName)!;
    if (tool.name !== "chorusAi.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.chorusAiApi.read(credentials, operation, {
      minDate: input.input.minDate,
      maxDate: input.input.maxDate,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.chorus_ai.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Chorus.ai engagement-summary read completed.");
  },

  async executeCirrusInsight(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "cirrus-insight",
      input.connectionId,
    );
    const credentials = this.cirrusInsightCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("cirrus-insight", input.toolName)!;
    if (tool.name !== "cirrusInsight.getSchedulingLinks")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "cirrus_insight_scheduling_links_get";
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "cirrus-insight",
    );
    const data = await this.cirrusInsightApi.getSchedulingLinks(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.cirrus-insight.getSchedulingLinks.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        organizationIdHash: this.hash(credentials.organizationId),
        userEmailHash: this.hash(credentials.userEmail),
        peopleMeetingsAvailabilityWebhooksAndPrivateCalendarDataRedacted: true,
      },
    });
    return this.ok(
      data,
      "Cirrus Insight scheduling links read completed with user identity, people, meetings, availability, webhooks, and private calendar data redacted.",
    );
  },

  async executeClari(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "clari",
      input.connectionId,
    );
    const credentials = this.clariCopilotCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("clari", input.toolName)!;
    if (tool.name !== "clari.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.clariCopilotApi.read(credentials, operation, {
      fromDateTime: input.input.fromDateTime,
      toDateTime: input.input.toDateTime,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.clari.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Clari Copilot call-summary read completed.");
  },

  async executeClay(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "clay",
      input.connectionId,
    );
    const credentials = this.clayCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("clay", input.toolName)!;
    if (tool.name !== "clay.getWorkspace")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "clay_workspace_get";
    await this.requireConnectorApproval(input, connection, action, "clay");
    const data = await this.clayApi.getWorkspace(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.clay.getWorkspace.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        providerWorkspaceIdHash: this.hash(data.workspace.workspaceId ?? ""),
      },
    });
    return this.ok(data, "Clay workspace binding read completed.");
  },

  async executeClearbit(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "clearbit",
      input.connectionId,
    );
    const credentials = this.clearbitCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("clearbit", input.toolName)!;
    if (tool.name !== "clearbit.findCompany")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.clearbitApi.read(credentials, operation, {
      domain: input.input.domain,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.clearbit.company_lookup.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Clearbit company lookup completed.");
  },

  async executeClose(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "close",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.closeCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("close", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "close.getOrganization") {
      action = "close_organization_get";
      await this.requireConnectorApproval(input, connection, action, "close");
      data = await this.closeApi.getOrganization(credentials);
    } else if (name === "close.listOpportunities") {
      action = "close_opportunity_list";
      await this.requireConnectorApproval(input, connection, action, "close");
      data = await this.closeApi.listOpportunities(credentials, input.input);
    } else if (name === "close.getOpportunity") {
      action = "close_opportunity_get";
      await this.requireConnectorApproval(input, connection, action, "close");
      data = await this.closeApi.getOpportunity(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.close.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        organizationIdHash: this.hash(credentials.organizationId),
        opportunityIdHash: this.stringOrNull(input.input.opportunityId)
          ? this.hash(this.stringOrNull(input.input.opportunityId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Close ${name.split(".")[1]} completed.`);
  },

  async executeCognism(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "cognism",
      input.connectionId,
    );
    const credentials = this.cognismCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("cognism", input.toolName)!;
    if (tool.name !== "cognism.searchAccounts")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.cognismApi.read(credentials, operation, {
      query: input.input.query,
      matchType: input.input.matchType,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.cognism.account_search.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Cognism account preview completed.");
  },

  async executeCommonRoom(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "common-room",
      input.connectionId,
    );
    const credentials = this.commonRoomCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("common-room", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "commonRoom.tokenStatus")
      data = await this.commonRoomApi.tokenStatus(credentials);
    else if (name === "commonRoom.listSegments")
      data = await this.commonRoomApi.listSegments(credentials, input.input);
    else if (name === "commonRoom.listProviders")
      data = await this.commonRoomApi.listProviders(credentials, input.input);
    else if (name === "commonRoom.requestV2") {
      await this.requireConnectorApproval(
        input,
        connection,
        "v2_api",
        "common-room",
      );
      data = await this.commonRoomApi.request(credentials, {
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
      eventType: `marketplace.common-room.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Common Room ${name.split(".")[1]} completed.`);
  },

  async executeCopper(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "copper",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.copperCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("copper", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "copper.getAccount") {
      action = "copper_account_get";
      await this.requireConnectorApproval(input, connection, action, "copper");
      data = await this.copperApi.getAccount(credentials);
    } else if (name === "copper.listOpportunities") {
      action = "copper_opportunity_list";
      await this.requireConnectorApproval(input, connection, action, "copper");
      data = await this.copperApi.listOpportunities(credentials, input.input);
    } else if (name === "copper.getOpportunity") {
      action = "copper_opportunity_get";
      await this.requireConnectorApproval(input, connection, action, "copper");
      data = await this.copperApi.getOpportunity(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.copper.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        opportunityIdHash: this.stringOrNull(input.input.opportunityId)
          ? this.hash(this.stringOrNull(input.input.opportunityId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Copper ${name.split(".")[1]} completed.`);
  },

  async executeCreatio(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "creatio",
      input.connectionId,
    );
    const credentials = this.creatioCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("creatio", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "creatio.read") {
      data = await this.creatioApi.read(credentials, input.input);
    } else if (name === "creatio.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "creatio_api_manage",
        "creatio",
      );
      data = await this.creatioApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.creatio.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        creatioHostHash: this.hash(credentials.host),
        creatioUsernameHash: this.hash(credentials.username),
      },
    });
    return this.ok(data, `Creatio ${name.split(".")[1]} completed.`);
  },

  async executeDiscoEdiscovery(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "disco-ediscovery",
        input.connectionId,
      ),
      credentials = this.discoEdiscoveryCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("disco-ediscovery", input.toolName)!;
    let data: unknown;
    if (tool.name === "discoEdiscovery.listDatasets") {
      data = await this.discoEdiscoveryApi.listDatasets(credentials);
    } else if (tool.name === "discoEdiscovery.getUsageSummary") {
      data = await this.discoEdiscoveryApi.getUsageSummary(credentials, {
        startDate: this.requiredString(input.input.startDate, "startDate"),
        endDate: this.requiredString(input.input.endDate, "endDate"),
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
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        apiOrigin: "https://api.csdisco.com",
        organizationBound: true,
        legalRowDataReturned: false,
        documentDataReturned: false,
        userDataReturned: false,
        rawPayloadReturned: false,
      },
    });
    return this.ok(data, "DISCO eDiscovery read completed.");
  },

  async executeDrip(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "drip",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const boundaries = this.dripBoundaries(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("drip", input.toolName)!;
    let data: unknown;
    if (tool.name === "drip.getSubscriberSummary")
      data = await this.dripApi.getSubscriberSummary(
        token.accessToken,
        boundaries,
      );
    else if (tool.name === "drip.getCampaignSummary")
      data = await this.dripApi.getCampaignSummary(
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
      eventType: `marketplace.drip.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedAccountBound: true,
        nonEmailSubscriberIdBound: true,
        selectedResourcesBound: true,
      },
    });
    return this.ok(data, `Drip ${tool.name.split(".")[1]} completed.`);
  },

  async executeEDesk(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "edesk",
      input.connectionId,
    );
    const credentials = this.edeskCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("edesk", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "edesk.listTickets") {
      action = "edesk_ticket_list";
      await this.requireConnectorApproval(input, connection, action, "edesk");
      data = await this.edeskApi.listTickets(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "edesk.getTicket") {
      action = "edesk_ticket_get";
      await this.requireConnectorApproval(input, connection, action, "edesk");
      data = await this.edeskApi.getTicket(
        credentials,
        Number(input.input.ticketId),
      );
    } else if (name === "edesk.request") {
      action = "edesk_full_api";
      await this.requireConnectorApproval(input, connection, action, "edesk");
      data = await this.edeskApi.request(credentials, {
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
      eventType: `marketplace.edesk.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `eDesk ${name.split(".")[1]} completed.`);
  },

  async executeEloqua(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "eloqua",
      input.connectionId,
    );
    const credentials = this.eloquaCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("eloqua", input.toolName)!;
    let data: unknown;
    if (tool.name === "eloqua.getContactSummary")
      data = await this.eloquaApi.getContactSummary(credentials);
    else if (tool.name === "eloqua.getCampaignSummary")
      data = await this.eloquaApi.getCampaignSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.eloqua.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedSiteBound: true,
        discoveredPodBound: true,
        selectedResourcesBound: true,
      },
    });
    return this.ok(data, `Eloqua ${tool.name.split(".")[1]} completed.`);
  },

  async executeEmma(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "emma",
      input.connectionId,
    );
    const credentials = this.emmaCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("emma", input.toolName)!;
    let data: unknown;
    if (tool.name === "emma.getMemberSummary")
      data = await this.emmaApi.getMemberSummary(credentials);
    else if (tool.name === "emma.getMailingSummary")
      data = await this.emmaApi.getMailingSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.emma.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        fixedOrigin: true,
        numericAccountAndResourceIdsBound: true,
        privateDetailsExcluded: true,
      },
    });
    return this.ok(data, `Emma ${tool.name.split(".")[1]} completed.`);
  },

  async executeEvaboot(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "evaboot",
      input.connectionId,
    );
    const credentials = this.evabootCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("evaboot", input.toolName)!;
    if (tool.name !== "evaboot.getQuota")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "evaboot_quota_get";
    await this.requireConnectorApproval(input, connection, action, "evaboot");
    const data = await this.evabootApi.getQuota(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.evaboot.getQuota.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        identifiersRedacted: true,
      },
    });
    return this.ok(data, "Evaboot privacy-redacted quota read completed.");
  },

  async executeFlodesk(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "flodesk",
      input.connectionId,
    );
    const credentials = this.flodeskCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("flodesk", input.toolName)!;
    let data: unknown;
    if (tool.name === "flodesk.getSubscriberSummary")
      data = await this.flodeskApi.getSubscriberSummary(credentials);
    else if (tool.name === "flodesk.getSegmentSummary")
      data = await this.flodeskApi.getSegmentSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.flodesk.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        fixedOrigin: true,
        nonEmailSubscriberIdBound: true,
        selectedResourcesBound: true,
        privateDetailsExcluded: true,
      },
    });
    return this.ok(data, `Flodesk ${tool.name.split(".")[1]} completed.`);
  },

  async executeFolkCrm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "folk-crm",
      input.connectionId,
    );
    const credentials = this.folkCrmCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("folk-crm", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "folk-crm.read") {
      data = await this.folkCrmApi.read(credentials, input.input);
    } else if (name === "folk-crm.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "folk_crm_api_manage",
        "folk-crm",
      );
      data = await this.folkCrmApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.folk-crm.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "folk-crm.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `folk CRM ${name.split(".")[1]} completed.`);
  },

  async executeFollowUpBoss(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "follow-up-boss",
      input.connectionId,
    );
    const credentials = this.followUpBossCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("follow-up-boss", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "follow-up-boss.read") {
      data = await this.followUpBossApi.read(credentials, input.input);
    } else if (name === "follow-up-boss.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "follow_up_boss_api_manage",
        "follow-up-boss",
      );
      data = await this.followUpBossApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.follow-up-boss.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "follow-up-boss.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        followUpBossApiKeyHash: this.hash(credentials.apiKey),
        followUpBossSystemHash: this.hash(credentials.systemName),
      },
    });
    return this.ok(data, `Follow Up Boss ${name.split(".")[1]} completed.`);
  },

  async executeFreshchat(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "freshchat",
      input.connectionId,
    );
    const credentials = this.freshchatCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("freshchat", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "freshchat.getConversation") {
      action = "freshchat_conversation_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshchat",
      );
      data = await this.freshchatApi.getConversation(
        credentials,
        this.requiredString(input.input.conversationId, "conversationId"),
      );
    } else if (name === "freshchat.listMessages") {
      action = "freshchat_message_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshchat",
      );
      data = await this.freshchatApi.listMessages(credentials, {
        conversationId: this.requiredString(
          input.input.conversationId,
          "conversationId",
        ),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "freshchat.request") {
      action = "freshchat_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshchat",
      );
      data = await this.freshchatApi.request(credentials, {
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
      eventType: `marketplace.freshchat.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountUrlHash: this.hash(credentials.accountUrl),
        conversationIdHash: this.stringOrNull(input.input.conversationId)
          ? this.hash(this.stringOrNull(input.input.conversationId)!)
          : null,
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Freshchat ${name.split(".")[1]} completed.`);
  },

  async executeFreshdesk(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "freshdesk",
      input.connectionId,
    );
    const credentials = this.freshdeskCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("freshdesk", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "freshdesk.listTickets") {
      data = await this.freshdeskApi.listTickets(credentials, input.input);
    } else if (name === "freshdesk.getTicket") {
      data = await this.freshdeskApi.getTicket(credentials, input.input);
    } else if (name === "freshdesk.request") {
      action = "freshdesk_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshdesk",
      );
      data = await this.freshdeskApi.request(credentials, {
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
      eventType: `marketplace.freshdesk.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        domainHash: this.hash(credentials.domain),
        ticketIdHash: this.stringOrNull(input.input.ticketId)
          ? this.hash(this.stringOrNull(input.input.ticketId)!)
          : null,
        path: this.stringOrNull(input.input.path),
        page: input.input.page ?? null,
        perPage: input.input.perPage ?? null,
      },
    });
    return this.ok(data, `Freshdesk ${name.split(".")[1]} completed.`);
  },

  async executeFreshservice(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "freshservice",
      input.connectionId,
    );
    const credentials = this.freshserviceCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("freshservice", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "freshservice.listTickets") {
      action = "freshservice_ticket_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshservice",
      );
      data = await this.freshserviceApi.listTickets(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
        workspaceId:
          typeof input.input.workspaceId === "number"
            ? input.input.workspaceId
            : undefined,
      });
    } else if (name === "freshservice.getTicket") {
      action = "freshservice_ticket_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshservice",
      );
      data = await this.freshserviceApi.getTicket(
        credentials,
        Number(input.input.ticketId),
      );
    } else if (name === "freshservice.request") {
      action = "freshservice_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshservice",
      );
      data = await this.freshserviceApi.request(credentials, {
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
      eventType: `marketplace.freshservice.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        domainHash: this.hash(credentials.domain),
        ticketIdHash: this.stringOrNull(input.input.ticketId)
          ? this.hash(this.stringOrNull(input.input.ticketId)!)
          : null,
        workspaceIdHash: this.stringOrNull(input.input.workspaceId)
          ? this.hash(this.stringOrNull(input.input.workspaceId)!)
          : null,
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Freshservice ${name.split(".")[1]} completed.`);
  },
};

export const CrmSupportExecutors1Registrations = {
  "ab-tasty": { methodName: "executeAbTasty", needsConnection: false },
  acquire: { methodName: "executeAcquire", needsConnection: false },
  "adobe-marketo-engage": {
    methodName: "executeAdobeMarketoEngage",
    needsConnection: false,
  },
  "adobe-real-time-cdp": {
    methodName: "executeAdobeRealTimeCdp",
    needsConnection: false,
  },
  "agile-crm": { methodName: "executeAgileCrm", needsConnection: false },
  "apollo-io": { methodName: "executeApolloIo", needsConnection: false },
  attio: { methodName: "executeAttio", needsConnection: false },
  aweber: { methodName: "executeAWeber", needsConnection: false },
  "benchmark-email": {
    methodName: "executeBenchmarkEmail",
    needsConnection: false,
  },
  bitrix24: { methodName: "executeBitrix24", needsConnection: false },
  "chime-crm": { methodName: "executeChimeCrm", needsConnection: false },
  "chorus-ai": { methodName: "executeChorusAi", needsConnection: false },
  "cirrus-insight": {
    methodName: "executeCirrusInsight",
    needsConnection: false,
  },
  clari: { methodName: "executeClari", needsConnection: false },
  clay: { methodName: "executeClay", needsConnection: false },
  clearbit: { methodName: "executeClearbit", needsConnection: false },
  close: { methodName: "executeClose", needsConnection: false },
  cognism: { methodName: "executeCognism", needsConnection: false },
  "common-room": { methodName: "executeCommonRoom", needsConnection: false },
  copper: { methodName: "executeCopper", needsConnection: false },
  creatio: { methodName: "executeCreatio", needsConnection: false },
  "disco-ediscovery": {
    methodName: "executeDiscoEdiscovery",
    needsConnection: false,
  },
  drip: { methodName: "executeDrip", needsConnection: false },
  edesk: { methodName: "executeEDesk", needsConnection: false },
  eloqua: { methodName: "executeEloqua", needsConnection: false },
  emma: { methodName: "executeEmma", needsConnection: false },
  evaboot: { methodName: "executeEvaboot", needsConnection: false },
  flodesk: { methodName: "executeFlodesk", needsConnection: false },
  "folk-crm": { methodName: "executeFolkCrm", needsConnection: false },
  "follow-up-boss": {
    methodName: "executeFollowUpBoss",
    needsConnection: false,
  },
  freshchat: { methodName: "executeFreshchat", needsConnection: false },
  freshdesk: { methodName: "executeFreshdesk", needsConnection: false },
  freshservice: { methodName: "executeFreshservice", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof CrmSupportExecutors1>;
