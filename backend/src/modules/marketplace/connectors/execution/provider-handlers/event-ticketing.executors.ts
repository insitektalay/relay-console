import type { NativeExecutorRegistrationMap } from "../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import type {
  MarketplaceConnectorExecutorRequest,
  MarketplaceConnectorExecutorResult,
} from "../../types";

export const EVENT_TICKETING_EXECUTORS = {
  async executeAirmeet(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "airmeet",
      input.connectionId,
    );
    const credentials = runtime.airmeetCredentials(
      runtime.credentials.decrypt(connection),
    );
    const tool = runtime.registry.getTool("airmeet", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_airmeet_list_events") {
      data = await runtime.airmeetApi.listEvents(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (tool.name === "relay_airmeet_list_sessions") {
      data = await runtime.airmeetApi.listSessions(credentials, {
        eventId: runtime.requiredString(input.input.eventId, "eventId"),
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.airmeet.${tool.name.endsWith("list_events") ? "events_list" : "sessions_list"}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        region: credentials.region,
        eventIdHash: runtime.stringOrNull(input.input.eventId)
          ? runtime.hash(runtime.stringOrNull(input.input.eventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(
      data,
      `Airmeet ${tool.name.endsWith("list_events") ? "event list" : "session list"} completed.`,
    );
  },

  async executeSplash(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "splash",
      input.connectionId,
    );
    const credentials = runtime.splashCredentials(
      runtime.credentials.decrypt(connection),
    );
    const tool = runtime.registry.getTool("splash", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_splash_list_events")
      data = await runtime.splashApi.listEvents(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_splash_get_event")
      data = await runtime.splashApi.getEvent(credentials, {
        eventId: runtime.requiredString(input.input.eventId, "eventId"),
      });
    else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.splash.${tool.name.endsWith("list_events") ? "events_list" : "event_get"}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        eventIdHash: runtime.stringOrNull(input.input.eventId)
          ? runtime.hash(runtime.stringOrNull(input.input.eventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(
      data,
      `Splash ${tool.name.endsWith("list_events") ? "event list" : "event read"} completed.`,
    );
  },

  async executeCvent(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "cvent",
      input.connectionId,
    );
    const credentials = runtime.cventCredentials(
      runtime.credentials.decrypt(connection),
    );
    const tool = runtime.registry.getTool("cvent", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_cvent_list_events")
      data = await runtime.cventApi.listEvents(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_cvent_get_event")
      data = await runtime.cventApi.getEvent(credentials, {
        eventId: runtime.requiredString(input.input.eventId, "eventId"),
      });
    else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.cvent.${tool.name.endsWith("list_events") ? "events_list" : "event_get"}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        region: credentials.region,
        eventIdHash: runtime.stringOrNull(input.input.eventId)
          ? runtime.hash(runtime.stringOrNull(input.input.eventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(
      data,
      `Cvent ${tool.name.endsWith("list_events") ? "event list" : "event read"} completed.`,
    );
  },

  async executeBizzabo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "bizzabo",
      input.connectionId,
    );
    const credentials = runtime.eventPlatformCredentials(
      runtime.credentials.decrypt(connection),
      "BIZZABO_API_KEY",
    );
    const tool = runtime.registry.getTool("bizzabo", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_bizzabo_list_events")
      data = await runtime.bizzaboApi.listEvents(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_bizzabo_get_event")
      data = await runtime.bizzaboApi.getEvent(credentials, {
        eventId: runtime.requiredString(input.input.eventId, "eventId"),
      });
    else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.bizzabo.${tool.name.endsWith("list_events") ? "events_list" : "event_get"}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        eventIdHash: runtime.stringOrNull(input.input.eventId)
          ? runtime.hash(runtime.stringOrNull(input.input.eventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(
      data,
      `Bizzabo ${tool.name.endsWith("list_events") ? "event list" : "event read"} completed.`,
    );
  },

  async executeGoldcast(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "goldcast",
      input.connectionId,
    );
    const credentials = runtime.eventPlatformCredentials(
      runtime.credentials.decrypt(connection),
      "GOLDCAST_API_TOKEN",
    );
    const tool = runtime.registry.getTool("goldcast", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_goldcast_list_events")
      data = await runtime.goldcastApi.listEvents(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_goldcast_get_event")
      data = await runtime.goldcastApi.getEvent(credentials, {
        eventId: runtime.requiredString(input.input.eventId, "eventId"),
      });
    else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.goldcast.${tool.name.endsWith("list_events") ? "events_list" : "event_get"}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        eventIdHash: runtime.stringOrNull(input.input.eventId)
          ? runtime.hash(runtime.stringOrNull(input.input.eventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(
      data,
      `Goldcast ${tool.name.endsWith("list_events") ? "event list" : "event read"} completed.`,
    );
  },

  async executeEventzilla(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "eventzilla",
      input.connectionId,
    );
    const credentials = runtime.eventPlatformCredentials(
      runtime.credentials.decrypt(connection),
      "EVENTZILLA_API_KEY",
    );
    const tool = runtime.registry.getTool("eventzilla", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_eventzilla_list_events")
      data = await runtime.eventzillaApi.listEvents(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_eventzilla_get_event")
      data = await runtime.eventzillaApi.getEvent(credentials, {
        eventId: runtime.requiredString(input.input.eventId, "eventId"),
      });
    else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.eventzilla.${tool.name.endsWith("list_events") ? "events_list" : "event_get"}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        eventIdHash: runtime.stringOrNull(input.input.eventId)
          ? runtime.hash(runtime.stringOrNull(input.input.eventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(
      data,
      `Eventzilla ${tool.name.endsWith("list_events") ? "event list" : "event read"} completed.`,
    );
  },

  async executeTicketTailor(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ticket-tailor",
      input.connectionId,
    );
    const credentials = runtime.eventPlatformCredentials(
      runtime.credentials.decrypt(connection),
      "TICKET_TAILOR_API_KEY",
    );
    const tool = runtime.registry.getTool("ticket-tailor", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_ticket_tailor_list_events")
      data = await runtime.ticketTailorApi.listEvents(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_ticket_tailor_get_event")
      data = await runtime.ticketTailorApi.getEvent(credentials, {
        eventId: runtime.requiredString(input.input.eventId, "eventId"),
      });
    else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.ticket_tailor.${tool.name.endsWith("list_events") ? "events_list" : "event_get"}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        eventIdHash: runtime.stringOrNull(input.input.eventId)
          ? runtime.hash(runtime.stringOrNull(input.input.eventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(
      data,
      `Ticket Tailor ${tool.name.endsWith("list_events") ? "event list" : "event read"} completed.`,
    );
  },

  async executeHumanitix(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "humanitix",
      input.connectionId,
    );
    const credentials = runtime.eventPlatformCredentials(
      runtime.credentials.decrypt(connection),
      "HUMANITIX_API_KEY",
    );
    const tool = runtime.registry.getTool("humanitix", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_humanitix_list_events")
      data = await runtime.humanitixApi.listEvents(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_humanitix_get_event")
      data = await runtime.humanitixApi.getEvent(credentials, {
        eventId: runtime.requiredString(input.input.eventId, "eventId"),
      });
    else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.humanitix.${tool.name.endsWith("list_events") ? "events_list" : "event_get"}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        eventIdHash: runtime.stringOrNull(input.input.eventId)
          ? runtime.hash(runtime.stringOrNull(input.input.eventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(
      data,
      `Humanitix ${tool.name.endsWith("list_events") ? "event list" : "event read"} completed.`,
    );
  },

  async executeBuildium(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "buildium",
      input.connectionId,
    );
    const credentials = runtime.buildiumCredentials(
      runtime.credentials.decrypt(connection),
    );
    const tool = runtime.registry.getTool("buildium", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_buildium_list_rentals")
      data = await runtime.buildiumApi.listRentals(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_buildium_get_rental")
      data = await runtime.buildiumApi.getRental(credentials, {
        rentalId: runtime.positiveInteger(input.input.rentalId, "rentalId"),
      });
    else if (tool.name === "relay_buildium_list_units")
      data = await runtime.buildiumApi.listUnits(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_buildium_get_unit")
      data = await runtime.buildiumApi.getUnit(credentials, {
        unitId: runtime.positiveInteger(input.input.unitId, "unitId"),
      });
    else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.buildium.${tool.name.replace("relay_buildium_", "")}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        rentalIdHash:
          typeof input.input.rentalId === "number"
            ? runtime.hash(String(input.input.rentalId))
            : null,
        unitIdHash:
          typeof input.input.unitId === "number"
            ? runtime.hash(String(input.input.unitId))
            : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(data, "Buildium property inventory read completed.");
  },

  async executeSessionize(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sessionize",
      input.connectionId,
    );
    const credentials = runtime.sessionizeCredentials(
      runtime.credentials.decrypt(connection),
    );
    const tool = runtime.registry.getTool("sessionize", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_sessionize_list_sessions")
      data = await runtime.sessionizeApi.listSessions(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_sessionize_get_session")
      data = await runtime.sessionizeApi.getSession(credentials, {
        sessionId: runtime.requiredString(input.input.sessionId, "sessionId"),
      });
    else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.sessionize.${tool.name.endsWith("list_sessions") ? "sessions_list" : "session_get"}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        sessionIdHash: runtime.stringOrNull(input.input.sessionId)
          ? runtime.hash(runtime.stringOrNull(input.input.sessionId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(
      data,
      `Sessionize ${tool.name.endsWith("list_sessions") ? "session list" : "session read"} completed.`,
    );
  },

  async executePretix(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "pretix",
      input.connectionId,
    );
    const credentials = runtime.pretixCredentials(
      runtime.credentials.decrypt(connection),
    );
    const tool = runtime.registry.getTool("pretix", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_pretix_list_events")
      data = await runtime.pretixApi.listEvents(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    else if (tool.name === "relay_pretix_get_event")
      data = await runtime.pretixApi.getEvent(credentials, {
        eventId: runtime.requiredString(input.input.eventId, "eventId"),
      });
    else
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.pretix.${tool.name.endsWith("list_events") ? "events_list" : "event_get"}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        organizerHash: runtime.hash(credentials.organizer),
        eventIdHash: runtime.stringOrNull(input.input.eventId)
          ? runtime.hash(runtime.stringOrNull(input.input.eventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(
      data,
      `pretix ${tool.name.endsWith("list_events") ? "event list" : "event read"} completed.`,
    );
  },

  async executeDonorbox(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const runtime = this.eventTicketingRuntime();
    const connection = await runtime.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "donorbox",
      input.connectionId,
    );
    const credentials = runtime.donorboxCredentials(
      runtime.credentials.decrypt(connection),
    );
    const tool = runtime.registry.getTool("donorbox", input.toolName)!;
    if (tool.name !== "relay_donorbox_list_campaigns")
      return runtime.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await runtime.donorboxApi.listCampaigns(credentials, {
      limit:
        typeof input.input.limit === "number" ? input.input.limit : undefined,
    });
    await runtime.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.donorbox.campaigns_list.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        accountEmailHash: runtime.hash(credentials.accountEmail.toLowerCase()),
        limit: input.input.limit ?? null,
      },
    });
    return runtime.ok(data, "Donorbox campaign list completed.");
  },
} satisfies Record<
  string,
  (
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) => Promise<MarketplaceConnectorExecutorResult>
>;

export const EventTicketingExecutorRegistrations = {
  airmeet: { methodName: "executeAirmeet", needsConnection: false },
  splash: { methodName: "executeSplash", needsConnection: false },
  cvent: { methodName: "executeCvent", needsConnection: false },
  bizzabo: { methodName: "executeBizzabo", needsConnection: false },
  goldcast: { methodName: "executeGoldcast", needsConnection: false },
  eventzilla: { methodName: "executeEventzilla", needsConnection: false },
  "ticket-tailor": {
    methodName: "executeTicketTailor",
    needsConnection: false,
  },
  humanitix: { methodName: "executeHumanitix", needsConnection: false },
  buildium: { methodName: "executeBuildium", needsConnection: false },
  sessionize: { methodName: "executeSessionize", needsConnection: false },
  pretix: { methodName: "executePretix", needsConnection: false },
  donorbox: { methodName: "executeDonorbox", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof EVENT_TICKETING_EXECUTORS>;
