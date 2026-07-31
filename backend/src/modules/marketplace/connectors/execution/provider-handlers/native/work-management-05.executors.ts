import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { type ZohoPeopleStructureKind } from "../../../zoho-people/zoho-people-api.adapter";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const WorkManagementExecutors5 = {
  async executeTrackingTime(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "trackingtime",
      input.connectionId,
    );
    const appPassword = this.trackingTimeAppPassword(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("trackingtime", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "trackingTime.read") {
      data = await this.trackingTimeMcp.callRead(appPassword, input.input);
    } else if (name === "trackingTime.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "trackingtime_mcp_manage",
        "trackingtime",
      );
      data = await this.trackingTimeMcp.callManage(appPassword, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.trackingtime.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `TrackingTime ${name.split(".")[1]} completed.`);
  },

  async executeTrello(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "trello",
      input.connectionId,
    );
    const tool = this.registry.getTool("trello", input.toolName)!;
    if (tool.name === "relay_trello_draft_card_change") {
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
      const cardId = this.stringOrNull(input.input.cardId);
      if (["update", "comment"].includes(operation) && !cardId)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "cardId is required for an update or comment draft",
        );
      const encoded = JSON.stringify({ operation, cardId, fields });
      if (encoded.length > 40_000)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "Trello card draft is too large",
        );
      return this.ok(
        {
          operation,
          cardId,
          fields,
          payloadHash: this.hash(encoded),
          providerSideEffect: false,
        },
        "Trello card change prepared locally.",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = {
      apiKey: this.requiredString(
        (token.credentials as Record<string, unknown>).clientId,
        "Trello API key",
      ),
      token: token.accessToken,
    };
    if (tool.name === "relay_trello_list_boards")
      return this.ok(
        await this.trelloApi.listBoards(credentials, input.input),
        "Trello boards listed.",
      );
    if (tool.name === "relay_trello_list_board_cards")
      return this.ok(
        await this.trelloApi.listBoardCards(credentials, input.input),
        "Trello board cards listed.",
      );
    if (tool.name === "relay_trello_get_card")
      return this.ok(
        await this.trelloApi.getCard(credentials, input.input),
        "Trello card read.",
      );
    if (tool.name === "relay_trello_search_cards")
      return this.ok(
        await this.trelloApi.searchCards(credentials, input.input),
        "Trello cards found.",
      );
    if (tool.name === "relay_trello_create_card") {
      await this.requireTrelloApproval(
        input,
        connection,
        "trello_card_create",
        input.input.listId,
        input.input,
      );
      const result = await this.trelloApi.createCard(credentials, input.input);
      await this.auditTrelloWrite(
        input,
        connection,
        "card.created",
        input.input.listId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Trello card created.");
    }
    if (tool.name === "relay_trello_update_card") {
      await this.requireTrelloApproval(
        input,
        connection,
        "trello_card_update",
        input.input.cardId,
        input.input,
      );
      const result = await this.trelloApi.updateCard(credentials, input.input);
      await this.auditTrelloWrite(
        input,
        connection,
        "card.updated",
        input.input.cardId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Trello card updated.");
    }
    if (tool.name === "relay_trello_add_comment") {
      await this.requireTrelloApproval(
        input,
        connection,
        "trello_card_comment_create",
        input.input.cardId,
        input.input,
      );
      const result = await this.trelloApi.addComment(credentials, input.input);
      await this.auditTrelloWrite(
        input,
        connection,
        "comment.created",
        input.input.cardId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Trello comment added.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeUserInterviews(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "user-interviews",
      input.connectionId,
    );
    const credentials = this.userInterviewsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("user-interviews", input.toolName)!;
    if (tool.name !== "user-interviews.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.userInterviewsApi.read(credentials, operation, {
      page: input.input.page,
      limit: input.input.limit,
      recruitId: input.input.recruitId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.user_interviews.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "User Interviews read completed.");
  },

  async executeUserTesting(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "usertesting",
      input.connectionId,
    );
    const credentials = this.userTestingCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("usertesting", input.toolName)!;
    if (tool.name !== "usertesting.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.userTestingApi.read(credentials, operation, {
      testId: input.input.testId,
      limit: input.input.limit,
      offset: input.input.offset,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.usertesting.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "UserTesting read completed.");
  },

  async executeVagaro(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vagaro",
      input.connectionId,
    );
    const credentials = this.vagaroCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("vagaro", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "vagaro.read") {
      data = await this.vagaroApi.read(credentials, input.input);
    } else if (name === "vagaro.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "vagaro_api_manage",
        "vagaro",
      );
      data = await this.vagaroApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.vagaro.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          this.stringOrNull(input.input.method) ??
          (name === "vagaro.read" ? "POST" : null),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Vagaro ${name.split(".")[1]} completed.`);
  },

  async executeWorkfrontPlanning(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "workfront-planning",
      input.connectionId,
    );
    const credentials = this.workfrontPlanningCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("workfront-planning", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "workfront-planning",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "workfrontPlanning.listWorkspaces")
      data = await this.workfrontPlanningApi.listWorkspaces(
        credentials,
        payload,
      );
    else if (tool.name === "workfrontPlanning.getWorkspace")
      data = await this.workfrontPlanningApi.getWorkspace(credentials, payload);
    else if (tool.name === "workfrontPlanning.listRecordTypes")
      data = await this.workfrontPlanningApi.listRecordTypes(
        credentials,
        payload,
      );
    else if (tool.name === "workfrontPlanning.getRecordType")
      data = await this.workfrontPlanningApi.getRecordType(
        credentials,
        payload,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.workfront_planning.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerWorkspaceIdHash: input.input.workspaceId
          ? this.hash(String(input.input.workspaceId))
          : null,
        recordTypeIdHash: input.input.recordTypeId
          ? this.hash(String(input.input.recordTypeId))
          : null,
        limit: input.input.limit ?? null,
        namesLogged: false,
        descriptionsLogged: false,
        identitiesLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(
      data,
      `Workfront Planning ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeWpForms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "wpforms",
      input.connectionId,
    );
    const credentials = this.wpFormsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("wpforms", input.toolName)!;
    if (tool.name !== "wpforms.read") {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.wpFormsApi.read(credentials, operation, {
      formId: input.input.formId,
      entryId: input.input.entryId,
      status: input.input.status,
      type: input.input.type,
      limit: input.input.limit,
      offset: input.input.offset,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.wpforms.read.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation,
      },
    });
    return this.ok(data, "WPForms read completed.");
  },

  async executeWrike(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "wrike",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.wrikeCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("wrike", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "wrike.listProjects") {
      action = "wrike_project_list";
      data = await this.wrikeApi.listProjects(credentials, input.input);
    } else if (name === "wrike.listTasks") {
      action = "wrike_task_list";
      data = await this.wrikeApi.listTasks(credentials, input.input);
    } else if (name === "wrike.getTask") {
      action = "wrike_task_get";
      data = await this.wrikeApi.getTask(
        credentials,
        input.input as { taskId: string },
      );
    } else if (name === "wrike.request") {
      action = "wrike_full_api";
      await this.requireConnectorApproval(input, connection, action, "wrike");
      data = await this.wrikeApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.recordOrUndefined(input.input.query),
        form: this.recordOrUndefined(input.input.form),
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
      eventType: `marketplace.wrike.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
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
    return this.ok(data, `Wrike ${name.split(".")[1]} completed.`);
  },

  async executeWufoo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "wufoo",
      input.connectionId,
    );
    const credentials = this.wufooCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("wufoo", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      form: this.objectOrNull(input.input.form) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "wufoo.read") {
      data = await this.wufooApi.read(credentials, operation, operationInput);
    } else if (tool.name === "wufoo.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "wufoo_manage",
        "wufoo",
      );
      data = await this.wufooApi.manage(credentials, operation, operationInput);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.wufoo.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation,
      },
    });
    return this.ok(data, `Wufoo ${tool.name.split(".")[1]} completed.`);
  },

  async executeYouCanBookMe(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "youcanbookme",
      input.connectionId,
    );
    const credentials = this.youCanBookMeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("youcanbookme", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "youcanbookme.read") {
      data = await this.youCanBookMeApi.read(credentials, input.input);
    } else if (name === "youcanbookme.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "youcanbookme_api_manage",
        "youcanbookme",
      );
      data = await this.youCanBookMeApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.youcanbookme.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "youcanbookme.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `YouCanBookMe ${name.split(".")[1]} completed.`);
  },

  async executeZephyrScale(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zephyr-scale",
      input.connectionId,
    );
    const credentials = this.zephyrScaleCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("zephyr-scale", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "zephyrScale.listTestCases") {
      action = "zephyr_scale_test_case_list";
      data = await this.zephyrScaleApi.listTestCases(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "zephyrScale.getTestCase") {
      action = "zephyr_scale_test_case_get";
      data = await this.zephyrScaleApi.getTestCase(
        credentials,
        this.requiredString(input.input.testCaseKey, "testCaseKey"),
      );
    } else if (name === "zephyrScale.listTestCycles") {
      action = "zephyr_scale_test_cycle_list";
      data = await this.zephyrScaleApi.listTestCycles(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "zephyrScale.request") {
      action = "zephyr_scale_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zephyr-scale",
      );
      data = await this.zephyrScaleApi.request(credentials, {
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
      eventType: `marketplace.zephyr-scale.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        projectKeyHash: this.hash(credentials.projectKey),
        region: credentials.region,
        testCaseKeyHash: this.stringOrNull(input.input.testCaseKey)
          ? this.hash(this.stringOrNull(input.input.testCaseKey)!)
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Zephyr Scale ${name.split(".")[1]} completed.`);
  },

  async executeZohoAnalytics(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho-analytics",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zohoAnalyticsCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("zoho-analytics", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "zohoAnalytics.listWorkspaces") {
      action = "zoho_analytics_workspace_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-analytics",
      );
      data = await this.zohoAnalyticsApi.listWorkspaces(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "zohoAnalytics.listViews") {
      action = "zoho_analytics_view_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-analytics",
      );
      data = await this.zohoAnalyticsApi.listViews(credentials, {
        organizationId: this.requiredString(
          input.input.organizationId,
          "organizationId",
        ),
        workspaceId: this.requiredString(
          input.input.workspaceId,
          "workspaceId",
        ),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
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
      eventType: `marketplace.zoho_analytics.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        userIdHash: this.hash(credentials.userId),
        apiOriginHash: this.hash(credentials.apiOrigin),
        organizationIdHash: this.stringOrNull(input.input.organizationId)
          ? this.hash(this.stringOrNull(input.input.organizationId)!)
          : null,
        workspaceIdHash: this.stringOrNull(input.input.workspaceId)
          ? this.hash(this.stringOrNull(input.input.workspaceId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Zoho Analytics ${name.split(".")[1]} completed.`);
  },

  async executeZohoPeople(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho-people",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zohoPeopleCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("zoho-people", input.toolName)!;
    const name = tool.name;
    const kind = this.requiredString(input.input.kind, "kind");
    let data: unknown;
    let action: string;
    if (name === "zohoPeople.listOrganizationStructure") {
      action = "zoho_people_structure_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-people",
      );
      data = await this.zohoPeopleApi.listStructure(credentials, {
        kind: kind as ZohoPeopleStructureKind,
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "zohoPeople.getOrganizationStructure") {
      action = "zoho_people_structure_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-people",
      );
      data = await this.zohoPeopleApi.getStructure(credentials, {
        kind: kind as ZohoPeopleStructureKind,
        recordId: this.requiredString(input.input.recordId, "recordId"),
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
      eventType: `marketplace.zoho_people.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        userIdHash: this.hash(credentials.userId),
        apiOriginHash: this.hash(credentials.apiOrigin),
        kind,
        recordIdHash: this.stringOrNull(input.input.recordId)
          ? this.hash(this.stringOrNull(input.input.recordId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Zoho People ${name.split(".")[1]} completed.`);
  },

  async executeZohoProjects(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho-projects",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zohoProjectsCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("zoho-projects", input.toolName)!;
    let action: string;
    let data: unknown;
    if (tool.name === "zohoProjects.listProjects") {
      action = "zoho_projects_project_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-projects",
      );
      data = await this.zohoProjectsApi.listProjects(credentials, input.input);
    } else if (tool.name === "zohoProjects.listTasks") {
      action = "zoho_projects_task_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-projects",
      );
      data = await this.zohoProjectsApi.listTasks(credentials, input.input);
    } else if (tool.name === "zohoProjects.getTask") {
      action = "zoho_projects_task_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "zoho-projects",
      );
      data = await this.zohoProjectsApi.getTask(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.zoho-projects.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        portalIdHash: this.hash(credentials.portalId),
        region: connection.metadata?.zohoRegion,
      },
    });
    return this.ok(data, `Zoho Projects ${tool.name.split(".")[1]} completed.`);
  },
};

export const WorkManagementExecutors5Registrations = {
  trackingtime: { methodName: "executeTrackingTime", needsConnection: false },
  trello: { methodName: "executeTrello", needsConnection: false },
  "user-interviews": {
    methodName: "executeUserInterviews",
    needsConnection: false,
  },
  usertesting: { methodName: "executeUserTesting", needsConnection: false },
  vagaro: { methodName: "executeVagaro", needsConnection: false },
  "workfront-planning": {
    methodName: "executeWorkfrontPlanning",
    needsConnection: false,
  },
  wpforms: { methodName: "executeWpForms", needsConnection: false },
  wrike: { methodName: "executeWrike", needsConnection: false },
  wufoo: { methodName: "executeWufoo", needsConnection: false },
  youcanbookme: { methodName: "executeYouCanBookMe", needsConnection: false },
  "zephyr-scale": { methodName: "executeZephyrScale", needsConnection: false },
  "zoho-analytics": {
    methodName: "executeZohoAnalytics",
    needsConnection: false,
  },
  "zoho-people": { methodName: "executeZohoPeople", needsConnection: false },
  "zoho-projects": {
    methodName: "executeZohoProjects",
    needsConnection: false,
  },
} satisfies NativeExecutorRegistrationMap<typeof WorkManagementExecutors5>;
