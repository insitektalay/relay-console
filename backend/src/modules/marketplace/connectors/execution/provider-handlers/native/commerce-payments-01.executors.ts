import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const CommercePaymentsExecutors1 = {
  async executeBinance(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "binance",
      input.connectionId,
    );
    const credentials = this.binanceCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("binance", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "binance.market.read") {
      data = await this.binanceApi.market(input.input);
    } else if (name === "binance.account.read") {
      await this.requireConnectorApproval(
        input,
        connection,
        "binance_account_read",
        "binance",
      );
      data = await this.binanceApi.account(credentials, input.input);
    } else if (name === "binance.order.place") {
      await this.requireConnectorApproval(
        input,
        connection,
        "binance_order_place",
        "binance",
      );
      data = await this.binanceApi.placeOrder(credentials, input.input);
    } else if (name === "binance.order.cancel") {
      await this.requireConnectorApproval(
        input,
        connection,
        "binance_order_cancel",
        "binance",
      );
      data = await this.binanceApi.cancelOrder(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.binance.${name.split(".").slice(1).join(".")}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        kind: this.stringOrNull(input.input.kind),
        symbol: this.stringOrNull(input.input.symbol),
        orderId: this.stringOrNull(input.input.orderId),
      },
    });
    return this.ok(
      data,
      `Binance ${name.split(".").slice(1).join(" ")} completed.`,
    );
  },

  async executeFirstPromoter(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "firstpromoter",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("firstpromoter", input.toolName)!;
    if (tool.name !== "firstPromoter.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.firstPromoterMcp.read(token.accessToken, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.firstpromoter.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "FirstPromoter analytics read completed.");
  },

  async executeFreeAgent(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "freeagent",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.freeAgentCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("freeagent", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "freeagent.getConnectedCompany") {
      data = await this.freeAgentApi.getConnectedCompany(credentials);
    } else if (name === "freeagent.listInvoices") {
      action = "freeagent_invoice_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freeagent",
      );
      data = await this.freeAgentApi.listInvoices(credentials, input.input);
    } else if (name === "freeagent.getInvoice") {
      action = "freeagent_invoice_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freeagent",
      );
      data = await this.freeAgentApi.getInvoice(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.freeagent.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        companyIdHash: this.hash(credentials.companyId),
        invoiceIdHash: this.stringOrNull(input.input.invoiceId)
          ? this.hash(this.stringOrNull(input.input.invoiceId)!)
          : null,
        page: input.input.page ?? null,
        view: input.input.view ?? null,
      },
    });
    return this.ok(data, `FreeAgent ${name.split(".")[1]} completed.`);
  },

  async executeFreshBooks(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "freshbooks",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.freshBooksCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("freshbooks", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "freshbooks.getConnectedBusiness") {
      data = await this.freshBooksApi.getConnectedBusiness(credentials);
    } else if (name === "freshbooks.listInvoices") {
      action = "freshbooks_invoice_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshbooks",
      );
      data = await this.freshBooksApi.listInvoices(credentials, input.input);
    } else if (name === "freshbooks.getInvoice") {
      action = "freshbooks_invoice_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "freshbooks",
      );
      data = await this.freshBooksApi.getInvoice(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.freshbooks.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        businessIdHash: this.hash(credentials.businessId),
        accountIdHash: this.hash(credentials.accountId),
        invoiceIdHash: this.stringOrNull(input.input.invoiceId)
          ? this.hash(this.stringOrNull(input.input.invoiceId)!)
          : null,
        page: input.input.page ?? null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `FreshBooks ${name.split(".")[1]} completed.`);
  },

  async executeGemini(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "gemini",
      input.connectionId,
    );
    const credentials = this.geminiCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("gemini", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "gemini.market.read") {
      data = await this.geminiApi.market(input.input);
    } else if (name === "gemini.account.read") {
      await this.requireConnectorApproval(
        input,
        connection,
        "gemini_account_read",
        "gemini",
      );
      data = await this.geminiApi.account(credentials, input.input);
    } else if (name === "gemini.order.place") {
      await this.requireConnectorApproval(
        input,
        connection,
        "gemini_order_place",
        "gemini",
      );
      data = await this.geminiApi.placeOrder(credentials, input.input);
    } else if (name === "gemini.order.cancel") {
      await this.requireConnectorApproval(
        input,
        connection,
        "gemini_order_cancel",
        "gemini",
      );
      data = await this.geminiApi.cancelOrder(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.gemini.${name.split(".").slice(1).join(".")}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        kind: this.stringOrNull(input.input.kind),
        symbol: this.stringOrNull(input.input.symbol),
        orderId: this.stringOrNull(input.input.orderId),
        execution: this.stringOrNull(input.input.execution),
      },
    });
    return this.ok(
      data,
      `Gemini ${name.split(".").slice(1).join(" ")} completed.`,
    );
  },

  async executeGoogleMerchantCenter(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-merchant-center",
      input.connectionId,
    );
    const tool = this.registry.getTool(
      "google-merchant-center",
      input.toolName,
    )!;
    const boundAccountName = this.stringOrNull(
      connection.metadata?.selectedAccountName,
    );
    if (!boundAccountName)
      return this.safeError(
        "connection_not_ready",
        "Google Merchant Center requires an account bound during OAuth setup.",
      );
    const requested = this.stringOrNull(input.input.accountName);
    if (requested && requested !== boundAccountName)
      return this.safeError(
        "connection_not_ready",
        "Google Merchant Center actions cannot leave the account bound during OAuth setup.",
      );
    const scoped =
      tool.name === "googleMerchantCenter.listAccounts"
        ? input.input
        : { ...input.input, accountName: boundAccountName };
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "googleMerchantCenter.listAccounts")
      data = await this.googleMerchantCenterApi.listAccounts(token.accessToken);
    else if (tool.name === "googleMerchantCenter.listProducts")
      data = await this.googleMerchantCenterApi.listProducts(
        token.accessToken,
        scoped,
      );
    else if (tool.name === "googleMerchantCenter.getProduct")
      data = await this.googleMerchantCenterApi.getProduct(
        token.accessToken,
        scoped,
      );
    else if (tool.name === "googleMerchantCenter.reviewProductIssues")
      data = await this.googleMerchantCenterApi.reviewProductIssues(
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
      eventType: `marketplace.google-merchant-center.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        accountNameHash: this.hash(boundAccountName),
        stableV1Only: true,
        providerScopeCanWrite: true,
        writesEnabled: false,
        fixedReportsOnly: true,
        arbitraryQueryEnabled: false,
        automaticPagination: false,
        serviceAccountEnabled: false,
        v1BetaEnabled: false,
        contentApiEnabled: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      `Google Merchant Center ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeKashFlow(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "kashflow",
      input.connectionId,
    );
    const credentials = this.kashFlowCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("kashflow", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "kashflow.listCurrencies") {
      action = "kashflow_currency_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "kashflow",
      );
      data = await this.kashFlowSoap.listCurrencies(credentials, input.input);
    } else if (name === "kashflow.getVatRegistration") {
      action = "kashflow_vat_registration_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "kashflow",
      );
      data = await this.kashFlowSoap.getVatRegistration(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.kashflow.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        usernameHash: this.hash(credentials.username),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `KashFlow ${name.split(".")[1]} completed.`);
  },

  async executeKraken(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "kraken",
      input.connectionId,
    );
    const credentials = this.krakenCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("kraken", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "kraken.market.read") {
      data = await this.krakenApi.market(input.input);
    } else if (name === "kraken.account.read") {
      await this.requireConnectorApproval(
        input,
        connection,
        "kraken_account_read",
        "kraken",
      );
      data = await this.krakenApi.account(credentials, input.input);
    } else if (name === "kraken.order.place") {
      await this.requireConnectorApproval(
        input,
        connection,
        "kraken_order_place",
        "kraken",
      );
      data = await this.krakenApi.placeOrder(credentials, input.input);
    } else if (name === "kraken.order.cancel") {
      await this.requireConnectorApproval(
        input,
        connection,
        "kraken_order_cancel",
        "kraken",
      );
      data = await this.krakenApi.cancelOrder(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.kraken.${name.split(".").slice(1).join(".")}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        kind: this.stringOrNull(input.input.kind),
      },
    });
    return this.ok(
      data,
      `Kraken ${name.split(".").slice(1).join(" ")} completed.`,
    );
  },

  async executeMagentoSelfHosted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "magento-self-hosted",
      input.connectionId,
    );
    const credentials = this.magentoSelfHostedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("magento-self-hosted", input.toolName)!;
    if (tool.name !== "magento-self-hosted.getSelectedProductStock")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.magentoSelfHostedApi.getSelectedProductStock(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.magento-self-hosted.getSelectedProductStock.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        publicCoreGraphqlOnly: true,
        selectedProductSkuBound: true,
        contentPricingAndPrivateCommerceDataExcluded: true,
        cartOrderAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(
      data,
      "Magento Self-Hosted getSelectedProductStock completed.",
    );
  },

  async executeMicrosoftDynamics365BusinessCentral(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-dynamics-365-business-central",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const environmentName = this.requiredString(
      connection.metadata?.businessCentralEnvironmentName,
      "Business Central environment",
    );
    const tool = this.registry.getTool(
      "microsoft-dynamics-365-business-central",
      input.toolName,
    )!;
    if (tool.name !== "microsoft-dynamics-365-business-central.listCompanies")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.microsoftDynamics365BusinessCentralApi.read(
      token.accessToken,
      environmentName,
      operation,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.microsoft_dynamics_365_business_central.companies_read",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Business Central companies listed.");
  },

  async executeMyob(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "myob",
      input.connectionId,
    );
    const stored = this.credentials.decrypt(connection);
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.myobCredentials(
      connection,
      stored,
      token.accessToken,
    );
    const tool = this.registry.getTool("myob", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "myob.getCompanyFile") {
      action = "myob_company_file_get";
      await this.requireConnectorApproval(input, connection, action, "myob");
      data = await this.myobApi.getCompanyFile(credentials);
    } else if (name === "myob.getApiInfo") {
      action = "myob_api_info_get";
      await this.requireConnectorApproval(input, connection, action, "myob");
      data = await this.myobApi.getApiInfo(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.myob.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        companyFileIdHash: this.hash(credentials.companyFileId),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `MYOB ${name.split(".")[1]} completed.`);
  },

  async executeNetSuite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "netsuite",
      input.connectionId,
    );
    const credentials = this.netSuiteCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("netsuite", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "netsuite.listAccountingPeriods") {
      action = "netsuite_accounting_period_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "netsuite",
      );
      data = await this.netSuiteApi.listAccountingPeriods(
        credentials,
        input.input,
      );
    } else if (name === "netsuite.getAccountingPeriod") {
      action = "netsuite_accounting_period_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "netsuite",
      );
      data = await this.netSuiteApi.getAccountingPeriod(
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
      eventType: `marketplace.netsuite.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        suiteTalkOriginHash: this.hash(credentials.suiteTalkOrigin),
        periodIdHash: this.stringOrNull(input.input.periodId)
          ? this.hash(this.stringOrNull(input.input.periodId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `NetSuite ${name.split(".")[1]} completed.`);
  },

  async executePayPal(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "paypal",
      input.connectionId,
    );
    const credentials = this.paypalCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("paypal", input.toolName)!;
    const name = tool.name;
    const action = tool.functionName;
    await this.requireConnectorApproval(input, connection, action, "paypal");
    let data: unknown;
    if (name === "paypal.listTransactions")
      data = await this.paypalApi.listTransactions(credentials, input.input);
    else if (name === "paypal.getTransaction")
      data = await this.paypalApi.getTransaction(credentials, input.input);
    else if (name === "paypal.getOrder")
      data = await this.paypalApi.getOrder(credentials, input.input);
    else if (name === "paypal.getCapture")
      data = await this.paypalApi.getCapture(credentials, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.paypal.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        environment: credentials.environment,
        transactionIdHash: this.stringOrNull(input.input.transactionId)
          ? this.hash(this.stringOrNull(input.input.transactionId)!)
          : null,
        orderIdHash: this.stringOrNull(input.input.orderId)
          ? this.hash(this.stringOrNull(input.input.orderId)!)
          : null,
        captureIdHash: this.stringOrNull(input.input.captureId)
          ? this.hash(this.stringOrNull(input.input.captureId)!)
          : null,
        startDate: this.stringOrNull(input.input.startDate),
        endDate: this.stringOrNull(input.input.endDate),
      },
    });
    return this.ok(data, `PayPal ${name.split(".")[1]} completed.`);
  },

  async executePrestaShopSelfHosted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "prestashop-self-hosted",
      input.connectionId,
    );
    const credentials = this.prestashopSelfHostedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "prestashop-self-hosted",
      input.toolName,
    )!;
    if (tool.name !== "prestashop-self-hosted.getSelectedProductAvailability")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.prestashopSelfHostedApi.getSelectedProductAvailability(
        credentials,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.prestashop-self-hosted.getSelectedProductAvailability.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        productsViewOnlyKeyRequired: true,
        selectedProductIdBound: true,
        fixedFieldProjection: true,
        contentPricingAndPrivateShopDataExcluded: true,
        otherResourcesAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(
      data,
      "PrestaShop Self-Hosted getSelectedProductAvailability completed.",
    );
  },

  async executeQuickBooks(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "quickbooks",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.quickBooksCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("quickbooks", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "quickbooks.getCompanyInfo") {
      data = await this.quickBooksApi.getCompanyInfo(credentials);
    } else if (name === "quickbooks.listInvoices") {
      action = "quickbooks_invoice_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "quickbooks",
      );
      data = await this.quickBooksApi.listInvoices(credentials, input.input);
    } else if (name === "quickbooks.getInvoice") {
      action = "quickbooks_invoice_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "quickbooks",
      );
      data = await this.quickBooksApi.getInvoice(credentials, input.input);
    } else if (name === "quickbooks.listPayrollCompensations") {
      action = "quickbooks_payroll_compensations_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "quickbooks",
      );
      data = await this.quickBooksApi.listPayrollCompensations(
        credentials,
        input.input,
      );
    } else if (name === "quickbooks.getPaymentCharge") {
      action = "quickbooks_payment_charge_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "quickbooks",
      );
      data = await this.quickBooksApi.getPaymentCharge(
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
      eventType: `marketplace.quickbooks.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        realmIdHash: this.hash(credentials.realmId),
        environment: credentials.environment,
        invoiceIdHash: this.stringOrNull(input.input.invoiceId)
          ? this.hash(this.stringOrNull(input.input.invoiceId)!)
          : null,
        employeeIdHash: this.stringOrNull(input.input.employeeId)
          ? this.hash(this.stringOrNull(input.input.employeeId)!)
          : null,
        chargeIdHash: this.stringOrNull(input.input.chargeId)
          ? this.hash(this.stringOrNull(input.input.chargeId)!)
          : null,
        startPosition: input.input.startPosition ?? null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `QuickBooks ${name.split(".")[1]} completed.`);
  },

  async executeRewardful(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "rewardful",
      input.connectionId,
    );
    const credentials = this.rewardfulCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("rewardful", input.toolName)!;
    if (tool.name !== "rewardful.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.rewardfulApi.read(credentials, operation, {
      page: input.input.page,
      limit: input.input.limit,
      affiliateId: input.input.affiliateId,
      state: input.input.state,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.rewardful.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Rewardful reporting read completed.");
  },

  async executeSageAccounting(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sage-accounting",
      input.connectionId,
    );
    const stored = this.credentials.decrypt(connection);
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.sageAccountingCredentials(
      connection,
      stored,
      token.accessToken,
    );
    const tool = this.registry.getTool("sage-accounting", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "sage-accounting.getBusiness") {
      action = "sage_accounting_business_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "sage-accounting",
      );
      data = await this.sageAccountingApi.getBusiness(credentials);
    } else if (name === "sage-accounting.listLedgerAccountClassifications") {
      action = "sage_accounting_ledger_classification_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "sage-accounting",
      );
      data = await this.sageAccountingApi.listLedgerAccountClassifications(
        credentials,
        input.input,
      );
    } else if (name === "sage-accounting.getLedgerAccountClassification") {
      action = "sage_accounting_ledger_classification_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "sage-accounting",
      );
      data = await this.sageAccountingApi.getLedgerAccountClassification(
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
      eventType: `marketplace.sage-accounting.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        businessIdHash: this.hash(credentials.businessId),
        classificationIdHash: this.stringOrNull(input.input.classificationId)
          ? this.hash(this.stringOrNull(input.input.classificationId)!)
          : null,
        page: name.includes("list") ? 1 : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Sage Accounting ${name.split(".")[1]} completed.`);
  },

  async executeSageIntacct(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sage-intacct",
      input.connectionId,
    );
    const credentials = this.sageIntacctCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sage-intacct", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "sage-intacct.listReportingPeriods") {
      action = "sage_intacct_reporting_period_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "sage-intacct",
      );
      data = await this.sageIntacctApi.listReportingPeriods(
        credentials,
        input.input,
      );
    } else if (name === "sage-intacct.getReportingPeriod") {
      action = "sage_intacct_reporting_period_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "sage-intacct",
      );
      data = await this.sageIntacctApi.getReportingPeriod(
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
      eventType: `marketplace.sage-intacct.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        usernameHash: this.hash(credentials.username),
        periodKeyHash: this.stringOrNull(input.input.periodKey)
          ? this.hash(this.stringOrNull(input.input.periodKey)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Sage Intacct ${name.split(".")[1]} completed.`);
  },

  async executeSalesforceCommerceCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "salesforce-commerce-cloud",
      input.connectionId,
    );
    const credentials = this.salesforceCommerceCloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "salesforce-commerce-cloud",
      input.toolName,
    )!;
    let data: unknown;
    if (tool.name === "salesforce-commerce-cloud.getProductSummary")
      data =
        await this.salesforceCommerceCloudApi.getProductSummary(credentials);
    else if (tool.name === "salesforce-commerce-cloud.getCategorySummary")
      data =
        await this.salesforceCommerceCloudApi.getCategorySummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.salesforce_commerce_cloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedSiteBound: true,
        exactScopesEnforced: true,
      },
    });
    return this.ok(
      data,
      `Salesforce Commerce Cloud ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeShopify(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "shopify",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.shopifyCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("shopify", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "shopify.getShop")
      data = await this.shopifyApi.getShop(credentials);
    else if (name === "shopify.listProducts")
      data = await this.shopifyApi.listProducts(credentials, input.input);
    else if (name === "shopify.getProduct")
      data = await this.shopifyApi.getProduct(credentials, input.input);
    else if (name === "shopify.listPublications")
      data = await this.shopifyApi.listPublications(credentials);
    else if (name === "shopify.prepareProductChange")
      data = this.shopifyApi.prepareProductChange(credentials, input.input);
    else if (name === "shopify.createDraftProduct") {
      action = "shopify_product_create_draft";
      await this.requireShopifyApproval(input, connection, action);
      data = await this.shopifyApi.createDraftProduct(credentials, input.input);
    } else if (name === "shopify.updateDraftProduct") {
      action = "shopify_product_update_draft";
      await this.requireShopifyApproval(input, connection, action);
      data = await this.shopifyApi.updateDraftProduct(credentials, input.input);
    } else if (name === "shopify.activateProduct") {
      action = "shopify_product_activate";
      await this.requireShopifyApproval(input, connection, action);
      data = await this.shopifyApi.activateProduct(credentials, input.input);
    } else if (name === "shopify.publishProduct") {
      action = "shopify_product_publish";
      await this.requireShopifyApproval(input, connection, action);
      data = await this.shopifyApi.publishProduct(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );

    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.shopify.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        shopDomain: credentials.shopDomain,
        productId: this.stringOrNull(input.input.productId),
        publicationId: this.stringOrNull(input.input.publicationId),
        expectedUpdatedAt: this.stringOrNull(input.input.expectedUpdatedAt),
        ...(tool.action === "write"
          ? {
              idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
              resultHash: this.hash(JSON.stringify(data)),
            }
          : {}),
      },
    });
    return this.ok(data, `Shopify ${name.split(".")[1]} completed.`);
  },

  async executeStripe(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "stripe",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.stripeCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("stripe", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "stripe.getBalance") {
      data = await this.stripeApi.getBalance(credentials);
    } else if (name === "stripe.listPaymentIntents") {
      action = "stripe_payment_intent_list";
      await this.requireConnectorApproval(input, connection, action, "stripe");
      data = await this.stripeApi.listPaymentIntents(credentials, input.input);
    } else if (name === "stripe.getPaymentIntent") {
      action = "stripe_payment_intent_get";
      await this.requireConnectorApproval(input, connection, action, "stripe");
      data = await this.stripeApi.getPaymentIntent(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.stripe.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        livemode: credentials.livemode,
        paymentIntentIdHash: this.stringOrNull(input.input.paymentIntentId)
          ? this.hash(this.stringOrNull(input.input.paymentIntentId)!)
          : null,
      },
    });
    return this.ok(data, `Stripe ${name.split(".")[1]} completed.`);
  },

  async executeWave(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "wave",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.waveCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("wave", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "wave.getConnectedBusiness") {
      data = await this.waveApi.getConnectedBusiness(credentials);
    } else if (name === "wave.listInvoices") {
      action = "wave_invoice_list";
      await this.requireConnectorApproval(input, connection, action, "wave");
      data = await this.waveApi.listInvoices(credentials, input.input);
    } else if (name === "wave.getInvoice") {
      action = "wave_invoice_get";
      await this.requireConnectorApproval(input, connection, action, "wave");
      data = await this.waveApi.getInvoice(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.wave.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        businessIdHash: this.hash(credentials.businessId),
        invoiceIdHash: this.stringOrNull(input.input.invoiceId)
          ? this.hash(this.stringOrNull(input.input.invoiceId)!)
          : null,
        page: input.input.page ?? null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Wave ${name.split(".")[1]} completed.`);
  },

  async executeWooCommerce(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "woocommerce",
      input.connectionId,
    );
    const credentials = this.wooCommerceCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("woocommerce", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "woocommerce.listProducts")
      data = await this.wooCommerceApi.listProducts(credentials, input.input);
    else if (name === "woocommerce.getProduct")
      data = await this.wooCommerceApi.getProduct(credentials, input.input);
    else if (name === "woocommerce.listCategories")
      data = await this.wooCommerceApi.listCategories(credentials);
    else if (name === "woocommerce.prepareProductChange")
      data = this.wooCommerceApi.prepareProductChange(credentials, input.input);
    else if (name === "woocommerce.createDraftProduct") {
      action = "woocommerce_product_create_draft";
      await this.requireWooCommerceApproval(input, connection, action);
      data = await this.wooCommerceApi.createDraftProduct(
        credentials,
        input.input,
      );
    } else if (name === "woocommerce.updateDraftProduct") {
      action = "woocommerce_product_update_draft";
      await this.requireWooCommerceApproval(input, connection, action);
      data = await this.wooCommerceApi.updateDraftProduct(
        credentials,
        input.input,
      );
    } else if (name === "woocommerce.publishProduct") {
      action = "woocommerce_product_publish";
      await this.requireWooCommerceApproval(input, connection, action);
      data = await this.wooCommerceApi.publishProduct(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );

    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.woocommerce.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        storeOriginHash: this.hash(credentials.storeOrigin),
        productId: this.stringOrNull(input.input.productId),
        expectedDateModifiedGMT: this.stringOrNull(
          input.input.expectedDateModifiedGMT,
        ),
        ...(tool.action === "write"
          ? {
              idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
              resultHash: this.hash(JSON.stringify(data)),
            }
          : {}),
      },
    });
    return this.ok(data, `WooCommerce ${name.split(".")[1]} completed.`);
  },

  async executeWordPressWooCommerceSelfHosted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "wordpress-woocommerce-self-hosted",
      input.connectionId,
    );
    const credentials = this.wordpressWooCommerceSelfHostedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "wordpress-woocommerce-self-hosted",
      input.toolName,
    )!;
    if (
      tool.name !==
      "wordpress-woocommerce-self-hosted.getSelectedProductAvailability"
    )
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.wordpressWooCommerceSelfHostedApi.getSelectedProductAvailability(
        credentials,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.wordpress-woocommerce-self-hosted.getSelectedProductAvailability.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        publicStoreApiOnly: true,
        selectedProductBound: true,
        contentPricingAndPrivateStoreDataExcluded: true,
        cartOrderAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(
      data,
      "WordPress WooCommerce Self-Hosted getSelectedProductAvailability completed.",
    );
  },

  async executeXero(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "xero",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.xeroCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("xero", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string | null = null;
    if (name === "xero.getOrganisation") {
      data = await this.xeroApi.getOrganisation(credentials);
    } else if (name === "xero.listInvoices") {
      action = "xero_invoice_list";
      await this.requireConnectorApproval(input, connection, action, "xero");
      data = await this.xeroApi.listInvoices(credentials, input.input);
    } else if (name === "xero.getInvoice") {
      action = "xero_invoice_get";
      await this.requireConnectorApproval(input, connection, action, "xero");
      data = await this.xeroApi.getInvoice(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.xero.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        tenantIdHash: this.hash(credentials.tenantId),
        invoiceIdHash: this.stringOrNull(input.input.invoiceId)
          ? this.hash(this.stringOrNull(input.input.invoiceId)!)
          : null,
        page: input.input.page ?? null,
        limit: input.input.limit ?? null,
        status: input.input.status ?? null,
      },
    });
    return this.ok(data, `Xero ${name.split(".")[1]} completed.`);
  },

  async executeZohoBooks(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho-books",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zohoBooksCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("zoho-books", input.toolName)!;
    if (tool.name !== "zohoBooks.getOrganization")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "zoho_books_organization_get";
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "zoho-books",
    );
    const data = await this.zohoBooksApi.getOrganization(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.zoho-books.getOrganization.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        organizationIdHash: this.hash(credentials.organizationId),
        region: connection.metadata?.zohoRegion,
      },
    });
    return this.ok(data, "Zoho Books getOrganization completed.");
  },

  async executeZohoExpense(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho-expense",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zohoExpenseCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("zoho-expense", input.toolName)!;
    if (tool.name !== "zohoExpense.getOrganization")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "zoho_expense_organization_get";
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "zoho-expense",
    );
    const data = await this.zohoExpenseApi.getOrganization(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.zoho-expense.getOrganization.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        organizationIdHash: this.hash(credentials.organizationId),
        region: connection.metadata?.zohoRegion,
      },
    });
    return this.ok(data, "Zoho Expense getOrganization completed.");
  },
};

export const CommercePaymentsExecutors1Registrations = {
  binance: { methodName: "executeBinance", needsConnection: false },
  firstpromoter: { methodName: "executeFirstPromoter", needsConnection: false },
  freeagent: { methodName: "executeFreeAgent", needsConnection: false },
  freshbooks: { methodName: "executeFreshBooks", needsConnection: false },
  gemini: { methodName: "executeGemini", needsConnection: false },
  "google-merchant-center": {
    methodName: "executeGoogleMerchantCenter",
    needsConnection: false,
  },
  kashflow: { methodName: "executeKashFlow", needsConnection: false },
  kraken: { methodName: "executeKraken", needsConnection: false },
  "magento-self-hosted": {
    methodName: "executeMagentoSelfHosted",
    needsConnection: false,
  },
  "microsoft-dynamics-365-business-central": {
    methodName: "executeMicrosoftDynamics365BusinessCentral",
    needsConnection: false,
  },
  myob: { methodName: "executeMyob", needsConnection: false },
  netsuite: { methodName: "executeNetSuite", needsConnection: false },
  paypal: { methodName: "executePayPal", needsConnection: false },
  "prestashop-self-hosted": {
    methodName: "executePrestaShopSelfHosted",
    needsConnection: false,
  },
  quickbooks: { methodName: "executeQuickBooks", needsConnection: false },
  rewardful: { methodName: "executeRewardful", needsConnection: false },
  "sage-accounting": {
    methodName: "executeSageAccounting",
    needsConnection: false,
  },
  "sage-intacct": { methodName: "executeSageIntacct", needsConnection: false },
  "salesforce-commerce-cloud": {
    methodName: "executeSalesforceCommerceCloud",
    needsConnection: false,
  },
  shopify: { methodName: "executeShopify", needsConnection: false },
  stripe: { methodName: "executeStripe", needsConnection: false },
  wave: { methodName: "executeWave", needsConnection: false },
  woocommerce: { methodName: "executeWooCommerce", needsConnection: false },
  "wordpress-woocommerce-self-hosted": {
    methodName: "executeWordPressWooCommerceSelfHosted",
    needsConnection: false,
  },
  xero: { methodName: "executeXero", needsConnection: false },
  "zoho-books": { methodName: "executeZohoBooks", needsConnection: false },
  "zoho-expense": { methodName: "executeZohoExpense", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof CommercePaymentsExecutors1>;
