import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const WorkManagementExecutors2 = {
  async executeDocuSignClm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "docusign-clm",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("docusign-clm", input.toolName)!;
    if (tool.name !== "docusign-clm.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.docuSignClmApi.read(token.accessToken, operation, {
      apiOrigin: input.input.apiOrigin,
      accountId: input.input.accountId,
      folderId: input.input.folderId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.docusign_clm.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "DocuSign CLM folder metadata read completed.");
  },

  async executeDovetail(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "dovetail",
      input.connectionId,
    );
    const credentials = this.dovetailCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("dovetail", input.toolName)!;
    if (tool.name !== "dovetail.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.dovetailApi.read(credentials, operation, {
      limit: input.input.limit,
      projectId: input.input.projectId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.dovetail.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Dovetail metadata read completed.");
  },

  async executeEverhour(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "everhour",
      input.connectionId,
    );
    const credentials = this.everhourCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("everhour", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "everhour.read") {
      data = await this.everhourApi.read(
        credentials,
        operation,
        operationInput,
      );
    } else if (tool.name === "everhour.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "everhour_manage",
        "everhour",
      );
      data = await this.everhourApi.manage(
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
      eventType: `marketplace.everhour.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Everhour ${tool.name.split(".")[1]} completed.`);
  },

  async executeFavro(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "favro",
      input.connectionId,
    );
    const credentials = this.favroCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("favro", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "favro",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "favro.listOrganizations")
      data = await this.favroApi.listOrganizations(credentials, payload);
    else if (tool.name === "favro.listCollections")
      data = await this.favroApi.listCollections(credentials, payload);
    else if (tool.name === "favro.getCollection")
      data = await this.favroApi.getCollection(credentials, payload);
    else if (tool.name === "favro.listWidgets")
      data = await this.favroApi.listWidgets(credentials, payload);
    else if (tool.name === "favro.getWidget")
      data = await this.favroApi.getWidget(credentials, payload);
    else if (tool.name === "favro.listCards")
      data = await this.favroApi.listCards(credentials, payload);
    else if (tool.name === "favro.getCard")
      data = await this.favroApi.getCard(credentials, payload);
    else if (tool.name === "favro.createCard")
      data = await this.favroApi.createCard(credentials, payload);
    else if (tool.name === "favro.updateCard")
      data = await this.favroApi.updateCard(credentials, payload);
    else if (tool.name === "favro.deleteCard")
      data = await this.favroApi.deleteCard(credentials, payload);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.favro.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        organizationIdHash: input.input.organizationId
          ? this.hash(String(input.input.organizationId))
          : null,
        collectionIdHash: input.input.collectionId
          ? this.hash(String(input.input.collectionId))
          : null,
        widgetCommonIdHash: input.input.widgetCommonId
          ? this.hash(String(input.input.widgetCommonId))
          : null,
        cardIdHash: input.input.cardId
          ? this.hash(String(input.input.cardId))
          : null,
        limit: input.input.limit ?? null,
        namesLogged: false,
        descriptionsLogged: false,
        identitiesLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(data, `Favro ${tool.name.split(".")[1]} completed.`);
  },

  async executeFillout(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "fillout",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.filloutCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("fillout", input.toolName)!;
    let data: unknown;
    if (tool.name === "fillout.listForms") {
      data = await this.filloutApi.listForms(credentials);
    } else if (tool.name === "fillout.getFormMetadata") {
      data = await this.filloutApi.getFormMetadata(credentials, input.input);
    } else if (tool.name === "fillout.listRecentSubmissions") {
      data = await this.filloutApi.listRecentSubmissions(
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
      eventType: `marketplace.fillout.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        formIdHash: this.stringOrNull(input.input.formId)
          ? this.hash(this.stringOrNull(input.input.formId)!)
          : null,
      },
    });
    return this.ok(data, `Fillout ${tool.name.split(".")[1]} completed.`);
  },

  async executeFormstack(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "formstack",
      input.connectionId,
    );
    const credentials = this.formstackCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("formstack", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: input.input.json,
    };
    let data: unknown;
    if (tool.name === "formstack.read") {
      data = await this.formstackApi.read(
        credentials,
        operation,
        operationInput,
      );
    } else if (tool.name === "formstack.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "formstack_manage",
        "formstack",
      );
      data = await this.formstackApi.manage(
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
      eventType: `marketplace.formstack.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Formstack ${tool.name.split(".")[1]} completed.`);
  },

  async executeGoogleCalendar(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-calendar",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.googleCalendarCredentials(token.credentials);
    const tool = this.registry.getTool("google-calendar", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "googleCalendar.listCalendars") {
      action = "google_calendar_calendar_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "google-calendar",
      );
      data = await this.googleCalendarApi.listCalendars(
        credentials,
        input.input,
      );
    } else if (name === "googleCalendar.listEvents") {
      action = "google_calendar_event_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "google-calendar",
      );
      data = await this.googleCalendarApi.listEvents(credentials, input.input);
    } else if (name === "googleCalendar.queryFreeBusy") {
      action = "google_calendar_freebusy_query";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "google-calendar",
      );
      data = await this.googleCalendarApi.queryFreeBusy(
        credentials,
        input.input,
      );
    } else if (name === "googleCalendar.createEvent") {
      action = "google_calendar_event_create";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "google-calendar",
      );
      data = await this.googleCalendarApi.createEvent(credentials, input.input);
    } else if (name === "googleCalendar.updateEvent") {
      action = "google_calendar_event_update";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "google-calendar",
      );
      data = await this.googleCalendarApi.updateEvent(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.google_calendar.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountHash: this.hash(credentials.accountEmail),
        defaultCalendarHash: this.hash(credentials.defaultCalendarId),
        tokenRefreshed: token.refreshed,
        calendarCount: Array.isArray(input.input.calendarIds)
          ? input.input.calendarIds.length
          : null,
        attendeeCount: Array.isArray(input.input.attendees)
          ? input.input.attendees.length
          : null,
        automaticPagination: false,
        guestNotificationsSent: false,
      },
    });
    return this.ok(data, `Google Calendar ${name.split(".")[1]} completed.`);
  },

  async executeGoogleTasks(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-tasks",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-tasks", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "googleTasks.prepareUpdate")
      data = this.googleTasksApi.prepareUpdate(input.input);
    else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "googleTasks.listTaskLists")
        data = await this.googleTasksApi.listTaskLists(token.accessToken);
      else if (name === "googleTasks.listTasks")
        data = await this.googleTasksApi.listTasks(
          token.accessToken,
          input.input,
        );
      else if (name === "googleTasks.createTask") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_tasks_task_create",
          "google-tasks",
        );
        data = await this.googleTasksApi.createTask(
          token.accessToken,
          input.input,
        );
      } else if (name === "googleTasks.patchTask") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_tasks_task_patch",
          "google-tasks",
        );
        data = await this.googleTasksApi.patchTask(
          token.accessToken,
          input.input,
        );
      } else
        return this.safeError(
          "tool_unavailable",
          `${input.toolName} is not implemented`,
        );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.google-tasks.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        taskListIdHash: this.stringOrNull(input.input.taskListId)
          ? this.hash(this.stringOrNull(input.input.taskListId)!)
          : null,
        taskIdHash: this.stringOrNull(input.input.taskId)
          ? this.hash(this.stringOrNull(input.input.taskId)!)
          : null,
        idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
        destructiveAction: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Tasks ${name.split(".")[1]} completed.`);
  },

  async executeGravityForms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "gravity-forms",
      input.connectionId,
    );
    const credentials = this.gravityFormsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("gravity-forms", input.toolName)!;
    if (tool.name !== "gravityForms.read") {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.gravityFormsApi.read(credentials, operation, {
      formId: input.input.formId,
      entryId: input.input.entryId,
      fieldIds: Array.isArray(input.input.fieldIds)
        ? input.input.fieldIds
        : undefined,
      limit: input.input.limit,
      offset: input.input.offset,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.gravity_forms.read.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation,
        requestedFieldCount: Array.isArray(input.input.fieldIds)
          ? input.input.fieldIds.length
          : 0,
      },
    });
    return this.ok(data, "Gravity Forms read completed.");
  },

  async executeHabitica(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "habitica",
      input.connectionId,
    );
    const credentials = this.habiticaCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("habitica", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "habitica.read") {
      data = await this.habiticaApi.read(credentials, input.input);
    } else if (name === "habitica.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "habitica_api_manage",
        "habitica",
      );
      data = await this.habiticaApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.habitica.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "habitica.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Habitica ${name.split(".")[1]} completed.`);
  },

  async executeHarvest(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "harvest",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.harvestCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("harvest", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "harvest.listProjectAssignments") {
      action = "harvest_project_assignment_list";
      data = await this.harvestApi.listProjectAssignments(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "harvest.listTimeEntries") {
      action = "harvest_time_entry_list";
      data = await this.harvestApi.listTimeEntries(credentials, {
        from: this.requiredString(input.input.from, "from"),
        to: this.requiredString(input.input.to, "to"),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "harvest.getTimeEntry") {
      action = "harvest_time_entry_get";
      data = await this.harvestApi.getTimeEntry(credentials, {
        timeEntryId: this.positiveInteger(
          input.input.timeEntryId,
          "timeEntryId",
        ),
      });
    } else if (name === "harvest.request") {
      action = "harvest_full_api";
      await this.requireConnectorApproval(input, connection, action, "harvest");
      data = await this.harvestApi.request(credentials, {
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
      eventType: `marketplace.harvest.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        timeEntryIdHash: input.input.timeEntryId
          ? this.hash(String(input.input.timeEntryId))
          : null,
        method: this.stringOrNull(input.input.method),
        pathHash: this.stringOrNull(input.input.path)
          ? this.hash(this.stringOrNull(input.input.path)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Harvest ${name.split(".")[1]} completed.`);
  },

  async executeHealthie(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "healthie",
      input.connectionId,
    );
    const credentials = this.healthieCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("healthie", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "healthie.query")
      data = await this.healthieGraphql.query(credentials, input.input);
    else if (name === "healthie.mutate") {
      await this.requireConnectorApproval(
        input,
        connection,
        "graphql_mutation",
        "healthie",
      );
      data = await this.healthieGraphql.mutate(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.healthie.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        operationName: this.stringOrNull(input.input.operationName),
      },
    });
    return this.ok(data, `Healthie ${name.split(".")[1]} completed.`);
  },

  async executeHive(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "hive",
      input.connectionId,
    );
    const credentials = this.hiveCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("hive", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "hive.read") {
      data = await this.hiveApi.read(credentials, input.input);
    } else if (name === "hive.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "api_write",
        "hive",
      );
      data = await this.hiveApi.write(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.hive.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "hive.read" ? "GET" : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `Hive ${name.split(".")[1]} completed.`);
  },

  async executeHomebase(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "homebase",
      input.connectionId,
    );
    const credentials = this.homebaseCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("homebase", input.toolName)!;
    if (tool.name !== "homebase.read") {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.homebaseApi.read(credentials, operation, {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.homebase.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Homebase read completed.");
  },

  async executeHotjar(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "hotjar",
      input.connectionId,
    );
    const credentials = this.hotjarCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("hotjar", input.toolName)!;
    if (tool.name !== "hotjar.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.hotjarApi.read(credentials, operation, {
      limit: input.input.limit,
      cursor: input.input.cursor,
      surveyId: input.input.surveyId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.hotjar.read.executed",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Hotjar read completed.");
  },

  async executeHubstaff(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "hubstaff",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("hubstaff", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    const operationInput = {
      pathParameters:
        this.objectOrNull(input.input.pathParameters) ?? undefined,
      query: this.objectOrNull(input.input.query) ?? undefined,
      json: this.objectOrNull(input.input.json) ?? undefined,
    };
    let data: unknown;
    if (tool.name === "hubstaff.read") {
      data = await this.hubstaffApi.read(
        token.accessToken,
        operation,
        operationInput,
      );
    } else if (tool.name === "hubstaff.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "hubstaff_manage",
        "hubstaff",
      );
      data = await this.hubstaffApi.manage(
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
      eventType: `marketplace.hubstaff.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Hubstaff ${tool.name.split(".")[1]} completed.`);
  },

  async executeJaneApp(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "jane-app",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.janeAppCredentials(
      token.credentials,
      connection.metadata,
    );
    const tool = this.registry.getTool("jane-app", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "jane-app.read") {
      data = await this.janeAppApi.read(credentials, input.input);
    } else if (name === "jane-app.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "jane_app_api_manage",
        "jane-app",
      );
      data = await this.janeAppApi.manage(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.jane-app.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          this.stringOrNull(input.input.method) ??
          (name === "jane-app.read" ? "GET" : null),
        path: this.stringOrNull(input.input.path),
        clinicOrigin: credentials.clinicOrigin,
      },
    });
    return this.ok(data, `Jane App ${name.split(".")[1]} completed.`);
  },

  async executeJira(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "jira",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const cloudId = this.stringOrNull(connection.metadata?.cloudId);
    if (!cloudId)
      return this.safeError(
        "connection_not_ready",
        "Jira connection is not bound to one Atlassian site.",
      );
    const tool = this.registry.getTool("jira", input.toolName)!;
    let data: unknown;
    if (tool.name === "jira.read") {
      data = await this.jiraApi.read(token.accessToken, cloudId, input.input);
    } else if (tool.name === "jira.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "jira_manage",
        "jira",
      );
      data = await this.jiraApi.manage(token.accessToken, cloudId, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.jira.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "jira.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        cloudId,
      },
    });
    return this.ok(data, `Jira ${tool.name.split(".")[1]} completed.`);
  },

  async executeJiraAlign(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "jira-align",
      input.connectionId,
    );
    const credentials = this.jiraAlignCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("jira-align", input.toolName)!;
    const path = this.requiredString(input.input.path, "path");
    const query =
      input.input.query &&
      typeof input.input.query === "object" &&
      !Array.isArray(input.input.query)
        ? (input.input.query as Record<string, unknown>)
        : undefined;
    let data: unknown;
    if (tool.name === "jira-align.read") {
      data = await this.jiraAlignApi.request(credentials, {
        method: "GET",
        path,
        query,
      });
    } else if (tool.name === "jira-align.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "jira_align_enterprise_planning_manage",
        "jira-align",
      );
      data = await this.jiraAlignApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path,
        query,
        json:
          input.input.json &&
          typeof input.input.json === "object" &&
          !Array.isArray(input.input.json)
            ? (input.input.json as Record<string, unknown>)
            : undefined,
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
      eventType: `marketplace.jira-align.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "jira-align.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path,
      },
    });
    return this.ok(data, `Jira Align ${tool.name.split(".")[1]} completed.`);
  },

  async executeJotform(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "jotform",
      input.connectionId,
    );
    const stored = this.credentials.decrypt(connection);
    const legacyApiKey = this.stringOrNull(stored.JOTFORM_API_KEY);
    const tool = this.registry.getTool("jotform", input.toolName)!;
    let data: unknown;
    let providerOperation: string;
    if (tool.name === "jotform.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "jotform_manage",
        "jotform",
      );
    } else if (tool.name !== "jotform.read") {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    if (legacyApiKey) {
      const credentials = this.jotformCredentials(stored);
      const operation = this.requiredString(input.input.operation, "operation");
      const operationInput = {
        pathParameters:
          this.objectOrNull(input.input.pathParameters) ?? undefined,
        query: this.objectOrNull(input.input.query) ?? undefined,
        form: this.objectOrNull(input.input.form) ?? undefined,
        json: input.input.json,
      };
      providerOperation = operation;
      data =
        tool.name === "jotform.read"
          ? await this.jotformApi.read(credentials, operation, operationInput)
          : await this.jotformApi.manage(
              credentials,
              operation,
              operationInput,
            );
    } else {
      const token = await this.oauth.refreshIfNeeded(connection);
      providerOperation =
        this.stringOrNull(input.input.toolName) ??
        this.requiredString(input.input.operation, "operation");
      data =
        tool.name === "jotform.read"
          ? await this.jotformMcp.callRead(token.accessToken, input.input)
          : await this.jotformMcp.callWrite(token.accessToken, input.input);
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.jotform.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerOperation,
        transport: legacyApiKey ? "legacy_api_key" : "hosted_mcp_oauth",
      },
    });
    return this.ok(data, `Jotform ${tool.name.split(".")[1]} completed.`);
  },

  async executeKantataOx(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "kantata-ox",
      input.connectionId,
    );
    const credentials = this.kantataOxCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("kantata-ox", input.toolName)!;
    if (tool.name !== "kantataOx.getSelectedWorkspaceState")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.kantataOxApi.getSelectedWorkspaceState(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.kantata-ox.getSelectedWorkspaceState.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        customerOwnedOAuthTokenRequired: true,
        selectedWorkspaceBound: true,
        fixedIndividualWorkspaceRouteOnly: true,
        contentFinancialsIdentitiesAndOtherAccountDataDiscarded: true,
        otherReadsAdministrationAndMutationsBlocked: true,
        credentialsLogged: false,
      },
    });
    return this.ok(data, "Kantata OX selected project state read completed.");
  },

  async executeLinear(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "linear",
      input.connectionId,
    );
    const tool = this.registry.getTool("linear", input.toolName)!;
    if (tool.name === "relay_linear_draft_issue_change") {
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
      const issueId = this.stringOrNull(input.input.issueId);
      if (operation === "update" && !issueId)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "issueId is required for an update draft",
        );
      const encoded = JSON.stringify({ operation, issueId, fields });
      if (encoded.length > 50_000)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "Linear issue draft is too large",
        );
      return this.ok(
        {
          operation,
          issueId,
          fields,
          payloadHash: this.hash(encoded),
          providerSideEffect: false,
        },
        "Linear issue change prepared locally.",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_linear_list_teams")
      return this.ok(
        await this.linearApi.listTeams(
          token.accessToken,
          input.input.maxResults,
        ),
        "Linear teams listed.",
      );
    if (tool.name === "relay_linear_search_issues")
      return this.ok(
        await this.linearApi.searchIssues(
          token.accessToken,
          input.input.query,
          input.input.teamId,
          input.input.maxResults,
        ),
        "Linear issues found.",
      );
    if (tool.name === "relay_linear_get_issue")
      return this.ok(
        await this.linearApi.getIssue(
          token.accessToken,
          input.input.issueId,
          input.input.maxComments,
        ),
        "Linear issue read.",
      );
    if (tool.name === "relay_linear_list_projects")
      return this.ok(
        await this.linearApi.listProjects(
          token.accessToken,
          input.input.maxResults,
        ),
        "Linear projects listed.",
      );
    if (tool.name === "relay_linear_create_issue") {
      await this.requireLinearApproval(
        input,
        connection,
        "linear_issue_create",
        input.input.teamId,
        input.input,
      );
      const result = await this.linearApi.createIssue(
        token.accessToken,
        input.input,
      );
      await this.auditLinearWrite(
        input,
        connection,
        "issue.created",
        input.input.teamId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Linear issue created.");
    }
    if (tool.name === "relay_linear_update_issue") {
      await this.requireLinearApproval(
        input,
        connection,
        "linear_issue_update",
        input.input.issueId,
        input.input,
      );
      const result = await this.linearApi.updateIssue(
        token.accessToken,
        input.input,
      );
      await this.auditLinearWrite(
        input,
        connection,
        "issue.updated",
        input.input.issueId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Linear issue updated.");
    }
    if (tool.name === "relay_linear_create_comment") {
      await this.requireLinearApproval(
        input,
        connection,
        "linear_comment_create",
        input.input.issueId,
        input.input,
      );
      const result = await this.linearApi.createComment(
        token.accessToken,
        input.input,
      );
      await this.auditLinearWrite(
        input,
        connection,
        "comment.created",
        input.input.issueId,
        input.input.idempotencyKey,
        result,
      );
      return this.ok(result, "Approved Linear comment posted.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeLiquidPlanner(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "liquidplanner",
      input.connectionId,
    );
    const credentials = this.liquidPlannerCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("liquidplanner", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "liquidplanner",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "liquidplanner.listWorkspaces")
      data = await this.liquidPlannerApi.listWorkspaces(credentials, payload);
    else if (tool.name === "liquidplanner.listItems")
      data = await this.liquidPlannerApi.listItems(credentials, payload);
    else if (tool.name === "liquidplanner.getItem")
      data = await this.liquidPlannerApi.getItem(credentials, payload);
    else if (tool.name === "liquidplanner.createTask")
      data = await this.liquidPlannerApi.createTask(credentials, payload);
    else if (tool.name === "liquidplanner.renameItem")
      data = await this.liquidPlannerApi.renameItem(credentials, payload);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.liquidplanner.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerWorkspaceIdHash: input.input.workspaceId
          ? this.hash(String(input.input.workspaceId))
          : null,
        parentIdHash: input.input.parentId
          ? this.hash(String(input.input.parentId))
          : null,
        itemIdHash: input.input.itemId
          ? this.hash(String(input.input.itemId))
          : null,
        itemType: input.input.itemType ?? null,
        limit: input.input.limit ?? null,
        namesLogged: false,
        descriptionsLogged: false,
        identitiesLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(data, `LiquidPlanner ${tool.name.split(".")[1]} completed.`);
  },

  async executeLookback(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "lookback",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("lookback", input.toolName)!;
    if (tool.name !== "lookback.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.lookbackMcp.callRead(
      token.accessToken,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.lookback.read.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        remoteToolName: this.stringOrNull(input.input.toolName),
        capability: tool.capability,
      },
    });
    return this.ok(data, "Lookback read completed.");
  },

  async executeMaze(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "maze",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("maze", input.toolName)!;
    if (tool.name !== "maze.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.mazeMcp.callRead(token.accessToken, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.maze.read.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        remoteToolName: this.stringOrNull(input.input.toolName),
        capability: tool.capability,
      },
    });
    return this.ok(data, "Maze read completed.");
  },

  async executeMeisterTask(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "meistertask",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("meistertask", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "meistertask.read") {
      data = await this.meisterTaskApi.read(token.accessToken, input.input);
    } else if (name === "meistertask.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "meistertask_api_manage",
        "meistertask",
      );
      data = await this.meisterTaskApi.manage(token.accessToken, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.meistertask.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        method:
          name === "meistertask.read"
            ? "GET"
            : this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
      },
    });
    return this.ok(data, `MeisterTask ${name.split(".")[1]} completed.`);
  },

  async executeMicrosoftBookings(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-bookings",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const binding = this.microsoftBookingsBinding(connection);
    const tool = this.registry.getTool("microsoft-bookings", input.toolName)!;
    let data: unknown;
    if (tool.name === "microsoft-bookings.getBusiness")
      data = await this.microsoftBookingsApi.getBusiness(
        token.accessToken,
        binding,
      );
    else if (tool.name === "microsoft-bookings.listServices")
      data = await this.microsoftBookingsApi.listServices(
        token.accessToken,
        binding,
      );
    else if (tool.name === "microsoft-bookings.getService")
      data = await this.microsoftBookingsApi.getService(
        token.accessToken,
        binding,
        input.input,
      );
    else if (tool.name === "microsoft-bookings.calendarView")
      data = await this.microsoftBookingsApi.calendarView(
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
      eventType: `marketplace.microsoft_bookings.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selectedBusinessIdHash: this.hash(binding.businessId),
        serviceIdHash: this.stringOrNull(input.input.serviceId)
          ? this.hash(this.stringOrNull(input.input.serviceId)!)
          : null,
        calendarRangeProvided:
          Boolean(this.stringOrNull(input.input.start)) &&
          Boolean(this.stringOrNull(input.input.end)),
        customerStaffContactNotesJoinExcluded: true,
        maxResults: 25,
        maxCalendarRangeDays: 7,
      },
    });
    return this.ok(
      data,
      `Microsoft Bookings ${tool.name.split(".")[1]} completed.`,
    );
  },
};

export const WorkManagementExecutors2Registrations = {
  "docusign-clm": { methodName: "executeDocuSignClm", needsConnection: false },
  dovetail: { methodName: "executeDovetail", needsConnection: false },
  everhour: { methodName: "executeEverhour", needsConnection: false },
  favro: { methodName: "executeFavro", needsConnection: false },
  fillout: { methodName: "executeFillout", needsConnection: false },
  formstack: { methodName: "executeFormstack", needsConnection: false },
  "google-calendar": {
    methodName: "executeGoogleCalendar",
    needsConnection: false,
  },
  "google-tasks": { methodName: "executeGoogleTasks", needsConnection: false },
  "gravity-forms": {
    methodName: "executeGravityForms",
    needsConnection: false,
  },
  habitica: { methodName: "executeHabitica", needsConnection: false },
  harvest: { methodName: "executeHarvest", needsConnection: false },
  healthie: { methodName: "executeHealthie", needsConnection: false },
  hive: { methodName: "executeHive", needsConnection: false },
  homebase: { methodName: "executeHomebase", needsConnection: false },
  hotjar: { methodName: "executeHotjar", needsConnection: false },
  hubstaff: { methodName: "executeHubstaff", needsConnection: false },
  "jane-app": { methodName: "executeJaneApp", needsConnection: false },
  jira: { methodName: "executeJira", needsConnection: false },
  "jira-align": { methodName: "executeJiraAlign", needsConnection: false },
  jotform: { methodName: "executeJotform", needsConnection: false },
  "kantata-ox": { methodName: "executeKantataOx", needsConnection: false },
  linear: { methodName: "executeLinear", needsConnection: false },
  liquidplanner: { methodName: "executeLiquidPlanner", needsConnection: false },
  lookback: { methodName: "executeLookback", needsConnection: false },
  maze: { methodName: "executeMaze", needsConnection: false },
  meistertask: { methodName: "executeMeisterTask", needsConnection: false },
  "microsoft-bookings": {
    methodName: "executeMicrosoftBookings",
    needsConnection: false,
  },
} satisfies NativeExecutorRegistrationMap<typeof WorkManagementExecutors2>;
