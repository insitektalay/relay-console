import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const CommunicationExecutors4 = {
  async executeTlDv(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "tl-dv",
      input.connectionId,
    );
    const credentials = this.tlDvCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("tl-dv", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "tlDv.listMeetings")
      data = await this.tlDvApi.listMeetings(credentials, input.input);
    else if (name === "tlDv.getMeeting")
      data = await this.tlDvApi.getMeeting(credentials, input.input);
    else if (name === "tlDv.getTranscript")
      data = await this.tlDvApi.getTranscript(credentials, input.input);
    else if (name === "tlDv.getNotes")
      data = await this.tlDvApi.getNotes(credentials, input.input);
    else if (name === "tlDv.getRecordingDownload")
      data = await this.tlDvApi.getRecordingDownload(credentials, input.input);
    else if (name === "tlDv.importMeeting") {
      await this.requireConnectorApproval(
        input,
        connection,
        "meeting_import",
        "tl-dv",
      );
      data = await this.tlDvApi.importMeeting(credentials, input.input);
    } else if (name === "tlDv.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "administration",
        "tl-dv",
      );
      data = await this.tlDvApi.request(credentials, {
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
      eventType: `marketplace.tl-dv.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        path: this.stringOrNull(input.input.path),
        meetingId: this.stringOrNull(input.input.meetingId),
        importUrlHost: this.safeUrlHost(this.stringOrNull(input.input.url)),
      },
    });
    return this.ok(data, `tl;dv ${name.split(".")[1]} completed.`);
  },

  async executeTwilio(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "twilio",
      input.connectionId,
    );
    const tool = this.registry.getTool("twilio", input.toolName)!;
    if (tool.name !== "relay_twilio_list_message_statuses")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const credentials = this.twilioCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const data = await this.twilioApi.listMessageStatuses(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.twilio.message_statuses_list.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        resultCount: data.count,
        truncated: data.truncated,
        privacyMasked: true,
        providerContentStored: false,
      },
    });
    return this.ok(data, "Twilio masked message-status read completed.");
  },

  async executeTwilioSegmentEngage(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "twilio-segment-engage",
      input.connectionId,
    );
    const credentials = this.twilioSegmentEngageCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "twilio-segment-engage",
      input.toolName,
    )!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "twilio-segment-engage",
      );
    const data = await this.twilioSegmentEngageApi.read(
      credentials,
      operation,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.twilio-segment-engage.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Twilio Segment Engage ${operation} completed.`);
  },

  async executeTwist(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "twist",
      input.connectionId,
    );
    const tool = this.registry.getTool("twist", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_twist_get_user") {
      await this.oauth.validateTwistUser(connection, token.accessToken);
      return this.ok(
        {
          userId: this.stringOrNull(connection.metadata?.twistUserId),
          displayName: this.stringOrNull(connection.metadata?.displayName),
          email: this.stringOrNull(connection.metadata?.email),
          verified: true,
        },
        "Twist connected user read completed.",
      );
    }
    if (tool.name === "relay_twist_list_workspaces") {
      const workspaces = await this.twistApi.listWorkspaces(
        token.accessToken,
        input.input.limit,
      );
      return this.ok(
        { workspaces, count: workspaces.length },
        "Twist workspaces read completed.",
      );
    }
    if (tool.name === "relay_twist_list_channels") {
      const channels = await this.twistApi.listChannels(
        token.accessToken,
        input.input.workspaceId,
        input.input.limit,
      );
      return this.ok(
        { channels, count: channels.length },
        "Twist workspace channels read completed.",
      );
    }
    if (tool.name === "relay_twist_list_inbox_threads") {
      const threads = await this.twistApi.listInboxThreads(
        token.accessToken,
        input.input.workspaceId,
        input.input.limit,
      );
      return this.ok(
        { threads, count: threads.length },
        "Twist inbox threads read completed.",
      );
    }
    if (tool.name === "relay_twist_get_thread_with_comments") {
      const result = await this.twistApi.getThreadWithComments(
        token.accessToken,
        input.input.threadId,
        input.input.commentLimit,
      );
      return this.ok(result, "Twist thread and comments read completed.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeUserlike(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "userlike",
      input.connectionId,
    );
    const credentials = this.userlikeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("userlike", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "userlike.listConversations") {
      action = "userlike_conversation_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "userlike",
      );
      data = await this.userlikeApi.listConversations(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "userlike.getConversation") {
      action = "userlike_conversation_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "userlike",
      );
      data = await this.userlikeApi.getConversation(
        credentials,
        Number(input.input.conversationId),
      );
    } else if (name === "userlike.request") {
      action = "userlike_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "userlike",
      );
      data = await this.userlikeApi.request(credentials, {
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
      eventType: `marketplace.userlike.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        conversationIdHash:
          typeof input.input.conversationId === "number"
            ? this.hash(String(input.input.conversationId))
            : null,
        method: this.stringOrNull(input.input.method),
        path: this.stringOrNull(input.input.path),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Userlike ${name.split(".")[1]} completed.`);
  },

  async executeVanillaForums(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vanilla-forums",
      input.connectionId,
    );
    const credentials = this.vanillaForumsCredentials(
      this.credentials.decrypt(connection),
      connection.metadata,
    );
    const tool = this.registry.getTool("vanilla-forums", input.toolName)!;
    const name = tool.name;
    const action = tool.functionName;
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "vanilla-forums",
    );
    let data: unknown;
    if (name === "vanillaForums.getCurrentUser")
      data = await this.vanillaForumsApi.getCurrentUser(credentials);
    else if (name === "vanillaForums.listCategories")
      data = await this.vanillaForumsApi.listCategories(
        credentials,
        input.input,
      );
    else if (name === "vanillaForums.listBadges")
      data = await this.vanillaForumsApi.listBadges(credentials, input.input);
    else if (name === "vanillaForums.listDiscussions")
      data = await this.vanillaForumsApi.listDiscussions(
        credentials,
        input.input,
      );
    else if (name === "vanillaForums.listUsers")
      data = await this.vanillaForumsApi.listUsers(credentials, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.vanilla-forums.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        siteOriginHash: this.hash(
          this.stringOrNull(connection.metadata?.vanillaForumsSiteOrigin) ??
            credentials.baseUrl,
        ),
        page: input.input.page ?? 1,
        maxResults: input.input.maxResults ?? 25,
      },
    });
    return this.ok(data, `Vanilla Forums ${name.split(".")[1]} completed.`);
  },

  async executeVero(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vero",
      input.connectionId,
    );
    const credentials = this.veroCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("vero", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "vero",
      );
    const data =
      tool.action === "read"
        ? await this.veroApi.read(credentials, operation, input.input)
        : await this.veroApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.vero.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Vero ${operation} completed.`);
  },

  async executeVonage(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vonage",
      input.connectionId,
    );
    const tool = this.registry.getTool("vonage", input.toolName)!;
    if (tool.name !== "relay_vonage_get_account_balance")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const credentials = this.vonageCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const data = await this.vonageApi.getBalance(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.vonage.account_balance_get.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        currency: "EUR",
        providerContentStored: false,
      },
    });
    return this.ok(data, "Vonage account balance read completed.");
  },

  async executeWebex(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "webex",
      input.connectionId,
    );
    const tool = this.registry.getTool("webex", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_webex_get_person") {
      await this.oauth.validateWebexPerson(connection, token.accessToken);
      return this.ok(
        {
          displayName: this.stringOrNull(connection.metadata?.displayName),
          verified: connection.metadata?.personVerified === true,
          personBindingVerified: true,
        },
        "Webex connected Person read completed.",
      );
    }
    if (tool.name === "relay_webex_list_meetings") {
      const result = await this.webexApi.listMeetings(
        token.accessToken,
        input.input.limit,
      );
      return this.ok(
        {
          meetings: result.meetings,
          count: result.meetings.length,
          truncated: result.truncated,
        },
        "Webex Meetings read completed.",
      );
    }
    if (tool.name === "relay_webex_get_meeting") {
      const meeting = await this.webexApi.getMeeting(
        token.accessToken,
        input.input.meetingId,
      );
      return this.ok(meeting, "Webex Meeting read completed.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeWebexCalling(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "webex-calling",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("webex-calling", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      "number_inventory",
      "webex-calling",
    );
    if (tool.name !== "webexCalling.listNumbers")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.webexCallingApi.listNumbers(
      token.accessToken,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.webex-calling.listNumbers.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerSideEffect: false,
      },
    });
    return this.ok(data, "Webex Calling masked number inventory completed.");
  },

  async executeYammer(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "yammer",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("yammer", input.toolName)!;
    if (tool.name !== "yammer.getSignedInIdentity")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.yammerApi.read(token.accessToken, operation);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.yammer.identity_read",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Yammer signed-in identity read.");
  },

  async executeZoom(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoom",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("zoom", input.toolName)!;
    let data: unknown;
    if (tool.name === "zoom.listScheduledMeetings")
      data = await this.zoomApi.listScheduledMeetings(token.accessToken);
    else if (tool.name === "zoom.listLiveMeetings")
      data = await this.zoomApi.listLiveMeetings(token.accessToken);
    else if (tool.name === "zoom.listUpcomingMeetings")
      data = await this.zoomApi.listUpcomingMeetings(token.accessToken);
    else if (tool.name === "zoom.getMeeting")
      data = await this.zoomApi.getMeeting(
        token.accessToken,
        input.input.meetingId,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.zoom.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        selfUserOnly: true,
        joinStartCredentialsPeopleContentExcluded: true,
        maxResults: 25,
      },
    });
    return this.ok(data, `Zoom ${tool.name.split(".")[1]} completed.`);
  },

  async executeZoomEvents(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoom-events",
      input.connectionId,
    );
    const credentials = this.zoomEventsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("zoom-events", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      "lifecycle_read",
      "zoom-events",
    );
    if (tool.name !== "zoomEvents.listLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.zoomEventsApi.listLifecycle(
      credentials,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.zoom-events.listLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerSideEffect: false,
      },
    });
    return this.ok(data, "Zoom Events lifecycle metadata completed.");
  },

  async executeZoomPhone(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoom-phone",
      input.connectionId,
    );
    const credentials = this.zoomPhoneCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("zoom-phone", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      "number_inventory",
      "zoom-phone",
    );
    if (tool.name !== "zoomPhone.listNumbers")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.zoomPhoneApi.listNumbers(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.zoom-phone.listNumbers.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        allocatedProduct: "ZOOM_PHONE",
        providerSideEffect: false,
      },
    });
    return this.ok(data, "Zoom Phone number inventory completed.");
  },

  async executeZoomRooms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoom-rooms",
      input.connectionId,
    );
    const credentials = this.zoomRoomsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("zoom-rooms", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      "fleet_health",
      "zoom-rooms",
    );
    if (tool.name !== "zoomRooms.listFleetHealth")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.zoomRoomsApi.listFleetHealth(
      credentials,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.zoom-rooms.listFleetHealth.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerSideEffect: false,
      },
    });
    return this.ok(data, "Zoom Rooms fleet health completed.");
  },

  async executeZoomWebinars(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoom-webinars",
      input.connectionId,
    );
    const credentials = this.zoomWebinarsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("zoom-webinars", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      "lifecycle_read",
      "zoom-webinars",
    );
    if (tool.name !== "zoomWebinars.listLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.zoomWebinarsApi.listLifecycle(
      credentials,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.zoom-webinars.listLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerSideEffect: false,
      },
    });
    return this.ok(data, "Zoom Webinars lifecycle metadata completed.");
  },
};

export const CommunicationExecutors4Registrations = {
  "tl-dv": { methodName: "executeTlDv", needsConnection: false },
  twilio: { methodName: "executeTwilio", needsConnection: false },
  "twilio-segment-engage": {
    methodName: "executeTwilioSegmentEngage",
    needsConnection: false,
  },
  twist: { methodName: "executeTwist", needsConnection: false },
  userlike: { methodName: "executeUserlike", needsConnection: false },
  "vanilla-forums": {
    methodName: "executeVanillaForums",
    needsConnection: false,
  },
  vero: { methodName: "executeVero", needsConnection: false },
  vonage: { methodName: "executeVonage", needsConnection: false },
  webex: { methodName: "executeWebex", needsConnection: false },
  "webex-calling": {
    methodName: "executeWebexCalling",
    needsConnection: false,
  },
  yammer: { methodName: "executeYammer", needsConnection: false },
  zoom: { methodName: "executeZoom", needsConnection: false },
  "zoom-events": { methodName: "executeZoomEvents", needsConnection: false },
  "zoom-phone": { methodName: "executeZoomPhone", needsConnection: false },
  "zoom-rooms": { methodName: "executeZoomRooms", needsConnection: false },
  "zoom-webinars": {
    methodName: "executeZoomWebinars",
    needsConnection: false,
  },
} satisfies NativeExecutorRegistrationMap<typeof CommunicationExecutors4>;
