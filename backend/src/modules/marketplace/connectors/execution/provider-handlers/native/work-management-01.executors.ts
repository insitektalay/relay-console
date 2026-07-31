import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const WorkManagementExecutors1 = {
  async executeSevenShifts(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "7shifts",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.sevenShiftsCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("7shifts", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "7shifts.read") {
      data = await this.sevenShiftsApi.read(
        credentials,
        operation,
        operationInput,
      );
    } else if (tool.name === "7shifts.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "seven_shifts_manage",
        "7shifts",
      );
      data = await this.sevenShiftsApi.manage(
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
      eventType: `marketplace.7shifts.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `7shifts ${tool.name.split(".")[1]} completed.`);
  },

  async executeAccelo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "accelo",
      input.connectionId,
    );
    const credentials = this.acceloCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("accelo", input.toolName)!;
    if (tool.name !== "accelo.getSelectedProjectState")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.acceloApi.getSelectedProjectState(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.accelo.getSelectedProjectState.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        customerOwnedServiceApplicationRequired: true,
        deploymentAndSelectedProjectBound: true,
        exactReadJobsScopeRequired: true,
        fixedIndividualProjectRouteOnly: true,
        contentClientsPeopleFinancialsAndOtherDeploymentDataDiscarded: true,
        otherReadsAdministrationAndMutationsBlocked: true,
        credentialsLogged: false,
      },
    });
    return this.ok(data, "Accelo selected project state read completed.");
  },

  async executeActiTime(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "actitime",
      input.connectionId,
    );
    const credentials = this.actiTimeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("actitime", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: input.input.json,
    };
    let data: unknown;
    if (tool.name === "actiTime.read") {
      data = await this.actiTimeApi.read(
        credentials,
        operation,
        operationInput,
      );
    } else if (tool.name === "actiTime.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "actitime_manage",
        "actitime",
      );
      data = await this.actiTimeApi.manage(
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
      eventType: `marketplace.actitime.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `actiTIME ${tool.name.split(".")[1]} completed.`);
  },

  async executeAcuityScheduling(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "acuity-scheduling",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("acuity-scheduling", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "acuity-scheduling.read") {
      data = await this.acuitySchedulingApi.read(
        token.accessToken,
        input.input,
      );
    } else if (name === "acuity-scheduling.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "acuity_scheduling_api_manage",
        "acuity-scheduling",
      );
      data = await this.acuitySchedulingApi.manage(
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
      eventType: `marketplace.acuity_scheduling.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "acuity-scheduling.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Acuity Scheduling ${name.split(".")[1]} completed.`);
  },

  async executeAha(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "aha",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const accountSubdomain = this.stringOrNull(
      connection.metadata?.ahaAccountSubdomain,
    );
    if (!accountSubdomain)
      return this.safeError(
        "connection_not_ready",
        "Aha! connection is not bound to one account.",
      );
    const tool = this.registry.getTool("aha", input.toolName)!;
    let data: unknown;
    if (tool.name === "aha.read") {
      data = await this.ahaApi.read(
        token.accessToken,
        accountSubdomain,
        input.input,
      );
    } else if (tool.name === "aha.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "aha_manage",
        "aha",
      );
      data = await this.ahaApi.manage(
        token.accessToken,
        accountSubdomain,
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
      eventType: `marketplace.aha.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "aha.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        ahaAccountSubdomain: accountSubdomain,
      },
    });
    return this.ok(data, `Aha! ${tool.name.split(".")[1]} completed.`);
  },

  async executeAirfocus(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "airfocus",
      input.connectionId,
    );
    const credentials = this.airfocusCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("airfocus", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "airfocus",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "airfocus.listWorkspaces")
      data = await this.airfocusApi.listWorkspaces(credentials, payload);
    else if (tool.name === "airfocus.getWorkspace")
      data = await this.airfocusApi.getWorkspace(credentials, payload);
    else if (tool.name === "airfocus.listItems")
      data = await this.airfocusApi.listItems(credentials, payload);
    else if (tool.name === "airfocus.getItem")
      data = await this.airfocusApi.getItem(credentials, payload);
    else if (tool.name === "airfocus.createItem")
      data = await this.airfocusApi.createItem(credentials, payload);
    else if (tool.name === "airfocus.updateItem")
      data = await this.airfocusApi.updateItem(credentials, payload);
    else if (tool.name === "airfocus.deleteItem")
      data = await this.airfocusApi.deleteItem(credentials, payload);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.airfocus.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        workspaceIdHash: input.input.workspaceId
          ? this.hash(String(input.input.workspaceId))
          : null,
        itemIdHash: input.input.itemId
          ? this.hash(String(input.input.itemId))
          : null,
        limit: input.input.limit ?? null,
        namesLogged: false,
        descriptionsLogged: false,
        identitiesLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(data, `Airfocus ${tool.name.split(".")[1]} completed.`);
  },

  async executeAirtableForms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "airtable-forms",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("airtable-forms", input.toolName)!;
    if (tool.name !== "airtable-forms.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.airtableFormsApi.read(
      token.accessToken,
      operation,
      { baseId: input.input.baseId },
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.airtable_forms.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Airtable Forms metadata read completed.");
  },

  async executeAkiflow(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "akiflow",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("akiflow", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "akiflow.read") {
      data = await this.akiflowMcp.callRead(token.accessToken, input.input);
    } else if (name === "akiflow.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "akiflow_mcp_manage",
        "akiflow",
      );
      data = await this.akiflowMcp.callManage(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.akiflow.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method: "MCP",
        providerTool: this.stringOrNull(input.input.toolName),
      },
    });
    return this.ok(data, `Akiflow ${name.split(".")[1]} completed.`);
  },

  async executeAlchemer(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "alchemer",
      input.connectionId,
    );
    const credentials = this.alchemerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("alchemer", input.toolName)!;
    if (tool.name !== "alchemer.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.alchemerApi.read(credentials, operation, {
      surveyId: input.input.surveyId,
      responseId: input.input.responseId,
      page: input.input.page,
      limit: input.input.limit,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.alchemer.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Alchemer read completed.");
  },

  async executeAmazingMarvin(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "amazing-marvin",
      input.connectionId,
    );
    const credentials = this.amazingMarvinCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("amazing-marvin", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "amazing-marvin.read") {
      data = await this.amazingMarvinApi.read(credentials, input.input);
    } else if (name === "amazing-marvin.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "amazing_marvin_api_manage",
        "amazing-marvin",
      );
      data = await this.amazingMarvinApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.amazing_marvin.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method: name === "amazing-marvin.read" ? "GET" : "POST",
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Amazing Marvin ${name.split(".")[1]} completed.`);
  },

  async executeAnyDo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "any-do",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("any-do", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "any-do.read") {
      data = await this.anyDoMcp.callRead(token.accessToken, input.input);
    } else if (name === "any-do.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "any_do_mcp_manage",
        "any-do",
      );
      data = await this.anyDoMcp.callWrite(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.any_do.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Any.do ${name.split(".")[1]} completed.`);
  },

  async executeAsana(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "asana",
      input.connectionId,
    );
    const tool = this.registry.getTool("asana", input.toolName)!;
    if (tool.name === "relay_asana_draft_task_change") {
      const operation = this.requiredString(input.input.operation, "operation");
      if (!["create", "update"].includes(operation))
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "operation must be create or update",
        );
      const fields = input.input.fields;
      if (!fields || typeof fields !== "object" || Array.isArray(fields))
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "fields must be an object",
        );
      const taskGid = this.stringOrNull(input.input.taskGid);
      if (operation === "update" && !taskGid)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "taskGid is required for an update draft",
        );
      const encoded = JSON.stringify({ operation, taskGid, fields });
      if (encoded.length > 40_000)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "Asana task draft is too large",
        );
      return this.ok(
        {
          operation,
          taskGid,
          fields,
          payloadHash: this.hash(encoded),
          providerSideEffect: false,
        },
        "Asana task change prepared locally.",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_asana_search_tasks")
      return this.ok(
        await this.asanaApi.searchTasks(token.accessToken, input.input),
        "Asana tasks found.",
      );
    if (tool.name === "relay_asana_list_projects")
      return this.ok(
        await this.asanaApi.listProjects(token.accessToken, input.input),
        "Asana projects listed.",
      );
    if (tool.name === "relay_asana_get_task")
      return this.ok(
        await this.asanaApi.getTask(token.accessToken, input.input),
        "Asana task read.",
      );
    if (tool.name === "relay_asana_create_task") {
      const target =
        this.stringOrNull(input.input.projectGid) ??
        this.requiredString(input.input.workspaceGid, "workspaceGid");
      await this.requireAsanaApproval(
        input,
        connection,
        "asana_task_create",
        target,
        input.input,
      );
      const result = await this.asanaApi.createTask(
        token.accessToken,
        input.input,
      );
      await this.auditAsanaWrite(
        input,
        connection,
        "task.created",
        target,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Asana task created.");
    }
    if (tool.name === "relay_asana_update_task") {
      await this.requireAsanaApproval(
        input,
        connection,
        "asana_task_update",
        input.input.taskGid,
        input.input,
      );
      const result = await this.asanaApi.updateTask(
        token.accessToken,
        input.input,
      );
      await this.auditAsanaWrite(
        input,
        connection,
        "task.updated",
        input.input.taskGid,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Asana task updated.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeAskNicely(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "asknicely",
      input.connectionId,
    );
    const credentials = this.askNicelyCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("asknicely", input.toolName)!;
    if (tool.name !== "askNicely.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.askNicelyApi.read(credentials, operation, {
      page: input.input.page,
      limit: input.input.limit,
      since: input.input.since,
      days: input.input.days,
      year: input.input.year,
      month: input.input.month,
      day: input.input.day,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.asknicely.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "AskNicely read completed.");
  },

  async executeAtlassianRovo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "atlassian-rovo",
      input.connectionId,
    );
    const credentials = this.atlassianRovoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("atlassian-rovo", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "atlassianRovo.listTools")
      data = await this.atlassianRovoMcp.listTools(credentials);
    else if (name === "atlassianRovo.callReadTool")
      data = await this.atlassianRovoMcp.callReadTool(credentials, input.input);
    else if (name === "atlassianRovo.callTool") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_mcp",
        "atlassian-rovo",
      );
      data = await this.atlassianRovoMcp.callTool(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.atlassian-rovo.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        remoteToolName: this.stringOrNull(input.input.toolName),
      },
    });
    return this.ok(data, `Atlassian Rovo ${name.split(".")[1]} completed.`);
  },

  async executeAvaza(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "avaza",
      input.connectionId,
    );
    const credentials = this.avazaCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("avaza", input.toolName)!;
    if (tool.name !== "avaza.getSelectedProjectState")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.avazaApi.getSelectedProjectState(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.avaza.getSelectedProjectState.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        customerOwnedPersonalAccessTokenRequired: true,
        selectedProjectBound: true,
        exactReadProjectsScopeRequired: true,
        fixedIndividualProjectRouteOnly: true,
        contentCompaniesPeopleFinancialsAndOtherAccountDataDiscarded: true,
        otherReadsAdministrationAndMutationsBlocked: true,
        credentialsLogged: false,
      },
    });
    return this.ok(data, "Avaza selected project state read completed.");
  },

  async executeBasecamp(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "basecamp",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.basecampCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("basecamp", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "basecamp.listProjects") {
      action = "basecamp_project_list";
      data = await this.basecampApi.listProjects(credentials, input.input);
    } else if (name === "basecamp.getProject") {
      action = "basecamp_project_get";
      data = await this.basecampApi.getProject(
        credentials,
        input.input as { projectId: string },
      );
    } else if (name === "basecamp.getTodo") {
      action = "basecamp_todo_get";
      data = await this.basecampApi.getTodo(
        credentials,
        input.input as { todoId: string },
      );
    } else if (name === "basecamp.request") {
      action = "basecamp_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "basecamp",
      );
      data = await this.basecampApi.request(credentials, {
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
      eventType: `marketplace.basecamp.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        projectIdHash: this.stringOrNull(input.input.projectId)
          ? this.hash(this.stringOrNull(input.input.projectId)!)
          : null,
        todoIdHash: this.stringOrNull(input.input.todoId)
          ? this.hash(this.stringOrNull(input.input.todoId)!)
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Basecamp ${name.split(".")[1]} completed.`);
  },

  async executeBonsai(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "bonsai",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("bonsai", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "bonsai.read") {
      data = await this.bonsaiMcp.callRead(token.accessToken, input.input);
    } else if (name === "bonsai.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "bonsai_mcp_write",
        "bonsai",
      );
      data = await this.bonsaiMcp.callWrite(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.bonsai.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Bonsai ${name.split(".")[1]} completed.`);
  },

  async executeCalendly(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "calendly",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.calendlyCredentials(
      { accessToken: token.accessToken },
      connection,
    );
    const tool = this.registry.getTool("calendly", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "calendly.listEventTypes") {
      action = "calendly_event_type_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "calendly",
      );
      data = await this.calendlyApi.listEventTypes(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "calendly.listScheduledEvents") {
      action = "calendly_scheduled_event_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "calendly",
      );
      data = await this.calendlyApi.listScheduledEvents(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "calendly.getScheduledEvent") {
      action = "calendly_scheduled_event_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "calendly",
      );
      data = await this.calendlyApi.getScheduledEvent(credentials, {
        scheduledEventId: this.requiredString(
          input.input.scheduledEventId,
          "scheduledEventId",
        ),
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
      eventType: `marketplace.calendly.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        userUriHash: this.hash(credentials.userUri),
        organizationUriHash: this.hash(credentials.organizationUri),
        scheduledEventIdHash: this.stringOrNull(input.input.scheduledEventId)
          ? this.hash(this.stringOrNull(input.input.scheduledEventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Calendly ${name.split(".")[1]} completed.`);
  },

  async executeClickUp(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "clickup",
      input.connectionId,
    );
    const tool = this.registry.getTool("clickup", input.toolName)!;
    if (tool.name === "relay_clickup_draft_task_change") {
      const operation = this.requiredString(input.input.operation, "operation");
      if (!["create", "update", "comment"].includes(operation))
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "operation must be create, update, or comment",
        );
      const fields = input.input.fields;
      if (!fields || typeof fields !== "object" || Array.isArray(fields))
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "fields must be an object",
        );
      const taskId = this.stringOrNull(input.input.taskId);
      if (["update", "comment"].includes(operation) && !taskId)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "taskId is required for an update or comment draft",
        );
      const encoded = JSON.stringify({ operation, taskId, fields });
      if (encoded.length > 40_000)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "ClickUp task draft is too large",
        );
      return this.ok(
        {
          operation,
          taskId,
          fields,
          payloadHash: this.hash(encoded),
          providerSideEffect: false,
        },
        "ClickUp task change prepared locally.",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_clickup_list_workspaces")
      return this.ok(
        await this.clickUpApi.listWorkspaces(token.accessToken, input.input),
        "ClickUp Workspaces listed.",
      );
    if (tool.name === "relay_clickup_search_workspace_tasks")
      return this.ok(
        await this.clickUpApi.searchWorkspaceTasks(
          token.accessToken,
          input.input,
        ),
        "ClickUp Workspace tasks found.",
      );
    if (tool.name === "relay_clickup_list_tasks")
      return this.ok(
        await this.clickUpApi.listTasks(token.accessToken, input.input),
        "ClickUp List tasks listed.",
      );
    if (tool.name === "relay_clickup_get_task")
      return this.ok(
        await this.clickUpApi.getTask(token.accessToken, input.input),
        "ClickUp task read.",
      );
    if (tool.name === "relay_clickup_create_task") {
      await this.requireClickUpApproval(
        input,
        connection,
        "clickup_task_create",
        input.input.listId,
        input.input,
      );
      const result = await this.clickUpApi.createTask(
        token.accessToken,
        input.input,
      );
      await this.auditClickUpWrite(
        input,
        connection,
        "task.created",
        input.input.listId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved ClickUp task created.");
    }
    if (tool.name === "relay_clickup_update_task") {
      await this.requireClickUpApproval(
        input,
        connection,
        "clickup_task_update",
        input.input.taskId,
        input.input,
      );
      const result = await this.clickUpApi.updateTask(
        token.accessToken,
        input.input,
      );
      await this.auditClickUpWrite(
        input,
        connection,
        "task.updated",
        input.input.taskId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved ClickUp task updated.");
    }
    if (tool.name === "relay_clickup_add_comment") {
      await this.requireClickUpApproval(
        input,
        connection,
        "clickup_task_comment_create",
        input.input.taskId,
        input.input,
      );
      const result = await this.clickUpApi.addComment(
        token.accessToken,
        input.input,
      );
      await this.auditClickUpWrite(
        input,
        connection,
        "comment.created",
        input.input.taskId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved ClickUp comment added.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeCliniko(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "cliniko",
      input.connectionId,
    );
    const credentials = this.clinikoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("cliniko", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "cliniko.read") {
      data = await this.clinikoApi.read(credentials, input.input);
    } else if (name === "cliniko.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "cliniko_api_manage",
        "cliniko",
      );
      data = await this.clinikoApi.manage(credentials, input.input);
    } else if (name === "cliniko.upload_attachment") {
      await this.requireConnectorApproval(
        input,
        connection,
        "cliniko_attachment_upload",
        "cliniko",
      );
      data = await this.clinikoApi.uploadAttachment(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.cliniko.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          this.stringOrNull(input.input.method) ??
          (name === "cliniko.read"
            ? "GET"
            : name === "cliniko.upload_attachment"
              ? "WORKFLOW"
              : null),
        path:
          this.stringOrNull(input.input.path) ??
          (name === "cliniko.upload_attachment"
            ? "/patients/{id}/attachment_presigned_post -> /patient_attachments"
            : null),
      },
    });
    return this.ok(data, `Cliniko ${name.split(".")[1]} completed.`);
  },

  async executeClockify(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "clockify",
      input.connectionId,
    );
    const credentials = this.clockifyCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const tool = this.registry.getTool("clockify", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "clockify.getProfile") {
      action = "clockify_profile_get";
      data = await this.clockifyApi.getProfile(credentials);
    } else if (name === "clockify.listWorkspaces") {
      action = "clockify_workspace_list";
      data = await this.clockifyApi.listWorkspaces(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "clockify.listProjects") {
      action = "clockify_project_list";
      data = await this.clockifyApi.listProjects(credentials, {
        workspaceId: this.requiredString(
          input.input.workspaceId,
          "workspaceId",
        ),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "clockify.listTimeEntries") {
      action = "clockify_time_entry_list";
      data = await this.clockifyApi.listTimeEntries(credentials, {
        workspaceId: this.requiredString(
          input.input.workspaceId,
          "workspaceId",
        ),
        startDate: this.requiredString(input.input.startDate, "startDate"),
        endDate: this.requiredString(input.input.endDate, "endDate"),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "clockify.request") {
      action = "clockify_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "clockify",
      );
      data = await this.clockifyApi.request(credentials, {
        surface: this.requiredString(input.input.surface, "surface"),
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
      eventType: `marketplace.clockify.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        workspaceIdHash: this.stringOrNull(input.input.workspaceId)
          ? this.hash(this.stringOrNull(input.input.workspaceId)!)
          : null,
        surface: this.stringOrNull(input.input.surface),
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Clockify ${name.split(".")[1]} completed.`);
  },

  async executeCognitoForms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "cognito-forms",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("cognito-forms", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "cognitoForms.read") {
      data = await this.cognitoFormsMcp.callRead(
        token.accessToken,
        input.input,
      );
    } else if (name === "cognitoForms.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "entry_management",
        "cognito-forms",
      );
      data = await this.cognitoFormsMcp.callWrite(
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
      eventType: `marketplace.cognito_forms.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Cognito Forms ${name.split(".")[1]} completed.`);
  },

  async executeCookiebot(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "cookiebot",
      input.connectionId,
    );
    const credentials = this.cookiebotCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("cookiebot", input.toolName)!;
    let data: unknown;
    if (tool.name === "cookiebot.getRecentConsentSummary")
      data = await this.cookiebotApi.getRecentConsentSummary(credentials);
    else if (tool.name === "cookiebot.getCookieScanSummary")
      data = await this.cookiebotApi.getCookieScanSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.cookiebot.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedDomainBound: true,
      },
    });
    return this.ok(data, `Cookiebot ${tool.name.split(".")[1]} completed.`);
  },

  async executeCraftIo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "craft-io",
      input.connectionId,
    );
    const credentials = this.craftIoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("craft-io", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "craft-io",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "craftIo.listWorkspaces")
      data = await this.craftIoApi.listWorkspaces(credentials, payload);
    else if (tool.name === "craftIo.listItems")
      data = await this.craftIoApi.listItems(credentials, payload);
    else if (tool.name === "craftIo.getItem")
      data = await this.craftIoApi.getItem(credentials, payload);
    else if (tool.name === "craftIo.listFeedbackPortals")
      data = await this.craftIoApi.listFeedbackPortals(credentials, payload);
    else if (tool.name === "craftIo.listFeedbackCategories")
      data = await this.craftIoApi.listFeedbackCategories(credentials, payload);
    else if (tool.name === "craftIo.listFeedbackItems")
      data = await this.craftIoApi.listFeedbackItems(credentials, payload);
    else if (tool.name === "craftIo.getFeedbackItem")
      data = await this.craftIoApi.getFeedbackItem(credentials, payload);
    else if (tool.name === "craftIo.submitPlainFeedback")
      data = await this.craftIoApi.submitPlainFeedback(credentials, payload);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.craft_io.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        workspaceIdHash: input.input.workspaceId
          ? this.hash(String(input.input.workspaceId))
          : null,
        itemIdHash: input.input.itemId
          ? this.hash(String(input.input.itemId))
          : null,
        portalIdHash: input.input.portalId
          ? this.hash(String(input.input.portalId))
          : null,
        feedbackItemIdHash: input.input.feedbackItemId
          ? this.hash(String(input.input.feedbackItemId))
          : null,
        limit: input.input.limit ?? null,
        titlesLogged: false,
        descriptionsLogged: false,
        identitiesLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(data, `Craft.io ${tool.name.split(".")[1]} completed.`);
  },

  async executeDelighted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "delighted",
      input.connectionId,
    );
    const credentials = this.delightedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("delighted", input.toolName)!;
    if (tool.name !== "delighted.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.delightedApi.read(credentials, operation, {
      page: input.input.page,
      limit: input.input.limit,
      since: input.input.since,
      until: input.input.until,
      order: input.input.order,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.delighted.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Delighted read completed.");
  },

  async executeDeputy(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "deputy",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("deputy", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const apiOrigin = this.requiredString(
      connection.metadata?.deputyApiOrigin,
      "Deputy install authority",
    );
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      headers: this.objectOrNull(input.input.headers) ?? undefined,
      body: this.objectOrNull(input.input.body) ?? undefined,
      contentBase64: this.stringOrNull(input.input.contentBase64) ?? undefined,
      fileName: this.stringOrNull(input.input.fileName) ?? undefined,
      mimeType: this.stringOrNull(input.input.mimeType) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "deputy.read") {
      data = await this.deputyApi.read(
        token.accessToken,
        apiOrigin,
        operation,
        operationInput,
      );
    } else if (tool.name === "deputy.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "deputy_write",
        "deputy",
      );
      data = await this.deputyApi.manage(
        token.accessToken,
        apiOrigin,
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
      eventType: `marketplace.deputy.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Deputy ${tool.name.split(".")[1]} completed.`);
  },
};

export const WorkManagementExecutors1Registrations = {
  "7shifts": { methodName: "executeSevenShifts", needsConnection: false },
  accelo: { methodName: "executeAccelo", needsConnection: false },
  actitime: { methodName: "executeActiTime", needsConnection: false },
  "acuity-scheduling": {
    methodName: "executeAcuityScheduling",
    needsConnection: false,
  },
  aha: { methodName: "executeAha", needsConnection: false },
  airfocus: { methodName: "executeAirfocus", needsConnection: false },
  "airtable-forms": {
    methodName: "executeAirtableForms",
    needsConnection: false,
  },
  akiflow: { methodName: "executeAkiflow", needsConnection: false },
  alchemer: { methodName: "executeAlchemer", needsConnection: false },
  "amazing-marvin": {
    methodName: "executeAmazingMarvin",
    needsConnection: false,
  },
  "any-do": { methodName: "executeAnyDo", needsConnection: false },
  asana: { methodName: "executeAsana", needsConnection: false },
  asknicely: { methodName: "executeAskNicely", needsConnection: false },
  "atlassian-rovo": {
    methodName: "executeAtlassianRovo",
    needsConnection: false,
  },
  avaza: { methodName: "executeAvaza", needsConnection: false },
  basecamp: { methodName: "executeBasecamp", needsConnection: false },
  bonsai: { methodName: "executeBonsai", needsConnection: false },
  calendly: { methodName: "executeCalendly", needsConnection: false },
  clickup: { methodName: "executeClickUp", needsConnection: false },
  cliniko: { methodName: "executeCliniko", needsConnection: false },
  clockify: { methodName: "executeClockify", needsConnection: false },
  "cognito-forms": {
    methodName: "executeCognitoForms",
    needsConnection: false,
  },
  cookiebot: { methodName: "executeCookiebot", needsConnection: false },
  "craft-io": { methodName: "executeCraftIo", needsConnection: false },
  delighted: { methodName: "executeDelighted", needsConnection: false },
  deputy: { methodName: "executeDeputy", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof WorkManagementExecutors1>;
