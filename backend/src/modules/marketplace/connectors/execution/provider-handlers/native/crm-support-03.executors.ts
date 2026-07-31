import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type TeamleaderCredentials } from "../../../teamleader/teamleader-api.adapter";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const CrmSupportExecutors3 = {
  async executeMicrosoftDynamics365(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-dynamics-365",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const binding = this.microsoftDynamics365Binding(connection);
    const tool = this.registry.getTool(
      "microsoft-dynamics-365",
      input.toolName,
    )!;
    let data: unknown;
    if (tool.name === "microsoft-dynamics-365.getOrganization")
      data = await this.microsoftDynamics365Api.getOrganization(
        token.accessToken,
        binding,
      );
    else if (tool.name === "microsoft-dynamics-365.listAccounts")
      data = await this.microsoftDynamics365Api.listAccounts(
        token.accessToken,
        binding,
      );
    else if (tool.name === "microsoft-dynamics-365.getAccount")
      data = await this.microsoftDynamics365Api.getAccount(
        token.accessToken,
        binding,
        input.input,
      );
    else if (tool.name === "microsoft-dynamics-365.listOpportunities")
      data = await this.microsoftDynamics365Api.listOpportunities(
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
      eventType: `marketplace.microsoft_dynamics_365.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedEnvironmentOriginHash: this.hash(binding.environmentOrigin),
        accountIdHash: this.stringOrNull(input.input.accountId)
          ? this.hash(this.stringOrNull(input.input.accountId)!)
          : null,
        contactsIdentitiesCustomSearchWritesExcluded: true,
        maxResults: 25,
      },
    });
    return this.ok(
      data,
      `Microsoft Dynamics 365 ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeMicrosoftDynamics365CustomerService(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-dynamics-365-customer-service",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const environmentOrigin = this.requiredString(
      connection.metadata?.dynamics365CustomerServiceEnvironmentOrigin,
      "Dynamics 365 Customer Service environment",
    );
    const tool = this.registry.getTool(
      "microsoft-dynamics-365-customer-service",
      input.toolName,
    )!;
    if (
      tool.name !==
      "microsoft-dynamics-365-customer-service.getConnectionSummary"
    )
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.microsoftDynamics365CustomerServiceApi.read(
      token.accessToken,
      environmentOrigin,
      operation,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.microsoft_dynamics_365_customer_service.connection_summary_read",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(
      data,
      "Dynamics 365 Customer Service connection summary completed.",
    );
  },

  async executeMicrosoftDynamics365Sales(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-dynamics-365-sales",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const environmentOrigin = this.requiredString(
      connection.metadata?.dynamics365SalesEnvironmentOrigin,
      "Dynamics 365 Sales environment",
    );
    const tool = this.registry.getTool(
      "microsoft-dynamics-365-sales",
      input.toolName,
    )!;
    if (tool.name !== "microsoft-dynamics-365-sales.getConnectionSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.microsoftDynamics365SalesApi.read(
      token.accessToken,
      environmentOrigin,
      operation,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.microsoft_dynamics_365_sales.connection_summary_read",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Dynamics 365 Sales connection summary completed.");
  },

  async executeMixmax(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mixmax",
      input.connectionId,
    );
    const credentials = this.mixmaxCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("mixmax", input.toolName)!;
    if (tool.name !== "mixmax.getSequenceSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "mixmax_sequence_summary_get";
    await this.requireConnectorApproval(input, connection, action, "mixmax");
    const data = await this.mixmaxApi.getSequenceSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.mixmax.getSequenceSummary.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        sequenceIdHash: this.hash(credentials.sequenceId),
        ownersStagesRecipientsMessagesTrackingAndCrmRedacted: true,
      },
    });
    return this.ok(
      data,
      "Mixmax sequence summary read completed with owners, stages, recipients, messages, tracking, and CRM data redacted.",
    );
  },

  async executeMixpanelCohorts(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mixpanel-cohorts",
      input.connectionId,
    );
    const credentials = this.mixpanelCohortsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("mixpanel-cohorts", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "mixpanel-cohorts",
    );
    const data = await this.mixpanelCohortsApi.read(credentials, operation, {});
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mixpanel-cohorts.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Mixpanel Cohorts ${operation} completed.`);
  },

  async executeMoosend(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "moosend",
      input.connectionId,
    );
    const credentials = this.moosendCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("moosend", input.toolName)!;
    let data: unknown;
    if (tool.name === "moosend.getSubscriberSummary")
      data = await this.moosendApi.getSubscriberSummary(credentials);
    else if (tool.name === "moosend.getCampaignSummary")
      data = await this.moosendApi.getCampaignSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.moosend.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        mailingListBound: true,
        selectedResourcesBound: true,
        campaignStatisticsExcluded: true,
      },
    });
    return this.ok(data, `Moosend ${tool.name.split(".")[1]} completed.`);
  },

  async executeMyCase(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "mycase",
        input.connectionId,
      ),
      credentials = this.myCaseCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("mycase", input.toolName)!;
    if (tool.name !== "myCase.getConnectionAuthority")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.myCaseApi.getConnectionAuthority(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        firmIdentityReturned: false,
        userIdentityReturned: false,
        legalPracticeDataReturned: false,
      },
    });
    return this.ok(data, "MyCase connection authority verified.");
  },

  async executeNutshell(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "nutshell",
      input.connectionId,
    );
    const credentials = this.nutshellCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("nutshell", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "nutshell.searchLeads") {
      action = "nutshell_lead_search";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "nutshell",
      );
      data = await this.nutshellApi.searchLeads(credentials, input.input);
    } else if (name === "nutshell.getLead") {
      action = "nutshell_lead_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "nutshell",
      );
      data = await this.nutshellApi.getLead(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.nutshell.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        leadIdHash: this.stringOrNull(input.input.leadId)
          ? this.hash(this.stringOrNull(input.input.leadId)!)
          : null,
        queryHash: this.stringOrNull(input.input.query)
          ? this.hash(this.stringOrNull(input.input.query)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Nutshell ${name.split(".")[1]} completed.`);
  },

  async executeOmnisend(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "omnisend",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const boundaries = this.omnisendBoundaries(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("omnisend", input.toolName)!;
    let data: unknown;
    if (tool.name === "omnisend.getContactSummary")
      data = await this.omnisendApi.getContactSummary(
        token.accessToken,
        boundaries,
      );
    else if (tool.name === "omnisend.getCampaignSummary")
      data = await this.omnisendApi.getCampaignSummary(
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
      eventType: `marketplace.omnisend.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedResourcesBound: true,
        apiVersionPinned: "2026-03-15",
        contactIdentifiersExcluded: true,
        campaignPrivateDetailsExcluded: true,
      },
    });
    return this.ok(data, `Omnisend ${tool.name.split(".")[1]} completed.`);
  },

  async executeOnePageCrm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "onepagecrm",
      input.connectionId,
    );
    const credentials = this.onePageCrmCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("onepagecrm", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "onepagecrm.read") {
      data = await this.onePageCrmApi.read(credentials, input.input);
    } else if (name === "onepagecrm.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "onepagecrm_api_manage",
        "onepagecrm",
      );
      data = await this.onePageCrmApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.onepagecrm.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "onepagecrm.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        onePageCrmUserIdHash: this.hash(credentials.userId),
      },
    });
    return this.ok(data, `OnePageCRM ${name.split(".")[1]} completed.`);
  },

  async executeOntraport(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ontraport",
      input.connectionId,
    );
    const credentials = this.ontraportCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("ontraport", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "ontraport.read") {
      data = await this.ontraportMcp.callRead(credentials, input.input);
    } else if (name === "ontraport.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "ontraport_mcp_manage",
        "ontraport",
      );
      data = await this.ontraportMcp.callManage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.ontraport.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Ontraport ${name.split(".")[1]} completed.`);
  },

  async executeOptimizely(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "optimizely",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("optimizely", input.toolName)!;
    if (tool.name !== "optimizely.listProjects")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.optimizelyApi.read(token.accessToken, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.optimizely.projects_listed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Optimizely project list completed.");
  },

  async executeOutreach(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "outreach",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("outreach", input.toolName)!;
    if (tool.name !== "outreach.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.outreachApi.read(token.accessToken, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.outreach.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Outreach summary read completed.");
  },

  async executePardot(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "pardot",
      input.connectionId,
    );
    const credentials = this.pardotCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("pardot", input.toolName)!;
    let data: unknown;
    if (tool.name === "pardot.getProspectSummary")
      data = await this.pardotApi.getProspectSummary(credentials);
    else if (tool.name === "pardot.getCampaignSummary")
      data = await this.pardotApi.getCampaignSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.pardot.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedEnvironmentBound: true,
        selectedBusinessUnitBound: true,
        selectedResourcesBound: true,
      },
    });
    return this.ok(data, `Pardot ${tool.name.split(".")[1]} completed.`);
  },

  async executePeopleAi(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "people-ai",
      input.connectionId,
    );
    const credentials = this.peopleAiCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("people-ai", input.toolName)!;
    if (tool.name !== "peopleAi.search")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.peopleAiMcp.read(
      credentials,
      operation,
      input.input.query,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.people_ai.search.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "People.ai account search completed.");
  },

  async executePhantomBuster(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "phantombuster",
      input.connectionId,
    );
    const credentials = this.phantomBusterCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("phantombuster", input.toolName)!;
    if (tool.name !== "phantombuster.getAgentStatus")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "phantombuster_agent_status_get";
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "phantombuster",
    );
    const data = await this.phantomBusterApi.getAgentStatus(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.phantombuster.getAgentStatus.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        agentIdHash: this.hash(credentials.agentId),
      },
    });
    return this.ok(data, "PhantomBuster Agent status read completed.");
  },

  async executePipedrive(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "pipedrive",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.pipedriveCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("pipedrive", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "pipedrive.listOrganizations") {
      action = "pipedrive_organization_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "pipedrive",
      );
      data = await this.pipedriveApi.listOrganizations(
        credentials,
        input.input,
      );
    } else if (name === "pipedrive.listDeals") {
      action = "pipedrive_deal_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "pipedrive",
      );
      data = await this.pipedriveApi.listDeals(credentials, input.input);
    } else if (name === "pipedrive.getDeal") {
      action = "pipedrive_deal_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "pipedrive",
      );
      data = await this.pipedriveApi.getDeal(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.pipedrive.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        companyIdHash: this.hash(credentials.companyId),
        apiOriginHash: this.hash(credentials.apiOrigin),
        dealIdHash: this.stringOrNull(input.input.dealId)
          ? this.hash(this.stringOrNull(input.input.dealId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Pipedrive ${name.split(".")[1]} completed.`);
  },

  async executeReAmaze(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "re-amaze",
      input.connectionId,
    );
    const credentials = this.reAmazeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("re-amaze", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "reamaze.listConversations") {
      action = "reamaze_conversation_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "re-amaze",
      );
      data = await this.reAmazeApi.listConversations(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "reamaze.getConversation") {
      action = "reamaze_conversation_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "re-amaze",
      );
      data = await this.reAmazeApi.getConversation(
        credentials,
        this.requiredString(input.input.conversationSlug, "conversationSlug"),
      );
    } else if (name === "reamaze.request") {
      action = "reamaze_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "re-amaze",
      );
      data = await this.reAmazeApi.request(credentials, {
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
      eventType: `marketplace.reamaze.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        conversationSlugHash:
          typeof input.input.conversationSlug === "string"
            ? this.hash(input.input.conversationSlug)
            : null,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Re:amaze ${name.split(".")[1]} completed.`);
  },

  async executeReallySimpleSystems(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "really-simple-systems",
      input.connectionId,
    );
    const credentials = this.reallySimpleSystemsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "really-simple-systems",
      input.toolName,
    )!;
    const name = tool.name;
    let data: unknown;
    if (name === "really-simple-systems.read") {
      data = await this.reallySimpleSystemsApi.read(credentials, input.input);
    } else if (name === "really-simple-systems.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "really_simple_systems_api_manage",
        "really-simple-systems",
      );
      data = await this.reallySimpleSystemsApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.really-simple-systems.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "really-simple-systems.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Spotler CRM ${name.split(".")[1]} completed.`);
  },

  async executeReplyIo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "reply-io",
      input.connectionId,
    );
    const credentials = this.replyIoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("reply-io", input.toolName)!;
    if (tool.name !== "replyIo.getSequenceStatus")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "reply_io_sequence_status_get";
    await this.requireConnectorApproval(input, connection, action, "reply-io");
    const data = await this.replyIoApi.getSequenceStatus(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.reply-io.getSequenceStatus.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        sequenceIdHash: this.hash(credentials.sequenceId),
        ownersAccountsStepsContactsAndContentRedacted: true,
      },
    });
    return this.ok(
      data,
      "Reply.io sequence status read completed with owners, accounts, steps, contacts, and message content redacted.",
    );
  },

  async executeRocketReach(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "rocketreach",
      input.connectionId,
    );
    const tool = this.registry.getTool("rocketreach", input.toolName)!;
    if (
      tool.name !== "relay_rocketreach_get_account_usage" ||
      Object.keys(input.input ?? {}).length
    )
      return this.safeError(
        "tool_unavailable",
        "RocketReach V1 permits exactly one parameterless account-usage read",
      );
    const credentials = this.rocketReachCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const data = await this.rocketReachApi.getAccountUsage(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.rocketreach.account_usage_get.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        fixedUniversalAccountReadOnly: true,
        creditConsumed: false,
        accountIdentityStripped: true,
        peopleCompanyDataAccessed: false,
        providerContentStored: false,
      },
    });
    return this.ok(data, "RocketReach account usage read completed.");
  },

  async executeSalesflare(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "salesflare",
      input.connectionId,
    );
    const credentials = this.salesflareCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("salesflare", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "salesflare.read") {
      data = await this.salesflareApi.read(credentials, input.input);
    } else if (name === "salesflare.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "salesflare_api_manage",
        "salesflare",
      );
      data = await this.salesflareApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.salesflare.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "salesflare.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Salesflare ${name.split(".")[1]} completed.`);
  },

  async executeSalesforce(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "salesforce",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.salesforceCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("salesforce", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "salesforce.listAccounts") {
      action = "salesforce_account_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "salesforce",
      );
      data = await this.salesforceApi.listAccounts(credentials, input.input);
    } else if (name === "salesforce.listOpportunities") {
      action = "salesforce_opportunity_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "salesforce",
      );
      data = await this.salesforceApi.listOpportunities(
        credentials,
        input.input,
      );
    } else if (name === "salesforce.getOpportunity") {
      action = "salesforce_opportunity_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "salesforce",
      );
      data = await this.salesforceApi.getOpportunity(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.salesforce.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        organizationIdHash: this.hash(credentials.organizationId),
        instanceOriginHash: this.hash(credentials.instanceOrigin),
        opportunityIdHash: this.stringOrNull(input.input.opportunityId)
          ? this.hash(this.stringOrNull(input.input.opportunityId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Salesforce ${name.split(".")[1]} completed.`);
  },

  async executeSalesforceDataCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "salesforce-data-cloud",
      input.connectionId,
    );
    const credentials = this.salesforceDataCloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "salesforce-data-cloud",
      input.toolName,
    )!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "salesforce-data-cloud",
      );
    const data = await this.salesforceDataCloudApi.read(
      credentials,
      operation,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.salesforce-data-cloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Salesforce Data Cloud ${operation} completed.`);
  },

  async executeSalesforceMarketingCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "salesforce-marketing-cloud",
      input.connectionId,
    );
    const credentials = this.salesforceMarketingCloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "salesforce-marketing-cloud",
      input.toolName,
    )!;
    let data: unknown;
    if (tool.name === "salesforce-marketing-cloud.getBusinessUnitContext")
      data =
        await this.salesforceMarketingCloudApi.getBusinessUnitContext(
          credentials,
        );
    else if (tool.name === "salesforce-marketing-cloud.getEndpointSummary")
      data =
        await this.salesforceMarketingCloudApi.getEndpointSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.salesforce_marketing_cloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedBusinessUnitBound: true,
        requestedScopeEmpty: true,
      },
    });
    return this.ok(
      data,
      `Salesforce Marketing Cloud ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeSalesloft(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "salesloft",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("salesloft", input.toolName)!;
    if (tool.name !== "salesloft.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.salesloftApi.read(token.accessToken, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.salesloft.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Salesloft summary read completed.");
  },

  async executeSeamlessAi(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "seamless-ai",
      input.connectionId,
    );
    const tool = this.registry.getTool("seamless-ai", input.toolName)!;
    if (tool.name !== "relay_seamless_search_companies")
      return this.safeError(
        "tool_unavailable",
        "Seamless.AI V1 permits exactly one bounded company-only search",
      );
    const credentials = this.seamlessAiCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const data = await this.seamlessAiApi.searchCompanies(
      credentials,
      input.input ?? {},
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.seamless_ai.company_search.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        resultCount: data.resultCount,
        fixedCompanySearchOnly: true,
        researchStarted: false,
        peopleContactDataAccessed: false,
        providerContentStored: false,
      },
    });
    return this.ok(data, "Seamless.AI company search completed.");
  },

  async executeSnov(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "snov-io",
      input.connectionId,
    );
    const tool = this.registry.getTool("snov-io", input.toolName)!;
    const credentials = this.snovCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    let data: unknown;
    let eventType: string;
    if (tool.name === "relay_snov_start_email_verification") {
      data = await this.snovApi.startEmailVerification(
        credentials,
        input.input.email,
      );
      eventType = "marketplace.snov.email_verification_start.executed";
    } else if (tool.name === "relay_snov_get_email_verification_result") {
      data = await this.snovApi.getEmailVerificationResult(
        credentials,
        input.input.taskHash,
      );
      eventType = "marketplace.snov.email_verification_result_get.executed";
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
        fixedSingleEmailVerificationOnly: true,
        personalInputAndTaskHashExcludedFromAudit: true,
        providerContentStored: false,
      },
    });
    return this.ok(data, "Snov.io bounded verification action completed.");
  },

  async executeSpotio(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "spotio",
      input.connectionId,
    );
    const credentials = this.spotioCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("spotio", input.toolName)!;
    if (tool.name !== "spotio.getDataObjectSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "spotio_data_object_summary_get";
    await this.requireConnectorApproval(input, connection, action, "spotio");
    const data = await this.spotioApi.getDataObjectSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.spotio.getDataObjectSummary.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        dataObjectIdHash: this.hash(credentials.dataObjectId),
        peopleLocationFieldsNotesCommunicationAndPrivateContentRedacted: true,
      },
    });
    return this.ok(
      data,
      "SPOTIO data-object summary read completed with people, location, fields, notes, communication, and private content redacted.",
    );
  },

  async executeStreak(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "streak",
      input.connectionId,
    );
    const credentials = this.streakCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("streak", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "streak.getCurrentUser") {
      action = "streak_user_get";
      await this.requireConnectorApproval(input, connection, action, "streak");
      data = await this.streakApi.getCurrentUser(credentials);
    } else if (name === "streak.getPipeline") {
      action = "streak_pipeline_get";
      await this.requireConnectorApproval(input, connection, action, "streak");
      data = await this.streakApi.getPipeline(credentials, input.input);
    } else if (name === "streak.listBoxes") {
      action = "streak_box_list";
      await this.requireConnectorApproval(input, connection, action, "streak");
      data = await this.streakApi.listBoxes(credentials, input.input);
    } else if (name === "streak.getBox") {
      action = "streak_box_get";
      await this.requireConnectorApproval(input, connection, action, "streak");
      data = await this.streakApi.getBox(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.streak.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        pipelineKeyHash: this.stringOrNull(input.input.pipelineKey)
          ? this.hash(this.stringOrNull(input.input.pipelineKey)!)
          : null,
        boxKeyHash: this.stringOrNull(input.input.boxKey)
          ? this.hash(this.stringOrNull(input.input.boxKey)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Streak ${name.split(".")[1]} completed.`);
  },

  async executeSugarCrm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sugarcrm",
      input.connectionId,
    );
    const credentials = this.sugarCrmCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sugarcrm", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "sugarcrm.read") {
      data = await this.sugarCrmApi.read(credentials, input.input);
    } else if (name === "sugarcrm.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "sugarcrm_api_manage",
        "sugarcrm",
      );
      data = await this.sugarCrmApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.sugarcrm.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        sugarCrmHostHash: this.hash(credentials.host),
        sugarCrmUsernameHash: this.hash(credentials.username),
      },
    });
    return this.ok(data, `SugarCRM ${name.split(".")[1]} completed.`);
  },

  async executeSuiteCrmCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "suitecrm-cloud",
      input.connectionId,
    );
    const credentials = this.suiteCrmCloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("suitecrm-cloud", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "suitecrm-cloud.read") {
      data = await this.suiteCrmCloudApi.read(credentials, input.input);
    } else if (name === "suitecrm-cloud.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "suitecrm_cloud_api_manage",
        "suitecrm-cloud",
      );
      data = await this.suiteCrmCloudApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.suitecrm-cloud.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        suiteCrmCloudHostHash: this.hash(credentials.host),
      },
    });
    return this.ok(data, `SuiteCRM Hosted ${name.split(".")[1]} completed.`);
  },

  async executeTeamleader(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "teamleader",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials: TeamleaderCredentials = {
      accessToken: token.accessToken,
    };
    const tool = this.registry.getTool("teamleader", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "teamleader.getCurrentUser") {
      action = "teamleader_user_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "teamleader",
      );
      data = await this.teamleaderApi.getCurrentUser(credentials);
    } else if (name === "teamleader.listDeals") {
      action = "teamleader_deal_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "teamleader",
      );
      data = await this.teamleaderApi.listDeals(credentials, input.input);
    } else if (name === "teamleader.getDeal") {
      action = "teamleader_deal_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "teamleader",
      );
      data = await this.teamleaderApi.getDeal(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.teamleader.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Teamleader ${name.split(".")[1]} completed.`);
  },
};

export const CrmSupportExecutors3Registrations = {
  "microsoft-dynamics-365": {
    methodName: "executeMicrosoftDynamics365",
    needsConnection: false,
  },
  "microsoft-dynamics-365-customer-service": {
    methodName: "executeMicrosoftDynamics365CustomerService",
    needsConnection: false,
  },
  "microsoft-dynamics-365-sales": {
    methodName: "executeMicrosoftDynamics365Sales",
    needsConnection: false,
  },
  mixmax: { methodName: "executeMixmax", needsConnection: false },
  "mixpanel-cohorts": {
    methodName: "executeMixpanelCohorts",
    needsConnection: false,
  },
  moosend: { methodName: "executeMoosend", needsConnection: false },
  mycase: { methodName: "executeMyCase", needsConnection: false },
  nutshell: { methodName: "executeNutshell", needsConnection: false },
  omnisend: { methodName: "executeOmnisend", needsConnection: false },
  onepagecrm: { methodName: "executeOnePageCrm", needsConnection: false },
  ontraport: { methodName: "executeOntraport", needsConnection: false },
  optimizely: { methodName: "executeOptimizely", needsConnection: false },
  outreach: { methodName: "executeOutreach", needsConnection: false },
  pardot: { methodName: "executePardot", needsConnection: false },
  "people-ai": { methodName: "executePeopleAi", needsConnection: false },
  phantombuster: { methodName: "executePhantomBuster", needsConnection: false },
  pipedrive: { methodName: "executePipedrive", needsConnection: false },
  "re-amaze": { methodName: "executeReAmaze", needsConnection: false },
  "really-simple-systems": {
    methodName: "executeReallySimpleSystems",
    needsConnection: false,
  },
  "reply-io": { methodName: "executeReplyIo", needsConnection: false },
  rocketreach: { methodName: "executeRocketReach", needsConnection: false },
  salesflare: { methodName: "executeSalesflare", needsConnection: false },
  salesforce: { methodName: "executeSalesforce", needsConnection: false },
  "salesforce-data-cloud": {
    methodName: "executeSalesforceDataCloud",
    needsConnection: false,
  },
  "salesforce-marketing-cloud": {
    methodName: "executeSalesforceMarketingCloud",
    needsConnection: false,
  },
  salesloft: { methodName: "executeSalesloft", needsConnection: false },
  "seamless-ai": { methodName: "executeSeamlessAi", needsConnection: false },
  "snov-io": { methodName: "executeSnov", needsConnection: false },
  spotio: { methodName: "executeSpotio", needsConnection: false },
  streak: { methodName: "executeStreak", needsConnection: false },
  sugarcrm: { methodName: "executeSugarCrm", needsConnection: false },
  "suitecrm-cloud": {
    methodName: "executeSuiteCrmCloud",
    needsConnection: false,
  },
  teamleader: { methodName: "executeTeamleader", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof CrmSupportExecutors3>;
