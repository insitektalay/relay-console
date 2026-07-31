import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const WorkManagementExecutors3 = {
  async executeMicrosoftLists(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-lists",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const binding = this.microsoftListsBinding(connection);
    const tool = this.registry.getTool("microsoft-lists", input.toolName)!;
    let data: unknown;
    if (tool.name === "microsoft-lists.getList")
      data = await this.microsoftListsApi.getList(token.accessToken, binding);
    else if (tool.name === "microsoft-lists.listColumns")
      data = await this.microsoftListsApi.listColumns(
        token.accessToken,
        binding,
      );
    else if (tool.name === "microsoft-lists.listItems")
      data = await this.microsoftListsApi.listItems(token.accessToken, binding);
    else if (tool.name === "microsoft-lists.getItem")
      data = await this.microsoftListsApi.getItem(
        token.accessToken,
        binding,
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
      eventType: `marketplace.microsoft_lists.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedSiteIdHash: this.hash(binding.siteId),
        selectedListIdHash: this.hash(binding.listId),
        approvedFieldPolicyHash: this.hash(
          binding.allowedFieldNames.slice().sort().join(","),
        ),
        itemIdHash: this.stringOrNull(input.input.itemId)
          ? this.hash(this.stringOrNull(input.input.itemId)!)
          : null,
        approvedFieldCount: binding.allowedFieldNames.length,
        identitiesAttachmentsExcluded: true,
        maxResults: 25,
      },
    });
    return this.ok(
      data,
      `Microsoft Lists ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeMicrosoftPlanner(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-planner",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("microsoft-planner", input.toolName)!;
    let data: unknown;
    if (tool.name === "microsoft-planner.listAssignedTasks")
      data = await this.microsoftPlannerApi.listAssignedTasks(
        token.accessToken,
      );
    else if (tool.name === "microsoft-planner.getTask")
      data = await this.microsoftPlannerApi.getTask(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "microsoft-planner.getPlan")
      data = await this.microsoftPlannerApi.getPlan(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "microsoft-planner.listPlanTasks")
      data = await this.microsoftPlannerApi.listPlanTasks(
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
      eventType: `marketplace.microsoft_planner.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        taskIdHash: this.stringOrNull(input.input.taskId)
          ? this.hash(this.stringOrNull(input.input.taskId)!)
          : null,
        planIdHash: this.stringOrNull(input.input.planId)
          ? this.hash(this.stringOrNull(input.input.planId)!)
          : null,
        assignmentIdentitiesExcluded: true,
        detailsExcluded: true,
        maxResults: 25,
      },
    });
    return this.ok(
      data,
      `Microsoft Planner ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeMicrosoftToDo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-to-do",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("microsoft-to-do", input.toolName)!;
    let data: unknown;
    if (tool.name === "microsoft-to-do.listTaskLists")
      data = await this.microsoftToDoApi.listTaskLists(token.accessToken);
    else if (tool.name === "microsoft-to-do.getTaskList")
      data = await this.microsoftToDoApi.getTaskList(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "microsoft-to-do.listTasks")
      data = await this.microsoftToDoApi.listTasks(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "microsoft-to-do.getTask")
      data = await this.microsoftToDoApi.getTask(
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
      eventType: `marketplace.microsoft_todo.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        taskListIdHash: this.stringOrNull(input.input.taskListId)
          ? this.hash(this.stringOrNull(input.input.taskListId)!)
          : null,
        taskIdHash: this.stringOrNull(input.input.taskId)
          ? this.hash(this.stringOrNull(input.input.taskId)!)
          : null,
        bodyExcluded: true,
        categoriesExcluded: true,
        relatedContentExcluded: true,
        maxResults: 25,
      },
    });
    return this.ok(
      data,
      `Microsoft To Do ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeMindbody(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mindbody",
      input.connectionId,
    );
    const credentials = this.mindbodyCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("mindbody", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "mindbody.read") {
      data = await this.mindbodyApi.read(credentials, input.input);
    } else if (name === "mindbody.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "mindbody_api_manage",
        "mindbody",
      );
      data = await this.mindbodyApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mindbody.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          this.stringOrNull(input.input.method) ??
          (name === "mindbody.read" ? "GET" : null),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Mindbody ${name.split(".")[1]} completed.`);
  },

  async executeMonday(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "monday-com",
      input.connectionId,
    );
    const tool = this.registry.getTool("monday-com", input.toolName)!;
    if (tool.name === "relay_monday_draft_item_change") {
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
      const itemId = this.stringOrNull(input.input.itemId);
      if (["update", "comment"].includes(operation) && !itemId)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "itemId is required for an update or comment draft",
        );
      const encoded = JSON.stringify({ operation, itemId, fields });
      if (encoded.length > 40_000)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "Monday.com item draft is too large",
        );
      return this.ok(
        {
          operation,
          itemId,
          fields,
          payloadHash: this.hash(encoded),
          providerSideEffect: false,
        },
        "Monday.com item change prepared locally.",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_monday_list_boards")
      return this.ok(
        await this.mondayApi.listBoards(token.accessToken, input.input),
        "Monday.com boards listed.",
      );
    if (tool.name === "relay_monday_list_board_items")
      return this.ok(
        await this.mondayApi.listBoardItems(token.accessToken, input.input),
        "Monday.com board items listed.",
      );
    if (tool.name === "relay_monday_get_item")
      return this.ok(
        await this.mondayApi.getItem(token.accessToken, input.input),
        "Monday.com item read.",
      );
    if (tool.name === "relay_monday_list_item_updates")
      return this.ok(
        await this.mondayApi.listItemUpdates(token.accessToken, input.input),
        "Monday.com item updates listed.",
      );
    if (tool.name === "relay_monday_create_item") {
      await this.requireMondayApproval(
        input,
        connection,
        "monday_item_create",
        input.input.boardId,
        input.input,
      );
      const result = await this.mondayApi.createItem(
        token.accessToken,
        input.input,
      );
      await this.auditMondayWrite(
        input,
        connection,
        "item.created",
        input.input.boardId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Monday.com item created.");
    }
    if (tool.name === "relay_monday_update_item") {
      await this.requireMondayApproval(
        input,
        connection,
        "monday_item_update",
        input.input.itemId,
        input.input,
      );
      const result = await this.mondayApi.updateItem(
        token.accessToken,
        input.input,
      );
      await this.auditMondayWrite(
        input,
        connection,
        "item.updated",
        input.input.itemId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Monday.com item updated.");
    }
    if (tool.name === "relay_monday_add_update") {
      await this.requireMondayApproval(
        input,
        connection,
        "monday_item_comment_create",
        input.input.itemId,
        input.input,
      );
      const result = await this.mondayApi.addUpdate(
        token.accessToken,
        input.input,
      );
      await this.auditMondayWrite(
        input,
        connection,
        "update.created",
        input.input.itemId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Monday.com update added.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeMotion(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "motion",
      input.connectionId,
    );
    const credentials = this.motionCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("motion", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "motion.read") {
      data = await this.motionApi.read(credentials, input.input);
    } else if (name === "motion.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "motion_api_manage",
        "motion",
      );
      data = await this.motionApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.motion.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "motion.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Motion ${name.split(".")[1]} completed.`);
  },

  async executeMsProject(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ms-project",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const environmentOrigin = this.requiredString(
      connection.metadata?.msProjectEnvironmentOrigin,
      "Microsoft Project environment",
    );
    const tool = this.registry.getTool("ms-project", input.toolName)!;
    let data: unknown;
    if (tool.name === "ms-project.read") {
      data = await this.msProjectApi.read(
        token.accessToken,
        environmentOrigin,
        input.input,
      );
    } else if (tool.name === "ms-project.schedule") {
      await this.requireConnectorApproval(
        input,
        connection,
        "ms_project_schedule_manage",
        "ms-project",
      );
      data = await this.msProjectApi.schedule(
        token.accessToken,
        environmentOrigin,
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
      eventType: `marketplace.ms-project.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        entity: this.stringOrNull(input.input.entity),
        scheduleAction: this.stringOrNull(input.input.action),
      },
    });
    return this.ok(
      data,
      `Microsoft Project ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeMyHours(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "my-hours",
      input.connectionId,
    );
    const credentials = this.myHoursCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("my-hours", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: input.input.json,
    };
    let data: unknown;
    if (tool.name === "myHours.read") {
      data = await this.myHoursApi.read(credentials, operation, operationInput);
    } else if (tool.name === "myHours.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "my_hours_manage",
        "my-hours",
      );
      data = await this.myHoursApi.manage(
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
      eventType: `marketplace.my_hours.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation,
      },
    });
    return this.ok(data, `My Hours ${tool.name.split(".")[1]} completed.`);
  },

  async executeNifty(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "nifty",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("nifty", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "nifty.read") {
      data = await this.niftyApi.read(token.accessToken, input.input);
    } else if (name === "nifty.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "nifty_api_manage",
        "nifty",
      );
      data = await this.niftyApi.manage(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.nifty.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "nifty.read" ? "GET" : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Nifty ${name.split(".")[1]} completed.`);
  },

  async executeNinjaForms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ninja-forms",
      input.connectionId,
    );
    const credentials = this.ninjaFormsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("ninja-forms", input.toolName)!;
    if (tool.name !== "ninjaForms.read") {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.ninjaFormsApi.read(credentials, operation, {
      formId: input.input.formId,
      submissionId: input.input.submissionId,
      title: input.input.title,
      limit: input.input.limit,
      format: input.input.format,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.ninja_forms.read.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation,
      },
    });
    return this.ok(data, "Ninja Forms read completed.");
  },

  async executeNozbe(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "nozbe",
      input.connectionId,
    );
    const credentials = this.nozbeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("nozbe", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "nozbe.read") {
      data = await this.nozbeApi.read(credentials, input.input);
    } else if (name === "nozbe.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "nozbe_api_manage",
        "nozbe",
      );
      data = await this.nozbeApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.nozbe.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "nozbe.read" ? "GET" : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Nozbe ${name.split(".")[1]} completed.`);
  },

  async executeOdoo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "odoo",
      input.connectionId,
    );
    const credentials = this.odooCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("odoo", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "odoo.getCurrentUser") {
      action = "odoo_user_get";
      await this.requireConnectorApproval(input, connection, action, "odoo");
      data = await this.odooApi.getCurrentUser(credentials);
    } else if (name === "odoo.listProjects") {
      action = "odoo_project_list";
      await this.requireConnectorApproval(input, connection, action, "odoo");
      data = await this.odooApi.listProjects(credentials, input.input);
    } else if (name === "odoo.getProject") {
      action = "odoo_project_get";
      await this.requireConnectorApproval(input, connection, action, "odoo");
      data = await this.odooApi.getProject(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.odoo.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        databaseHash: this.hash(credentials.database),
        projectIdHash:
          typeof input.input.projectId === "number"
            ? this.hash(String(input.input.projectId))
            : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Odoo ${name.split(".")[1]} completed.`);
  },

  async executeOnceHub(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "oncehub",
      input.connectionId,
    );
    const credentials = this.onceHubCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("oncehub", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "oncehub.read") {
      data = await this.onceHubApi.read(credentials, input.input);
    } else if (name === "oncehub.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "oncehub_api_manage",
        "oncehub",
      );
      data = await this.onceHubApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.oncehub.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "oncehub.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `OnceHub ${name.split(".")[1]} completed.`);
  },

  async executeOneTrust(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "onetrust",
      input.connectionId,
    );
    const credentials = this.oneTrustCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("onetrust", input.toolName)!;
    let data: unknown;
    if (tool.name === "onetrust.getDomainBrandingSummary")
      data = await this.oneTrustApi.getDomainBrandingSummary(credentials);
    else if (tool.name === "onetrust.getScanSummary")
      data = await this.oneTrustApi.getScanSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.onetrust.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedDomainBound: true,
      },
    });
    return this.ok(data, `OneTrust ${tool.name.split(".")[1]} completed.`);
  },

  async executeOpsgenieCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "opsgenie-cloud",
      input.connectionId,
    );
    const credentials = this.opsgenieCloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("opsgenie-cloud", input.toolName)!;
    let data: unknown;
    if (tool.name === "opsgenieCloud.listAlerts")
      data = await this.opsgenieCloudApi.listAlerts(credentials, input.input);
    else if (tool.name === "opsgenieCloud.getAlert")
      data = await this.opsgenieCloudApi.getAlert(credentials, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.opsgenie-cloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(
      data,
      `Opsgenie Cloud ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executePaperform(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "paperform",
      input.connectionId,
    );
    const credentials = this.paperformCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("paperform", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: input.input.json,
    };
    let data: unknown;
    if (tool.name === "paperform.read") {
      data = await this.paperformApi.read(
        credentials,
        operation,
        operationInput,
      );
    } else if (tool.name === "paperform.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "paperform_manage",
        "paperform",
      );
      data = await this.paperformApi.manage(
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
      eventType: `marketplace.paperform.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation,
      },
    });
    return this.ok(data, `Paperform ${tool.name.split(".")[1]} completed.`);
  },

  async executePaymo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "paymo",
      input.connectionId,
    );
    const credentials = this.paymoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("paymo", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "paymo.read") {
      data = await this.paymoApi.read(credentials, input.input);
    } else if (name === "paymo.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "paymo_api_manage",
        "paymo",
      );
      data = await this.paymoApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.paymo.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "paymo.read" ? "GET" : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Paymo ${name.split(".")[1]} completed.`);
  },

  async executePlanviewAgilePlace(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "planview-agileplace",
      input.connectionId,
    );
    const credentials = this.planviewAgilePlaceCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("planview-agileplace", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "planview-agileplace",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "planviewAgilePlace.listBoards")
      data = await this.planviewAgilePlaceApi.listBoards(credentials, payload);
    else if (tool.name === "planviewAgilePlace.getBoard")
      data = await this.planviewAgilePlaceApi.getBoard(credentials, payload);
    else if (tool.name === "planviewAgilePlace.listCards")
      data = await this.planviewAgilePlaceApi.listCards(credentials, payload);
    else if (tool.name === "planviewAgilePlace.getCard")
      data = await this.planviewAgilePlaceApi.getCard(credentials, payload);
    else if (tool.name === "planviewAgilePlace.createCard")
      data = await this.planviewAgilePlaceApi.createCard(credentials, payload);
    else if (tool.name === "planviewAgilePlace.updateCard")
      data = await this.planviewAgilePlaceApi.updateCard(credentials, payload);
    else if (tool.name === "planviewAgilePlace.deleteCard")
      data = await this.planviewAgilePlaceApi.deleteCard(credentials, payload);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.planview_agileplace.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        boardIdHash: input.input.boardId
          ? this.hash(String(input.input.boardId))
          : null,
        cardIdHash: input.input.cardId
          ? this.hash(String(input.input.cardId))
          : null,
        limit: input.input.limit ?? null,
        titlesLogged: false,
        descriptionsLogged: false,
        identitiesLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(
      data,
      `Planview AgilePlace ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executePlutio(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "plutio",
      input.connectionId,
    );
    const credentials = this.plutioCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("plutio", input.toolName)!;
    const name = tool.name;
    const operation = this.stringOrNull(input.input.operation) ?? "";
    let data: unknown;
    if (name === "plutio.read") {
      data = await this.plutioApi.read(credentials, operation, input.input);
    } else if (name === "plutio.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "plutio_manage",
        "plutio",
      );
      data = await this.plutioApi.manage(credentials, operation, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.plutio.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        operation,
      },
    });
    return this.ok(data, `Plutio ${name.split(".")[1]} completed.`);
  },

  async executePracticeBetter(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "practice-better",
      input.connectionId,
    );
    const credentials = this.practiceBetterCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("practice-better", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "practice_better.read") {
      data = await this.practiceBetterApi.read(credentials, input.input);
    } else if (name === "practice_better.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "practice_better_api_manage",
        "practice-better",
      );
      data = await this.practiceBetterApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.practice-better.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          this.stringOrNull(input.input.method) ??
          (name === "practice_better.read" ? "GET" : null),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Practice Better ${name.split(".")[1]} completed.`);
  },

  async executeProductboard(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "productboard",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const workspaceId = this.stringOrNull(
      connection.metadata?.productboardWorkspaceId,
    );
    if (!workspaceId)
      return this.safeError(
        "connection_not_ready",
        "Productboard connection is not bound to one workspace.",
      );
    const tool = this.registry.getTool("productboard", input.toolName)!;
    let data: unknown;
    if (tool.name === "productboard.read") {
      data = await this.productboardApi.read(token.accessToken, input.input);
    } else if (tool.name === "productboard.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "productboard_manage",
        "productboard",
      );
      data = await this.productboardApi.manage(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.productboard.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "productboard.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        productboardWorkspaceId: workspaceId,
      },
    });
    return this.ok(data, `Productboard ${tool.name.split(".")[1]} completed.`);
  },

  async executeProductPlan(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "productplan",
      input.connectionId,
    );
    const credentials = this.productPlanCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("productplan", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "productplan",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "productPlan.listRoadmaps")
      data = await this.productPlanApi.listRoadmaps(credentials, payload);
    else if (tool.name === "productPlan.getRoadmap")
      data = await this.productPlanApi.getRoadmap(credentials, payload);
    else if (tool.name === "productPlan.listBars")
      data = await this.productPlanApi.listBars(credentials, payload);
    else if (tool.name === "productPlan.getBar")
      data = await this.productPlanApi.getBar(credentials, payload);
    else if (tool.name === "productPlan.createParkedBar")
      data = await this.productPlanApi.createParkedBar(credentials, payload);
    else if (tool.name === "productPlan.updateBar")
      data = await this.productPlanApi.updateBar(credentials, payload);
    else if (tool.name === "productPlan.deleteBar")
      data = await this.productPlanApi.deleteBar(credentials, payload);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.productplan.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        roadmapIdHash: input.input.roadmapId
          ? this.hash(String(input.input.roadmapId))
          : null,
        barIdHash: input.input.barId
          ? this.hash(String(input.input.barId))
          : null,
        limit: input.input.limit ?? null,
        namesLogged: false,
        descriptionsLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(data, `ProductPlan ${tool.name.split(".")[1]} completed.`);
  },

  async executeProof(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "proof",
      input.connectionId,
    );
    const credentials = this.proofCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("proof", input.toolName)!;
    let data: unknown;
    if (tool.name === "proof.listTransactions") {
      data = await this.proofApi.listTransactions(credentials);
    } else if (tool.name === "proof.getTransaction") {
      data = await this.proofApi.getTransaction(
        credentials,
        this.requiredString(input.input.transactionId, "transactionId"),
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
      eventType: `marketplace.proof.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        transactionIdProvided: typeof input.input.transactionId === "string",
      },
    });
    return this.ok(data, `Proof ${tool.name.split(".")[1]} completed.`);
  },

  async executeProofHub(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "proofhub",
      input.connectionId,
    );
    const credentials = this.proofHubCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("proofhub", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "proofhub.read") {
      data = await this.proofHubApi.read(credentials, input.input);
    } else if (name === "proofhub.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "proofhub_api_manage",
        "proofhub",
      );
      data = await this.proofHubApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.proofhub.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "proofhub.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `ProofHub ${name.split(".")[1]} completed.`);
  },

  async executeQualtrics(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "qualtrics",
      input.connectionId,
    );
    const credentials = this.qualtricsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("qualtrics", input.toolName)!;
    if (tool.name !== "qualtrics.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.qualtricsApi.read(credentials, operation, {
      surveyId: input.input.surveyId,
      offset: input.input.offset,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.qualtrics.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Qualtrics read completed.");
  },

  async executeQuickBooksTime(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "quickbooks-time",
      input.connectionId,
    );
    const credentials = this.quickBooksTimeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("quickbooks-time", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "quickBooksTime.read") {
      data = await this.quickBooksTimeApi.read(
        credentials,
        operation,
        operationInput,
      );
    } else if (tool.name === "quickBooksTime.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "quickbooks_time_manage",
        "quickbooks-time",
      );
      data = await this.quickBooksTimeApi.manage(
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
      eventType: `marketplace.quickbooks-time.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(
      data,
      `QuickBooks Time ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeReclaimAi(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "reclaim-ai",
      input.connectionId,
    );
    const credentials = this.reclaimAiCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("reclaim-ai", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "reclaim-ai.read") {
      data = await this.reclaimAiApi.read(credentials, input.input);
    } else if (name === "reclaim-ai.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "reclaim_ai_api_manage",
        "reclaim-ai",
      );
      data = await this.reclaimAiApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.reclaim_ai.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "reclaim-ai.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Reclaim.ai ${name.split(".")[1]} completed.`);
  },

  async executeRefiner(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "refiner",
      input.connectionId,
    );
    const credentials = this.refinerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("refiner", input.toolName)!;
    if (tool.name !== "refiner.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.refinerApi.read(credentials, operation, {
      page: input.input.page,
      limit: input.input.limit,
      list: input.input.list,
      formUuid: input.input.formUuid,
      type: input.input.type,
      dateStart: input.input.dateStart,
      dateEnd: input.input.dateEnd,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.refiner.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Refiner read completed.");
  },

  async executeRememberTheMilk(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "remember-the-milk",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("remember-the-milk", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "remember-the-milk.read") {
      data = await this.rememberTheMilkMcp.callRead(
        token.accessToken,
        input.input,
      );
    } else if (name === "remember-the-milk.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "remember_the_milk_mcp_manage",
        "remember-the-milk",
      );
      data = await this.rememberTheMilkMcp.callManage(
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
      eventType: `marketplace.remember_the_milk.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Remember The Milk ${name.split(".")[1]} completed.`);
  },
};

export const WorkManagementExecutors3Registrations = {
  "microsoft-lists": {
    methodName: "executeMicrosoftLists",
    needsConnection: false,
  },
  "microsoft-planner": {
    methodName: "executeMicrosoftPlanner",
    needsConnection: false,
  },
  "microsoft-to-do": {
    methodName: "executeMicrosoftToDo",
    needsConnection: false,
  },
  mindbody: { methodName: "executeMindbody", needsConnection: false },
  "monday-com": { methodName: "executeMonday", needsConnection: false },
  motion: { methodName: "executeMotion", needsConnection: false },
  "ms-project": { methodName: "executeMsProject", needsConnection: false },
  "my-hours": { methodName: "executeMyHours", needsConnection: false },
  nifty: { methodName: "executeNifty", needsConnection: false },
  "ninja-forms": { methodName: "executeNinjaForms", needsConnection: false },
  nozbe: { methodName: "executeNozbe", needsConnection: false },
  odoo: { methodName: "executeOdoo", needsConnection: false },
  oncehub: { methodName: "executeOnceHub", needsConnection: false },
  onetrust: { methodName: "executeOneTrust", needsConnection: false },
  "opsgenie-cloud": {
    methodName: "executeOpsgenieCloud",
    needsConnection: false,
  },
  paperform: { methodName: "executePaperform", needsConnection: false },
  paymo: { methodName: "executePaymo", needsConnection: false },
  "planview-agileplace": {
    methodName: "executePlanviewAgilePlace",
    needsConnection: false,
  },
  plutio: { methodName: "executePlutio", needsConnection: false },
  "practice-better": {
    methodName: "executePracticeBetter",
    needsConnection: false,
  },
  productboard: { methodName: "executeProductboard", needsConnection: false },
  productplan: { methodName: "executeProductPlan", needsConnection: false },
  proof: { methodName: "executeProof", needsConnection: false },
  proofhub: { methodName: "executeProofHub", needsConnection: false },
  qualtrics: { methodName: "executeQualtrics", needsConnection: false },
  "quickbooks-time": {
    methodName: "executeQuickBooksTime",
    needsConnection: false,
  },
  "reclaim-ai": { methodName: "executeReclaimAi", needsConnection: false },
  refiner: { methodName: "executeRefiner", needsConnection: false },
  "remember-the-milk": {
    methodName: "executeRememberTheMilk",
    needsConnection: false,
  },
} satisfies NativeExecutorRegistrationMap<typeof WorkManagementExecutors3>;
