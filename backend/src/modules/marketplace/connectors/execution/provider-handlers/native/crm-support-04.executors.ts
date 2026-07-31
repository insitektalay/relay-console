import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const CrmSupportExecutors4 = {
  async executeTexAu(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "texau",
      input.connectionId,
    );
    const credentials = this.texAuCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("texau", input.toolName)!;
    if (tool.name !== "texau.identifyEmailType")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "texau_email_type_identify";
    await this.requireConnectorApproval(input, connection, action, "texau");
    const email = this.requiredString(input.input.email, "email");
    const data = await this.texAuApi.identifyEmailType(credentials, { email });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.texau.identifyEmailType.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        emailHash: this.hash(email.trim().toLowerCase()),
      },
    });
    return this.ok(
      data,
      "TexAu email type classification completed with the address redacted.",
    );
  },

  async executeTidio(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "tidio",
      input.connectionId,
    );
    const credentials = this.tidioCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("tidio", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "tidio.listTickets") {
      action = "tidio_ticket_list";
      await this.requireConnectorApproval(input, connection, action, "tidio");
      data = await this.tidioApi.listTickets(credentials);
    } else if (name === "tidio.getTicket") {
      action = "tidio_ticket_get";
      await this.requireConnectorApproval(input, connection, action, "tidio");
      data = await this.tidioApi.getTicket(
        credentials,
        Number(input.input.ticketId),
      );
    } else if (name === "tidio.request") {
      action = "tidio_full_api";
      await this.requireConnectorApproval(input, connection, action, "tidio");
      data = await this.tidioApi.request(credentials, {
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
      eventType: `marketplace.tidio.${name.split(".")[1]}.executed`,
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
      },
    });
    return this.ok(data, `Tidio ${name.split(".")[1]} completed.`);
  },

  async executeUnbounce(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "unbounce",
      input.connectionId,
    );
    const credentials = this.unbounceCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("unbounce", input.toolName)!;
    if (tool.name !== "unbounce.listPages")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.unbounceApi.read(credentials, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.unbounce.pages_listed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Unbounce page list completed.");
  },

  async executeUpLead(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "uplead",
      input.connectionId,
    );
    const tool = this.registry.getTool("uplead", input.toolName)!;
    if (
      tool.name !== "relay_uplead_get_credit_balance" ||
      Object.keys(input.input ?? {}).length
    )
      return this.safeError(
        "tool_unavailable",
        "UpLead V1 permits exactly one parameterless credit-balance read",
      );
    const credentials = this.upLeadCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const data = await this.upLeadApi.getCreditBalance(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.uplead.credit_balance_get.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        fixedCreditsReadOnly: true,
        recordCreditConsumed: false,
        accountEmailStripped: true,
        peopleCompanyDataAccessed: false,
        providerContentStored: false,
      },
    });
    return this.ok(data, "UpLead credit balance read completed.");
  },

  async executeVtigerCrm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vtiger-crm",
      input.connectionId,
    );
    const credentials = this.vtigerCrmCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("vtiger-crm", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "vtiger-crm.read") {
      data = await this.vtigerCrmApi.read(credentials, input.input);
    } else if (name === "vtiger-crm.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "vtiger_crm_api_manage",
        "vtiger-crm",
      );
      data = await this.vtigerCrmApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.vtiger-crm.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        vtigerInstanceHash: this.hash(
          `${credentials.instance}.${credentials.cluster}`,
        ),
        vtigerUsernameHash: this.hash(credentials.username),
      },
    });
    return this.ok(data, `Vtiger CRM ${name.split(".")[1]} completed.`);
  },

  async executeVwo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vwo",
      input.connectionId,
    );
    const credentials = this.vwoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("vwo", input.toolName)!;
    if (tool.name !== "vwo.listProjects")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.vwoApi.read(credentials, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.vwo.projects_listed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "VWO project list completed.");
  },

  async executeWiza(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "wiza",
      input.connectionId,
    );
    const tool = this.registry.getTool("wiza", input.toolName)!;
    if (
      tool.name !== "relay_wiza_get_credit_balances" ||
      Object.keys(input.input ?? {}).length
    )
      return this.safeError(
        "tool_unavailable",
        "Wiza V1 permits exactly one parameterless credit-balances read",
      );
    const credentials = this.wizaCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const data = await this.wizaApi.getCreditBalances(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.wiza.credit_balances_get.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        fixedCreditBalancesReadOnly: true,
        creditConsumed: false,
        peopleCompanyDataAccessed: false,
        providerContentStored: false,
      },
    });
    return this.ok(data, "Wiza credit balances read completed.");
  },

  async executeWoodpecker(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "woodpecker",
      input.connectionId,
    );
    const credentials = this.woodpeckerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("woodpecker", input.toolName)!;
    if (tool.name !== "woodpecker.getCampaignStatus")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "woodpecker_campaign_status_get";
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "woodpecker",
    );
    const data = await this.woodpeckerApi.getCampaignStatus(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.woodpecker.getCampaignStatus.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        campaignIdHash: this.hash(credentials.campaignId),
        accountsSettingsProspectsAndContentRedacted: true,
      },
    });
    return this.ok(
      data,
      "Woodpecker campaign status read completed with accounts, settings, prospects, and message content redacted.",
    );
  },

  async executeZendesk(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zendesk",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zendeskCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("zendesk", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "zendesk.ticketCount") {
      action = "zendesk_ticket_count";
      await this.requireConnectorApproval(input, connection, action, "zendesk");
      data = await this.zendeskApi.ticketCount(credentials);
    } else if (name === "zendesk.listTickets") {
      action = "zendesk_ticket_list";
      await this.requireConnectorApproval(input, connection, action, "zendesk");
      data = await this.zendeskApi.listTickets(credentials, input.input);
    } else if (name === "zendesk.getTicket") {
      action = "zendesk_ticket_get";
      await this.requireConnectorApproval(input, connection, action, "zendesk");
      data = await this.zendeskApi.getTicket(
        credentials,
        input.input as { ticketId: string },
      );
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.zendesk.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        instanceOriginHash: this.hash(credentials.instanceOrigin),
        userIdHash: this.hash(credentials.userId),
        ticketIdHash: this.stringOrNull(input.input.ticketId)
          ? this.hash(this.stringOrNull(input.input.ticketId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Zendesk ${name.split(".")[1]} completed.`);
  },

  async executeZendeskSell(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zendesk-sell",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zendeskSellCredentials(token.accessToken);
    const tool = this.registry.getTool("zendesk-sell", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "zendeskSell.read") {
      data = await this.zendeskSellApi.read(credentials, input.input);
    } else if (name === "zendeskSell.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "zendesk_sell_api_manage",
        "zendesk-sell",
      );
      data = await this.zendeskSellApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.zendesk_sell.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "zendeskSell.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Zendesk Sell ${name.split(".")[1]} completed.`);
  },

  async executeZoho(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zohoCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("zoho", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "zoho.listAccounts") {
      action = "zoho_account_list";
      await this.requireConnectorApproval(input, connection, action, "zoho");
      data = await this.zohoApi.listAccounts(credentials, input.input);
    } else if (name === "zoho.listDeals") {
      action = "zoho_deal_list";
      await this.requireConnectorApproval(input, connection, action, "zoho");
      data = await this.zohoApi.listDeals(credentials, input.input);
    } else if (name === "zoho.getDeal") {
      action = "zoho_deal_get";
      await this.requireConnectorApproval(input, connection, action, "zoho");
      data = await this.zohoApi.getDeal(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.zoho.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        organizationIdHash: this.hash(credentials.organizationId),
        apiOriginHash: this.hash(credentials.apiOrigin),
        dealIdHash: this.stringOrNull(input.input.dealId)
          ? this.hash(this.stringOrNull(input.input.dealId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Zoho CRM ${name.split(".")[1]} completed.`);
  },

  async executeZohoDesk(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho-desk",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zohoDeskCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("zoho-desk", input.toolName)!;
    let action: string;
    let data: unknown;
    if (tool.name === "zohoDesk.listTickets") {
      action = "zoho_desk_ticket_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-desk",
      );
      data = await this.zohoDeskApi.listTickets(credentials, input.input);
    } else if (tool.name === "zohoDesk.getTicket") {
      action = "zoho_desk_ticket_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-desk",
      );
      data = await this.zohoDeskApi.getTicket(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.zoho-desk.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        organizationIdHash: this.hash(credentials.organizationId),
        region: connection.metadata?.zohoRegion,
      },
    });
    return this.ok(data, `Zoho Desk ${tool.name.split(".")[1]} completed.`);
  },

  async executeZoomInfo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoominfo",
      input.connectionId,
    );
    const credentials = this.zoomInfoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("zoominfo", input.toolName)!;
    if (tool.name !== "zoominfo.searchCompanies")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.zoomInfoApi.read(credentials, operation, {
      companyName: input.input.companyName,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.zoominfo.company_search.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "ZoomInfo company search completed.");
  },
};

export const CrmSupportExecutors4Registrations = {
  texau: { methodName: "executeTexAu", needsConnection: false },
  tidio: { methodName: "executeTidio", needsConnection: false },
  unbounce: { methodName: "executeUnbounce", needsConnection: false },
  uplead: { methodName: "executeUpLead", needsConnection: false },
  "vtiger-crm": { methodName: "executeVtigerCrm", needsConnection: false },
  vwo: { methodName: "executeVwo", needsConnection: false },
  wiza: { methodName: "executeWiza", needsConnection: false },
  woodpecker: { methodName: "executeWoodpecker", needsConnection: false },
  zendesk: { methodName: "executeZendesk", needsConnection: false },
  "zendesk-sell": { methodName: "executeZendeskSell", needsConnection: false },
  zoho: { methodName: "executeZoho", needsConnection: false },
  "zoho-desk": { methodName: "executeZohoDesk", needsConnection: false },
  zoominfo: { methodName: "executeZoomInfo", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof CrmSupportExecutors4>;
