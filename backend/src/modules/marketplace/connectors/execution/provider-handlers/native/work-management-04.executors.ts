import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const WorkManagementExecutors4 = {
  async executeReplicon(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "replicon",
      input.connectionId,
    );
    const credentials = this.repliconCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("replicon", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "replicon.read") {
      data = await this.repliconApi.read(
        credentials,
        operation,
        operationInput,
      );
    } else if (tool.name === "replicon.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "replicon_manage",
        "replicon",
      );
      data = await this.repliconApi.manage(
        credentials,
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
      eventType: `marketplace.replicon.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Replicon ${tool.name.split(".")[1]} completed.`);
  },

  async executeRescueTime(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "rescuetime",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("rescuetime", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "rescuetime.read") {
      data = await this.rescueTimeApi.read(
        token.accessToken,
        operation,
        operationInput,
      );
    } else if (tool.name === "rescuetime.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "rescuetime_manage",
        "rescuetime",
      );
      data = await this.rescueTimeApi.manage(
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
      eventType: `marketplace.rescuetime.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `RescueTime ${tool.name.split(".")[1]} completed.`);
  },

  async executeResourceGuru(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "resource-guru",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("resource-guru", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "resource-guru.read") {
      data = await this.resourceGuruApi.read(
        token.accessToken,
        operation,
        operationInput,
      );
    } else if (tool.name === "resource-guru.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "resource_guru_manage",
        "resource-guru",
      );
      data = await this.resourceGuruApi.manage(
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
      eventType: `marketplace.resource-guru.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Resource Guru ${tool.name.split(".")[1]} completed.`);
  },

  async executeRespondent(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "respondent",
      input.connectionId,
    );
    const credentials = this.respondentCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("respondent", input.toolName)!;
    if (tool.name !== "respondent.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.respondentApi.read(credentials, operation, {
      page: input.input.page,
      limit: input.input.limit,
      query: input.input.query,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.respondent.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Respondent taxonomy read completed.");
  },

  async executeRoadmunk(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "roadmunk",
      input.connectionId,
    );
    const credentials = this.roadmunkCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("roadmunk", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "roadmunk.query")
      data = await this.roadmunkGraphql.query(credentials, input.input);
    else if (name === "roadmunk.mutate") {
      await this.requireConnectorApproval(
        input,
        connection,
        "graphql_mutation",
        "roadmunk",
      );
      data = await this.roadmunkGraphql.mutate(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.roadmunk.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        operationName: this.stringOrNull(input.input.operationName),
        region: credentials.region,
      },
    });
    return this.ok(data, `Strategic Roadmaps ${name.split(".")[1]} completed.`);
  },

  async executeRunn(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "runn",
      input.connectionId,
    );
    const credentials = this.runnCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("runn", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "runn.read") {
      data = await this.runnApi.read(credentials, operation, operationInput);
    } else if (tool.name === "runn.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "runn_manage",
        "runn",
      );
      data = await this.runnApi.manage(credentials, operation, operationInput);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.runn.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Runn ${tool.name.split(".")[1]} completed.`);
  },

  async executeSavvyCal(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "savvycal",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("savvycal", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "savvycal.read") {
      data = await this.savvyCalApi.read(token.accessToken, input.input);
    } else if (name === "savvycal.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "savvycal_api_manage",
        "savvycal",
      );
      data = await this.savvyCalApi.manage(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.savvycal.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "savvycal.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `SavvyCal ${name.split(".")[1]} completed.`);
  },

  async executeScoro(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "scoro",
      input.connectionId,
    );
    const credentials = this.scoroCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("scoro", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "scoro.getBusinessEntity") {
      action = "scoro_business_entity_get";
      await this.requireConnectorApproval(input, connection, action, "scoro");
      data = await this.scoroApi.getBusinessEntity(credentials);
    } else if (name === "scoro.listProjects") {
      action = "scoro_project_list";
      await this.requireConnectorApproval(input, connection, action, "scoro");
      data = await this.scoroApi.listProjects(credentials, input.input);
    } else if (name === "scoro.getProject") {
      action = "scoro_project_get";
      await this.requireConnectorApproval(input, connection, action, "scoro");
      data = await this.scoroApi.getProject(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.scoro.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        siteHash: this.hash(credentials.site),
        companyAccountIdHash: this.hash(credentials.companyAccountId),
        projectIdHash: this.stringOrNull(input.input.projectId)
          ? this.hash(this.stringOrNull(input.input.projectId)!)
          : typeof input.input.projectId === "number"
            ? this.hash(String(input.input.projectId))
            : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Scoro ${name.split(".")[1]} completed.`);
  },

  async executeSetmore(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "setmore",
      input.connectionId,
    );
    const credentials = this.setmoreCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("setmore", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "setmore.read") {
      data = await this.setmoreApi.read(credentials, input.input);
    } else if (name === "setmore.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "setmore_api_manage",
        "setmore",
      );
      data = await this.setmoreApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.setmore.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          this.stringOrNull(input.input.method) ??
          (name === "setmore.read" ? "GET" : null),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Setmore ${name.split(".")[1]} completed.`);
  },

  async executeShortcut(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "shortcut",
      input.connectionId,
    );
    const credentials = this.shortcutCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("shortcut", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "shortcut.read") {
      data = await this.shortcutApi.read(credentials, input.input);
    } else if (name === "shortcut.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "api_write",
        "shortcut",
      );
      data = await this.shortcutApi.write(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.shortcut.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "shortcut.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Shortcut ${name.split(".")[1]} completed.`);
  },

  async executeSimplyBookMe(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "simplybook-me",
      input.connectionId,
    );
    const credentials = this.simplyBookMeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("simplybook-me", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "simplybook-me.public-read")
      data = await this.simplyBookMeApi.publicRead(credentials, input.input);
    else if (name === "simplybook-me.admin-read")
      data = await this.simplyBookMeApi.adminRead(credentials, input.input);
    else if (
      name === "simplybook-me.public-manage" ||
      name === "simplybook-me.admin-manage"
    ) {
      await this.requireConnectorApproval(
        input,
        connection,
        "simplybook_me_api_manage",
        "simplybook-me",
      );
      data =
        name === "simplybook-me.public-manage"
          ? await this.simplyBookMeApi.publicManage(credentials, input.input)
          : await this.simplyBookMeApi.adminManage(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.simplybook_me.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method: this.stringOrNull(input.input.method),
      },
    });
    return this.ok(data, `SimplyBook.me ${name.split(".")[1]} completed.`);
  },

  async executeSlackLists(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "slack-lists",
      input.connectionId,
    );
    const credentials = this.slackListsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("slack-lists", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "slackLists.listItems")
      data = await this.slackListsApi.listItems(credentials, input.input);
    else if (name === "slackLists.draftTextItem")
      data = this.slackListsApi.draftTextItem(input.input);
    else if (name === "slackLists.createTodoList") {
      await this.requireConnectorApproval(
        input,
        connection,
        "list_write",
        "slack-lists",
      );
      data = await this.slackListsApi.createTodoList(credentials, input.input);
    } else if (name === "slackLists.createTextItem") {
      await this.requireConnectorApproval(
        input,
        connection,
        "list_write",
        "slack-lists",
      );
      data = await this.slackListsApi.createTextItem(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.slack-lists.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        listId: this.stringOrNull(input.input.listId),
        columnId: this.stringOrNull(input.input.columnId),
        providerSideEffect: ![
          "slackLists.listItems",
          "slackLists.draftTextItem",
        ].includes(name),
      },
    });
    return this.ok(data, `Slack Lists ${name.split(".")[1]} completed.`);
  },

  async executeSmartsheet(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "smartsheet",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.smartsheetCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("smartsheet", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "smartsheet.listSheets") {
      action = "smartsheet_sheet_list";
      data = await this.smartsheetApi.listSheets(credentials, input.input);
    } else if (name === "smartsheet.getSheet") {
      action = "smartsheet_sheet_get";
      data = await this.smartsheetApi.getSheet(
        credentials,
        input.input as { sheetId: string; limit?: number },
      );
    } else if (name === "smartsheet.getRow") {
      action = "smartsheet_row_get";
      data = await this.smartsheetApi.getRow(
        credentials,
        input.input as { sheetId: string; rowId: string },
      );
    } else if (name === "smartsheet.request") {
      action = "smartsheet_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "smartsheet",
      );
      data = await this.smartsheetApi.request(credentials, {
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
      eventType: `marketplace.smartsheet.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        sheetIdHash: this.stringOrNull(input.input.sheetId)
          ? this.hash(this.stringOrNull(input.input.sheetId)!)
          : null,
        rowIdHash: this.stringOrNull(input.input.rowId)
          ? this.hash(this.stringOrNull(input.input.rowId)!)
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Smartsheet ${name.split(".")[1]} completed.`);
  },

  async executeSprig(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sprig",
      input.connectionId,
    );
    const credentials = this.sprigCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sprig", input.toolName)!;
    if (tool.name !== "sprig.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.sprigApi.read(credentials, operation, {
      limit: input.input.limit,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.sprig.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Sprig study metadata read completed.");
  },

  async executeSquareAppointments(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "square-appointments",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("square-appointments", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "square-appointments.read") {
      data = await this.squareAppointmentsApi.read(
        token.accessToken,
        input.input,
      );
    } else if (name === "square-appointments.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "square_appointments_api_manage",
        "square-appointments",
      );
      data = await this.squareAppointmentsApi.manage(
        token.accessToken,
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
      eventType: `marketplace.square_appointments.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          this.stringOrNull(input.input.method) ??
          (name === "square-appointments.read" ? "GET" : null),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(
      data,
      `Square Appointments ${name.split(".")[1]} completed.`,
    );
  },

  async executeStatuspageCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "statuspage-cloud",
      input.connectionId,
    );
    const credentials = this.statuspageCloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("statuspage-cloud", input.toolName)!;
    let data: unknown;
    if (tool.name === "statuspageCloud.listComponents")
      data = await this.statuspageCloudApi.listComponents(credentials);
    else if (tool.name === "statuspageCloud.listIncidents")
      data = await this.statuspageCloudApi.listIncidents(credentials);
    else if (tool.name === "statuspageCloud.updateComponentStatus") {
      await this.requireConnectorApproval(
        input,
        connection,
        "component_status_write",
        "statuspage-cloud",
      );
      data = await this.statuspageCloudApi.updateComponentStatus(
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
      eventType: `marketplace.statuspage-cloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        pageId: credentials.pageId,
      },
    });
    return this.ok(
      data,
      `Statuspage Cloud ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeStructureForJira(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "structure-for-jira",
      input.connectionId,
    );
    const credentials = this.structureForJiraCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("structure-for-jira", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "structure-for-jira",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "structureForJira.listStructures")
      data = await this.structureForJiraApi.listStructures(
        credentials,
        payload,
      );
    else if (tool.name === "structureForJira.getStructure")
      data = await this.structureForJiraApi.getStructure(credentials, payload);
    else if (tool.name === "structureForJira.createPrivateStructure")
      data = await this.structureForJiraApi.createPrivateStructure(
        credentials,
        payload,
      );
    else if (tool.name === "structureForJira.listViews")
      data = await this.structureForJiraApi.listViews(credentials, payload);
    else if (tool.name === "structureForJira.getView")
      data = await this.structureForJiraApi.getView(credentials, payload);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.structure_for_jira.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        region: credentials.region,
        structureIdHash: input.input.structureId
          ? this.hash(String(input.input.structureId))
          : null,
        viewIdHash: input.input.viewId
          ? this.hash(String(input.input.viewId))
          : null,
        limit: input.input.limit ?? null,
        namesLogged: false,
        descriptionsLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(
      data,
      `Structure for Jira ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeSunsama(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sunsama",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("sunsama", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "sunsama.read") {
      data = await this.sunsamaMcp.callRead(token.accessToken, input.input);
    } else if (name === "sunsama.tasksForDay") {
      data = await this.sunsamaMcp.readTasksForDay(
        token.accessToken,
        input.input,
      );
    } else if (name === "sunsama.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "sunsama_mcp_manage",
        "sunsama",
      );
      data = await this.sunsamaMcp.callManage(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.sunsama.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method: "MCP",
        providerTool: this.stringOrNull(input.input.toolName),
        resourceDate: this.stringOrNull(input.input.date),
      },
    });
    return this.ok(data, `Sunsama ${name.split(".")[1]} completed.`);
  },

  async executeSurveyMonkey(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "surveymonkey",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.surveyMonkeyCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("surveymonkey", input.toolName)!;
    let data: unknown;
    if (tool.name === "surveymonkey.listRecentSurveys") {
      data = await this.surveyMonkeyApi.listRecentSurveys(credentials);
    } else if (tool.name === "surveymonkey.listResponses") {
      data = await this.surveyMonkeyApi.listResponses(credentials, input.input);
    } else if (tool.name === "surveymonkey.getResponse") {
      data = await this.surveyMonkeyApi.getResponse(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.surveymonkey.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        userIdHash: this.hash(credentials.userId),
        surveyIdHash: this.stringOrNull(input.input.surveyId)
          ? this.hash(this.stringOrNull(input.input.surveyId)!)
          : null,
        responseIdHash: this.stringOrNull(input.input.responseId)
          ? this.hash(this.stringOrNull(input.input.responseId)!)
          : null,
      },
    });
    return this.ok(data, `SurveyMonkey ${tool.name.split(".")[1]} completed.`);
  },

  async executeTally(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "tally",
      input.connectionId,
    );
    const credentials = this.tallyCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("tally", input.toolName)!;
    let data: unknown;
    if (tool.name === "tally.listForms") {
      data = await this.tallyApi.listForms(credentials);
    } else if (tool.name === "tally.getForm") {
      data = await this.tallyApi.getForm(credentials, input.input);
    } else if (tool.name === "tally.listSubmissions") {
      data = await this.tallyApi.listSubmissions(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.tally.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        formIdHash: this.stringOrNull(input.input.formId)
          ? this.hash(this.stringOrNull(input.input.formId)!)
          : null,
      },
    });
    return this.ok(data, `Tally ${tool.name.split(".")[1]} completed.`);
  },

  async executeTeamwork(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "teamwork",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.teamworkCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("teamwork", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "teamwork.listProjects") {
      action = "teamwork_project_list";
      data = await this.teamworkApi.listProjects(credentials, input.input);
    } else if (name === "teamwork.listTasks") {
      action = "teamwork_task_list";
      data = await this.teamworkApi.listTasks(credentials, input.input);
    } else if (name === "teamwork.getTask") {
      action = "teamwork_task_get";
      data = await this.teamworkApi.getTask(
        credentials,
        input.input as { taskId: string },
      );
    } else if (name === "teamwork.request") {
      action = "teamwork_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "teamwork",
      );
      data = await this.teamworkApi.request(credentials, {
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
      eventType: `marketplace.teamwork.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        installationIdHash: this.hash(credentials.installationId),
        taskIdHash: this.stringOrNull(input.input.taskId)
          ? this.hash(this.stringOrNull(input.input.taskId)!)
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Teamwork ${name.split(".")[1]} completed.`);
  },

  async executeTempoTimesheets(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "tempo-timesheets",
      input.connectionId,
    );
    const credentials = this.tempoTimesheetsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("tempo-timesheets", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "tempoTimesheets.listWorklogs") {
      action = "tempo_timesheets_worklog_list";
      data = await this.tempoTimesheetsApi.listWorklogs(credentials, {
        from: this.requiredString(input.input.from, "from"),
        to: this.requiredString(input.input.to, "to"),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "tempoTimesheets.getWorklog") {
      action = "tempo_timesheets_worklog_get";
      data = await this.tempoTimesheetsApi.getWorklog(
        credentials,
        this.requiredString(input.input.worklogId, "worklogId"),
      );
    } else if (name === "tempoTimesheets.listAccounts") {
      action = "tempo_timesheets_account_list";
      data = await this.tempoTimesheetsApi.listAccounts(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "tempoPlanner.searchPlans") {
      action = "tempo_planner_plan_search";
      data = await this.tempoTimesheetsApi.searchPlans(credentials, {
        from: this.requiredString(input.input.from, "from"),
        to: this.requiredString(input.input.to, "to"),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "tempoTimesheets.request") {
      action = "tempo_timesheets_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "tempo-timesheets",
      );
      data = await this.tempoTimesheetsApi.request(credentials, {
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
      eventType: `marketplace.tempo-timesheets.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        siteHostHash: this.hash(new URL(credentials.jiraSiteUrl).hostname),
        worklogIdHash: this.stringOrNull(input.input.worklogId)
          ? this.hash(this.stringOrNull(input.input.worklogId)!)
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Tempo Timesheets ${name.split(".")[1]} completed.`);
  },

  async executeTermly(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "termly",
      input.connectionId,
    );
    const credentials = this.termlyCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("termly", input.toolName)!;
    let data: unknown;
    if (tool.name === "termly.getWebsiteSummary")
      data = await this.termlyApi.getWebsiteSummary(credentials);
    else if (tool.name === "termly.getBannerSummary")
      data = await this.termlyApi.getBannerSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.termly.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedWebsiteBound: true,
      },
    });
    return this.ok(data, `Termly ${tool.name.split(".")[1]} completed.`);
  },

  async executeTickTick(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ticktick",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.ticktickCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("ticktick", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "ticktick.listProjects") {
      action = "ticktick_project_list";
      data = await this.ticktickApi.listProjects(credentials, input.input);
    } else if (name === "ticktick.getProjectData") {
      action = "ticktick_project_data_get";
      data = await this.ticktickApi.getProjectData(credentials, {
        projectId: this.requiredString(input.input.projectId, "projectId"),
        taskLimit:
          typeof input.input.taskLimit === "number"
            ? input.input.taskLimit
            : undefined,
      });
    } else if (name === "ticktick.getTask") {
      action = "ticktick_task_get";
      data = await this.ticktickApi.getTask(credentials, {
        projectId: this.requiredString(input.input.projectId, "projectId"),
        taskId: this.requiredString(input.input.taskId, "taskId"),
      });
    } else if (name === "ticktick.request") {
      action = "ticktick_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "ticktick",
      );
      data = await this.ticktickApi.request(credentials, {
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
      eventType: `marketplace.ticktick.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        projectIdHash: this.stringOrNull(input.input.projectId)
          ? this.hash(this.stringOrNull(input.input.projectId)!)
          : null,
        taskIdHash: this.stringOrNull(input.input.taskId)
          ? this.hash(this.stringOrNull(input.input.taskId)!)
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? input.input.taskLimit ?? null,
      },
    });
    return this.ok(data, `TickTick ${name.split(".")[1]} completed.`);
  },

  async executeTimeDoctor(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "time-doctor",
      input.connectionId,
    );
    const credentials = this.timeDoctorCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("time-doctor", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "timeDoctor.read") {
      data = await this.timeDoctorApi.read(
        credentials,
        operation,
        operationInput,
      );
    } else if (tool.name === "timeDoctor.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "time_doctor_manage",
        "time-doctor",
      );
      data = await this.timeDoctorApi.manage(
        credentials,
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
      eventType: `marketplace.time-doctor.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Time Doctor ${tool.name.split(".")[1]} completed.`);
  },

  async executeTimelyTimeTracking(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "timely-time-tracking",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("timely-time-tracking", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "timely-time-tracking.read") {
      data = await this.timelyTimeTrackingApi.read(
        token.accessToken,
        operation,
        operationInput,
      );
    } else if (tool.name === "timely-time-tracking.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "timely_time_tracking_manage",
        "timely-time-tracking",
      );
      data = await this.timelyTimeTrackingApi.manage(
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
      eventType: `marketplace.timely-time-tracking.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Timely ${tool.name.split(".")[1]} completed.`);
  },

  async executeTodoist(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "todoist",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.todoistCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("todoist", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "todoist.listProjects") {
      action = "todoist_project_list";
      data = await this.todoistApi.listProjects(credentials, input.input);
    } else if (name === "todoist.listTasks") {
      action = "todoist_task_list";
      data = await this.todoistApi.listTasks(credentials, input.input);
    } else if (name === "todoist.getTask") {
      action = "todoist_task_get";
      data = await this.todoistApi.getTask(credentials, {
        taskId: this.requiredString(input.input.taskId, "taskId"),
      });
    } else if (name === "todoist.request") {
      action = "todoist_full_api";
      await this.requireConnectorApproval(input, connection, action, "todoist");
      data = await this.todoistApi.request(credentials, {
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
      eventType: `marketplace.todoist.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        userIdHash: this.hash(credentials.userId),
        taskIdHash: this.stringOrNull(input.input.taskId)
          ? this.hash(this.stringOrNull(input.input.taskId)!)
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Todoist ${name.split(".")[1]} completed.`);
  },

  async executeTogglTrack(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "toggl-track",
      input.connectionId,
    );
    const credentials = this.togglTrackCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("toggl-track", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "togglTrack.getProfile") {
      action = "toggl_track_profile_get";
      data = await this.togglTrackApi.getProfile(credentials);
    } else if (name === "togglTrack.listWorkspaces") {
      action = "toggl_track_workspace_list";
      data = await this.togglTrackApi.listWorkspaces(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "togglTrack.listProjects") {
      action = "toggl_track_project_list";
      data = await this.togglTrackApi.listProjects(credentials, {
        workspaceId: this.positiveInteger(
          input.input.workspaceId,
          "workspaceId",
        ),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "togglTrack.listTimeEntries") {
      action = "toggl_track_time_entry_list";
      data = await this.togglTrackApi.listTimeEntries(credentials, {
        startDate: this.requiredString(input.input.startDate, "startDate"),
        endDate: this.requiredString(input.input.endDate, "endDate"),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "togglTrack.request") {
      action = "toggl_track_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "toggl-track",
      );
      data = await this.togglTrackApi.request(credentials, {
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
      eventType: `marketplace.toggl_track.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        workspaceIdHash: input.input.workspaceId
          ? this.hash(String(input.input.workspaceId))
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Toggl Track ${name.split(".")[1]} completed.`);
  },
};

export const WorkManagementExecutors4Registrations = {
  replicon: { methodName: "executeReplicon", needsConnection: false },
  rescuetime: { methodName: "executeRescueTime", needsConnection: false },
  "resource-guru": {
    methodName: "executeResourceGuru",
    needsConnection: false,
  },
  respondent: { methodName: "executeRespondent", needsConnection: false },
  roadmunk: { methodName: "executeRoadmunk", needsConnection: false },
  runn: { methodName: "executeRunn", needsConnection: false },
  savvycal: { methodName: "executeSavvyCal", needsConnection: false },
  scoro: { methodName: "executeScoro", needsConnection: false },
  setmore: { methodName: "executeSetmore", needsConnection: false },
  shortcut: { methodName: "executeShortcut", needsConnection: false },
  "simplybook-me": {
    methodName: "executeSimplyBookMe",
    needsConnection: false,
  },
  "slack-lists": { methodName: "executeSlackLists", needsConnection: false },
  smartsheet: { methodName: "executeSmartsheet", needsConnection: false },
  sprig: { methodName: "executeSprig", needsConnection: false },
  "square-appointments": {
    methodName: "executeSquareAppointments",
    needsConnection: false,
  },
  "statuspage-cloud": {
    methodName: "executeStatuspageCloud",
    needsConnection: false,
  },
  "structure-for-jira": {
    methodName: "executeStructureForJira",
    needsConnection: false,
  },
  sunsama: { methodName: "executeSunsama", needsConnection: false },
  surveymonkey: { methodName: "executeSurveyMonkey", needsConnection: false },
  tally: { methodName: "executeTally", needsConnection: false },
  teamwork: { methodName: "executeTeamwork", needsConnection: false },
  "tempo-timesheets": {
    methodName: "executeTempoTimesheets",
    needsConnection: false,
  },
  termly: { methodName: "executeTermly", needsConnection: false },
  ticktick: { methodName: "executeTickTick", needsConnection: false },
  "time-doctor": { methodName: "executeTimeDoctor", needsConnection: false },
  "timely-time-tracking": {
    methodName: "executeTimelyTimeTracking",
    needsConnection: false,
  },
  todoist: { methodName: "executeTodoist", needsConnection: false },
  "toggl-track": { methodName: "executeTogglTrack", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof WorkManagementExecutors4>;
