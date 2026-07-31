import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const CommunicationExecutors2 = {
  async executeGoogleChat(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-chat",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-chat", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "googleChat.prepareMessage")
      data = this.googleChatApi.prepareMessage(input.input);
    else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "googleChat.getSpace")
        data = await this.googleChatApi.getSpace(
          token.accessToken,
          input.input,
        );
      else if (name === "googleChat.listMessages")
        data = await this.googleChatApi.listMessages(
          token.accessToken,
          input.input,
        );
      else if (name === "googleChat.createMessage") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_chat_message_create",
          "google-chat",
        );
        data = await this.googleChatApi.createMessage(
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
      eventType: `marketplace.google-chat.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        spaceNameHash: this.stringOrNull(input.input.spaceName)
          ? this.hash(this.stringOrNull(input.input.spaceName)!)
          : null,
        threadNameHash: this.stringOrNull(input.input.threadName)
          ? this.hash(this.stringOrNull(input.input.threadName)!)
          : null,
        requestId: this.stringOrNull(input.input.requestId),
        userAuthOnly: true,
        explicitSpacesOnly: true,
        senderIdentityAccessed: false,
        richOrPrivateContentAccessed: false,
        automaticPagination: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Chat ${name.split(".")[1]} completed.`);
  },

  async executeGoogleContacts(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-contacts",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-contacts", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "googleContacts.prepareUpdate")
      data = this.googleContactsApi.prepareUpdate(input.input);
    else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "googleContacts.listContacts")
        data = await this.googleContactsApi.listContacts(token.accessToken);
      else if (name === "googleContacts.getContact")
        data = await this.googleContactsApi.getContact(
          token.accessToken,
          input.input,
        );
      else if (name === "googleContacts.createContact") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_contacts_contact_create",
          "google-contacts",
        );
        data = await this.googleContactsApi.createContact(
          token.accessToken,
          input.input,
        );
      } else if (name === "googleContacts.updateContact") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_contacts_contact_patch",
          "google-contacts",
        );
        data = await this.googleContactsApi.updateContact(
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
      eventType: `marketplace.google-contacts.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        resourceNameHash: this.stringOrNull(input.input.resourceName)
          ? this.hash(this.stringOrNull(input.input.resourceName)!)
          : null,
        idempotencyKey: this.stringOrNull(input.input.idempotencyKey),
        contactSourceOnly: true,
        broadPersonalFieldsAccessed: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Contacts ${name.split(".")[1]} completed.`);
  },

  async executeGoogleMeet(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-meet",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-meet", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "googleMeet.prepareSpaceUpdate")
      data = this.googleMeetApi.prepareSpaceUpdate(input.input);
    else {
      const token = await this.oauth.refreshIfNeeded(connection);
      if (name === "googleMeet.getSpace")
        data = await this.googleMeetApi.getSpace(
          token.accessToken,
          input.input,
        );
      else if (name === "googleMeet.createSpace") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_meet_space_create",
          "google-meet",
        );
        data = await this.googleMeetApi.createSpace(
          token.accessToken,
          input.input,
        );
      } else if (name === "googleMeet.updateSpace") {
        await this.requireConnectorApproval(
          input,
          connection,
          "google_meet_space_patch",
          "google-meet",
        );
        data = await this.googleMeetApi.updateSpace(
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
      eventType: `marketplace.google-meet.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        spaceNameHash: this.stringOrNull(input.input.spaceName)
          ? this.hash(this.stringOrNull(input.input.spaceName)!)
          : null,
        appCreatedSpacesOnly: true,
        participantsAccessed: false,
        conferenceRecordsAccessed: false,
        artifactsAccessed: false,
        dialInSipAccessed: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Meet ${name.split(".")[1]} completed.`);
  },

  async executeGoToMeeting(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "goto-meeting",
      input.connectionId,
    );
    const tool = this.registry.getTool("goto-meeting", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_goto_meeting_get_identity") {
      await this.oauth.validateGoToMeetingIdentity(
        connection,
        token.accessToken,
      );
      return this.ok(
        {
          displayName: this.stringOrNull(connection.metadata?.displayName),
          verified: true,
          organizerBindingVerified: true,
        },
        "GoTo connected organizer read completed.",
      );
    }
    const organizerKey = this.stringOrNull(
      connection.metadata?.gotoOrganizerKey,
    );
    if (!organizerKey)
      return this.safeError(
        "provider_validation_error",
        "GoTo organizer binding is missing",
      );
    if (tool.name === "relay_goto_meeting_list_upcoming_meetings") {
      const result = await this.goToMeetingApi.listUpcomingMeetings(
        token.accessToken,
        organizerKey,
        input.input.limit,
      );
      return this.ok(
        {
          meetings: result.meetings,
          count: result.meetings.length,
          truncated: result.truncated,
        },
        "GoTo upcoming Meetings read completed.",
      );
    }
    if (tool.name === "relay_goto_meeting_get_meeting") {
      const meeting = await this.goToMeetingApi.getMeeting(
        token.accessToken,
        organizerKey,
        input.input.meetingId,
      );
      return this.ok(meeting, "GoTo Meeting read completed.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeGoToWebinar(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "goto-webinar",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("goto-webinar", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      "lifecycle_read",
      "goto-webinar",
    );
    if (tool.name !== "gotoWebinar.listLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.goToWebinarApi.listLifecycle(
      token.accessToken,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.goto-webinar.listLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerSideEffect: false,
      },
    });
    return this.ok(data, "GoTo Webinar lifecycle metadata completed.");
  },

  async executeGrain(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "grain",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("grain", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "grain.read") {
      data = await this.grainMcp.callRead(token.accessToken, input.input);
    } else if (name === "grain.write") {
      await this.requireConnectorApproval(
        input,
        connection,
        "content_management",
        "grain",
      );
      data = await this.grainMcp.callWrite(token.accessToken, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.grain.${name.split(".")[1]}.executed`,
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
    return this.ok(data, `Grain ${name.split(".")[1]} completed.`);
  },

  async executeHigherLogic(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "higher-logic",
      input.connectionId,
    );
    const credentials = this.higherLogicCredentials(
      this.credentials.decrypt(connection),
      connection.metadata,
    );
    const tool = this.registry.getTool("higher-logic", input.toolName)!;
    const name = tool.name;
    const action = tool.functionName;
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "higher-logic",
    );
    let data: unknown;
    if (name === "higherLogic.getCurrentContact")
      data = await this.higherLogicApi.getCurrentContact(credentials);
    else if (name === "higherLogic.listMyCommunities")
      data = await this.higherLogicApi.listMyCommunities(
        credentials,
        input.input,
      );
    else if (name === "higherLogic.listViewableCommunities")
      data = await this.higherLogicApi.listViewableCommunities(
        credentials,
        input.input,
      );
    else if (name === "higherLogic.listContributableCommunities")
      data = await this.higherLogicApi.listContributableCommunities(
        credentials,
        input.input,
      );
    else if (name === "higherLogic.listEligibleDiscussions")
      data = await this.higherLogicApi.listEligibleDiscussions(
        credentials,
        input.input,
      );
    else if (name === "higherLogic.listUpcomingEvents")
      data = await this.higherLogicApi.listUpcomingEvents(
        credentials,
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
      eventType: `marketplace.higher_logic.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        region: credentials.region,
        configuredContactKeyHash: this.hash(credentials.contactKey),
        maxResults: input.input.maxResults ?? 25,
      },
    });
    return this.ok(data, `Higher Logic ${name.split(".")[1]} completed.`);
  },

  async executeHivebrite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "hivebrite",
      input.connectionId,
    );
    const credentials = this.hivebriteCredentials(
      this.credentials.decrypt(connection),
      connection.metadata,
    );
    const tool = this.registry.getTool("hivebrite", input.toolName)!;
    const name = tool.name;
    const action = tool.functionName;
    await this.requireConnectorApproval(input, connection, action, "hivebrite");
    let data: unknown;
    if (name === "hivebrite.getCurrentAdmin")
      data = await this.hivebriteApi.getCurrentAdmin(credentials);
    else if (name === "hivebrite.listGroups")
      data = await this.hivebriteApi.listGroups(credentials, input.input);
    else if (name === "hivebrite.listNewsCategories")
      data = await this.hivebriteApi.listNewsCategories(
        credentials,
        input.input,
      );
    else if (name === "hivebrite.listEvents")
      data = await this.hivebriteApi.listEvents(credentials, input.input);
    else if (name === "hivebrite.listCompanies")
      data = await this.hivebriteApi.listCompanies(credentials, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.hivebrite.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        tenantOriginHash: this.hash(credentials.baseUrl),
        configuredAdminIdHash: this.hash(credentials.adminId),
        page: input.input.page ?? 1,
        maxResults: input.input.maxResults ?? 25,
      },
    });
    return this.ok(data, `Hivebrite ${name.split(".")[1]} completed.`);
  },

  async executeHootsuite(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "hootsuite",
      input.connectionId,
    );
    const credentials = this.hootsuiteCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("hootsuite", input.toolName)!;
    let data: unknown;
    if (tool.name === "hootsuite.getAccountStatus")
      data = await this.hootsuiteApi.getAccountStatus(credentials);
    else if (tool.name === "hootsuite.listSocialProfileIds")
      data = await this.hootsuiteApi.listSocialProfileIds(credentials);
    else if (tool.name === "hootsuite.getSocialProfileStatus")
      data = await this.hootsuiteApi.getSocialProfileStatus(
        credentials,
        this.requiredString(input.input.socialProfileId, "socialProfileId"),
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Hootsuite redacted metadata read completed.");
  },

  async executeHopin(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "hopin",
      input.connectionId,
    );
    const credentials = this.hopinCredentials(
      this.credentials.decrypt(connection),
    );
    const boundOrganizationId = this.stringOrNull(
      connection.metadata?.ringCentralEventsOrganizationId,
    );
    if (
      boundOrganizationId !== credentials.organizationId ||
      connection.metadata?.ringCentralEventsApiOrigin !==
        "https://api.events.ringcentral.com" ||
      connection.metadata?.organizationBindingVerified !== true
    ) {
      throw new ConnectorExecutionError(
        "credential_missing",
        "RingCentral Events token, Organization binding, or fixed API origin is missing.",
      );
    }
    const tool = this.registry.getTool("hopin", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_hopin_get_organization")
      data = await this.hopinApi.getOrganization(credentials);
    else if (tool.name === "relay_hopin_list_organization_events")
      data = await this.hopinApi.listOrganizationEvents(
        credentials,
        input.input.limit,
      );
    else if (tool.name === "relay_hopin_get_event")
      data = await this.hopinApi.getEvent(credentials, input.input.eventId);
    else if (tool.name === "relay_hopin_list_event_schedule_items")
      data = await this.hopinApi.listEventScheduleItems(
        credentials,
        input.input.eventId,
        input.input.limit,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.hopin.${tool.name.replace("relay_hopin_", "")}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        organizationIdHash: this.hash(credentials.organizationId),
        eventIdHash: this.stringOrNull(input.input.eventId)
          ? this.hash(this.stringOrNull(input.input.eventId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(
      data,
      `RingCentral Events ${tool.name.replace("relay_hopin_", "")} completed.`,
    );
  },

  async executeIterable(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "iterable",
      input.connectionId,
    );
    const credentials = this.iterableCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("iterable", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "iterable",
      );
    const data =
      tool.action === "read"
        ? await this.iterableApi.read(credentials, operation, input.input)
        : await this.iterableApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.iterable.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Iterable ${operation} completed.`);
  },

  async executeIterableSms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "iterable-sms",
      input.connectionId,
    );
    const credentials = this.iterableSmsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("iterable-sms", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "iterable-sms",
      );
    const data =
      tool.action === "read"
        ? await this.iterableSmsApi.read(credentials, operation, input.input)
        : await this.iterableSmsApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.iterable_sms.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Iterable SMS ${operation} completed.`);
  },

  async executeKajabiCommunities(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "kajabi-communities",
      input.connectionId,
    );
    const credentials = this.kajabiCommunitiesCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("kajabi-communities", input.toolName)!;
    const name = tool.name;
    const action = tool.functionName;
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "kajabi-communities",
    );
    let data: unknown;
    if (name === "kajabiCommunities.listSites")
      data = await this.kajabiCommunitiesApi.listSites(
        credentials,
        input.input,
      );
    else if (name === "kajabiCommunities.listProducts")
      data = await this.kajabiCommunitiesApi.listProducts(
        credentials,
        input.input,
      );
    else if (name === "kajabiCommunities.getProduct")
      data = await this.kajabiCommunitiesApi.getProduct(
        credentials,
        input.input,
      );
    else if (name === "kajabiCommunities.listOffers")
      data = await this.kajabiCommunitiesApi.listOffers(
        credentials,
        input.input,
      );
    else if (name === "kajabiCommunities.listOfferProducts")
      data = await this.kajabiCommunitiesApi.listOfferProducts(
        credentials,
        input.input,
      );
    else if (name === "kajabiCommunities.listContacts")
      data = await this.kajabiCommunitiesApi.listContacts(
        credentials,
        input.input,
      );
    else if (name === "kajabiCommunities.listContactOffers")
      data = await this.kajabiCommunitiesApi.listContactOffers(
        credentials,
        input.input,
      );
    else if (name === "kajabiCommunities.grantOffer")
      data = await this.kajabiCommunitiesApi.grantOffer(
        credentials,
        input.input,
      );
    else if (name === "kajabiCommunities.revokeOffer")
      data = await this.kajabiCommunitiesApi.revokeOffer(
        credentials,
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
      eventType: `marketplace.kajabi_communities.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        kajabiUserIdHash: this.stringOrNull(connection.metadata?.kajabiUserId)
          ? this.hash(this.stringOrNull(connection.metadata?.kajabiUserId)!)
          : null,
        siteIdHash: this.stringOrNull(input.input.siteId)
          ? this.hash(this.stringOrNull(input.input.siteId)!)
          : null,
        productIdHash: this.stringOrNull(input.input.productId)
          ? this.hash(this.stringOrNull(input.input.productId)!)
          : null,
        offerIdHash: this.stringOrNull(input.input.offerId)
          ? this.hash(this.stringOrNull(input.input.offerId)!)
          : null,
        contactIdHash: this.stringOrNull(input.input.contactId)
          ? this.hash(this.stringOrNull(input.input.contactId)!)
          : null,
        page: input.input.page ?? 1,
        maxResults: input.input.maxResults ?? 25,
      },
    });
    return this.ok(data, `Kajabi Communities ${name.split(".")[1]} completed.`);
  },

  async executeKhoros(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "khoros",
      input.connectionId,
    );
    const credentials = this.khorosCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("khoros", input.toolName)!;
    if (tool.name !== "khoros.getMarketingCompanyAuthority")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.khorosApi.getCompanyAuthority(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Khoros Marketing company-authority read completed.");
  },

  async executeKlaviyo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "klaviyo",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.klaviyoCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("klaviyo", input.toolName)!;
    let data: unknown;
    if (tool.name === "klaviyo.getAccount") {
      data = await this.klaviyoApi.getAccount(credentials);
    } else if (tool.name === "klaviyo.listRecentLists") {
      data = await this.klaviyoApi.listRecentLists(credentials);
    } else if (tool.name === "klaviyo.listRecentEmailCampaigns") {
      data = await this.klaviyoApi.listRecentEmailCampaigns(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.klaviyo.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        accountIdHash: this.hash(credentials.accountId),
      },
    });
    return this.ok(data, `Klaviyo ${tool.name.split(".")[1]} completed.`);
  },

  async executeKlaviyoSms(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "klaviyo-sms",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.klaviyoSmsCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("klaviyo-sms", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "klaviyo-sms",
      );
    const data = await this.klaviyoSmsApi.request(
      credentials,
      operation,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.klaviyo_sms.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Klaviyo SMS ${operation} completed.`);
  },

  async executeLater(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "later",
      input.connectionId,
    );
    const credentials = this.laterCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("later", input.toolName)!;
    let data: unknown;
    if (tool.name === "later.listInstanceIds")
      data = await this.laterApi.instances(credentials);
    else if (tool.name === "later.getInstancePerformance")
      data = await this.laterApi.instancePerformance(
        credentials,
        this.requiredString(input.input.startDate, "startDate"),
        this.requiredString(input.input.endDate, "endDate"),
      );
    else if (tool.name === "later.listCampaignPerformance")
      data = await this.laterApi.campaignPerformance(
        credentials,
        this.requiredString(input.input.instanceId, "instanceId"),
        this.requiredString(input.input.startDate, "startDate"),
        this.requiredString(input.input.endDate, "endDate"),
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Later bounded reporting read completed.");
  },

  async executeLine(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "line",
      input.connectionId,
    );
    const tool = this.registry.getTool("line", input.toolName)!;
    if (
      tool.name !== "relay_line_get_profile" ||
      Object.keys(input.input ?? {}).length
    ) {
      return this.safeError(
        "tool_unavailable",
        "LINE V1 permits exactly one parameterless profile read",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    await this.oauth.validateLineProfile(connection, token.accessToken);
    return this.ok(
      {
        userId: this.stringOrNull(connection.metadata?.lineUserId),
        displayName: this.stringOrNull(connection.metadata?.displayName),
        pictureUrl: this.stringOrNull(connection.metadata?.pictureUrl),
        statusMessage: this.stringOrNull(connection.metadata?.statusMessage),
        subjectBound: true,
      },
      "LINE connected profile read completed.",
    );
  },

  async executeListrak(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "listrak",
      input.connectionId,
    );
    const credentials = this.listrakCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("listrak", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "listrak",
      );
    const data =
      tool.action === "read"
        ? await this.listrakApi.read(credentials, operation, input.input)
        : await this.listrakApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.listrak.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Listrak ${operation} completed.`);
  },

  async executeLiveChat(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "livechat",
      input.connectionId,
    );
    const credentials = this.liveChatCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("livechat", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "livechat.listChats") {
      action = "livechat_chat_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "livechat",
      );
      data = await this.liveChatApi.listChats(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "livechat.getChat") {
      action = "livechat_chat_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "livechat",
      );
      data = await this.liveChatApi.getChat(
        credentials,
        this.requiredString(input.input.chatId, "chatId"),
      );
    } else if (name === "livechat.request") {
      action = "livechat_full_api";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "livechat",
      );
      data = await this.liveChatApi.request(credentials, {
        action: this.requiredString(input.input.action, "action"),
        json: this.objectOrNull(input.input.json) ?? undefined,
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
      eventType: `marketplace.livechat.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        chatIdHash: this.stringOrNull(input.input.chatId)
          ? this.hash(this.stringOrNull(input.input.chatId)!)
          : null,
        providerAction: this.stringOrNull(input.input.action),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `LiveChat ${name.split(".")[1]} completed.`);
  },

  async executeLivestorm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "livestorm",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("livestorm", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      "event_lifecycle_read",
      "livestorm",
    );
    if (tool.name !== "livestorm.listEventLifecycle")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.livestormApi.listEventLifecycle(
      token.accessToken,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.livestorm.listEventLifecycle.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerSideEffect: false,
      },
    });
    return this.ok(data, "Livestorm event lifecycle metadata completed.");
  },

  async executeLuma(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "luma",
      input.connectionId,
    );
    const credentials = this.lumaCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const tool = this.registry.getTool("luma", input.toolName)!;
    let data: unknown;
    if (tool.name === "relay_luma_get_user") {
      data = await this.lumaApi.getUser(credentials);
    } else if (tool.name === "relay_luma_get_calendar") {
      data = await this.lumaApi.getCalendar(credentials);
    } else if (tool.name === "relay_luma_list_calendar_events") {
      data = await this.lumaApi.listCalendarEvents(credentials, {
        after: input.input.after,
        before: input.input.before,
        limit: input.input.limit,
      });
    } else if (tool.name === "relay_luma_get_event") {
      data = await this.lumaApi.getEvent(credentials, input.input.eventId);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.luma.${tool.name.replace("relay_luma_", "")}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        calendarIdHash: this.hash(credentials.boundCalendarId ?? ""),
        eventIdHash: this.stringOrNull(input.input.eventId)
          ? this.hash(this.stringOrNull(input.input.eventId)!)
          : null,
        after: this.stringOrNull(input.input.after),
        before: this.stringOrNull(input.input.before),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(
      data,
      `Luma ${tool.name.replace("relay_luma_", "")} completed.`,
    );
  },

  async executeMailchimp(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mailchimp",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.mailchimpCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("mailchimp", input.toolName)!;
    let data: unknown;
    if (tool.name === "mailchimp.getAccount") {
      data = await this.mailchimpApi.getAccount(credentials);
    } else if (tool.name === "mailchimp.listAudiences") {
      data = await this.mailchimpApi.listAudiences(credentials);
    } else if (tool.name === "mailchimp.listRecentSentCampaigns") {
      data = await this.mailchimpApi.listRecentSentCampaigns(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mailchimp.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        accountIdHash: this.hash(credentials.accountId),
      },
    });
    return this.ok(data, `Mailchimp ${tool.name.split(".")[1]} completed.`);
  },

  async executeMailchimpSurveys(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mailchimp-surveys",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.mailchimpSurveysCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("mailchimp-surveys", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "mailchimp-surveys",
      );
    const data = await this.mailchimpSurveysApi.execute(
      credentials,
      operation,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mailchimp_surveys.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Mailchimp Surveys ${operation} completed.`);
  },

  async executeMailchimpTransactional(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mailchimp-transactional",
      input.connectionId,
    );
    const credentials = this.mailchimpTransactionalCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "mailchimp-transactional",
      input.toolName,
    )!;
    let data: unknown;
    if (tool.name === "mailchimpTransactional.getAccount")
      data = await this.mailchimpTransactionalApi.getAccount(credentials);
    else if (tool.name === "mailchimpTransactional.listSenderDomains")
      data =
        await this.mailchimpTransactionalApi.listSenderDomains(credentials);
    else if (tool.name === "mailchimpTransactional.listSenders")
      data = await this.mailchimpTransactionalApi.listSenders(credentials);
    else if (
      tool.name === "mailchimpTransactional.sendMessage" ||
      tool.name === "mailchimpTransactional.sendTemplate" ||
      tool.name === "mailchimpTransactional.sendMailchimpTemplate"
    ) {
      await this.requireConnectorApproval(
        input,
        connection,
        "send_email",
        "mailchimp-transactional",
      );
      data =
        tool.name === "mailchimpTransactional.sendMessage"
          ? await this.mailchimpTransactionalApi.sendMessage(
              credentials,
              input.input,
            )
          : tool.name === "mailchimpTransactional.sendTemplate"
            ? await this.mailchimpTransactionalApi.sendTemplate(
                credentials,
                input.input,
              )
            : await this.mailchimpTransactionalApi.sendMailchimpTemplate(
                credentials,
                input.input,
              );
    } else if (tool.name === "mailchimpTransactional.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "mailchimp-transactional",
      );
      data = await this.mailchimpTransactionalApi.request(credentials, {
        path: this.requiredString(input.input.path, "path"),
        payload: this.objectOrNull(input.input.payload) ?? undefined,
      });
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mailchimp_transactional.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        senderBoundary: credentials.senderBoundary,
      },
    });
    return this.ok(
      data,
      `Mailchimp Transactional ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeMailgun(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mailgun",
      input.connectionId,
    );
    const credentials = this.mailgunCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("mailgun", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    if (name === "mailgun.getDomain")
      data = await this.mailgunApi.getDomain(credentials);
    else if (name === "mailgun.listEvents")
      data = await this.mailgunApi.listEvents(credentials, input.input);
    else if (name === "mailgun.queryMetrics")
      data = await this.mailgunApi.queryMetrics(credentials, input.input);
    else if (name === "mailgun.sendMessage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "send_message",
        "mailgun",
      );
      data = await this.mailgunApi.sendMessage(credentials, input.input);
    } else if (name === "mailgun.request") {
      await this.requireConnectorApproval(
        input,
        connection,
        "full_api",
        "mailgun",
      );
      data = await this.mailgunApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path: this.requiredString(input.input.path, "path"),
        query: this.objectOrNull(input.input.query) ?? undefined,
        fields: this.objectOrNull(input.input.fields) ?? undefined,
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
      eventType: `marketplace.mailgun.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        domain: credentials.domain,
        region: credentials.region,
      },
    });
    return this.ok(data, `Mailgun ${name.split(".")[1]} completed.`);
  },

  async executeMaropost(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "maropost",
      input.connectionId,
    );
    const credentials = this.maropostCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("maropost", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    if (tool.approvalRequired)
      await this.requireConnectorApproval(
        input,
        connection,
        tool.capability,
        "maropost",
      );
    const data =
      tool.action === "read"
        ? await this.maropostApi.read(credentials, operation, input.input)
        : await this.maropostApi.manage(credentials, operation, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.maropost.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Maropost ${operation} completed.`);
  },

  async executeMeetup(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "meetup",
      input.connectionId,
    );
    const tool = this.registry.getTool("meetup", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_meetup_get_self") {
      const member = await this.oauth.validateMeetupMember(
        connection,
        token.accessToken,
      );
      return this.ok(
        {
          name: this.stringOrNull(member.displayName),
          verified: member.memberVerified === true,
          memberBindingVerified: member.memberBindingVerified === true,
        },
        "Meetup connected member read completed.",
      );
    }
    if (tool.name === "relay_meetup_get_event") {
      const event = await this.meetupApi.getEvent(
        token.accessToken,
        input.input.eventId,
      );
      return this.ok(event, "Meetup event read completed.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeMeltwater(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "meltwater",
      input.connectionId,
    );
    const credentials = this.meltwaterCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("meltwater", input.toolName)!;
    let data: unknown;
    if (tool.name === "meltwater.getApiUsage")
      data = await this.meltwaterApi.getUsage(credentials);
    else if (tool.name === "meltwater.listSearches")
      data = await this.meltwaterApi.listSearches(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Meltwater redacted usage/search read completed.");
  },

  async executeMention(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mention",
      input.connectionId,
    );
    const credentials = this.mentionCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("mention", input.toolName)!;
    let data: unknown;
    if (tool.name === "mention.getAccountStatus")
      data = await this.mentionApi.getAccountStatus(credentials);
    else if (tool.name === "mention.listAlerts")
      data = await this.mentionApi.listAlerts(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Mention redacted account/alert read completed.");
  },

  async executeMessageBird(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "messagebird",
      input.connectionId,
    );
    const tool = this.registry.getTool("messagebird", input.toolName)!;
    if (tool.name !== "relay_messagebird_get_workspace_status")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const credentials = this.messageBirdCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    const data = await this.messageBirdApi.getWorkspaceStatus(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.messagebird.workspace_status_get.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        workspaceMetadataOnly: true,
        providerContentStored: false,
      },
    });
    return this.ok(data, "Bird workspace status read completed.");
  },
};

export const CommunicationExecutors2Registrations = {
  "google-chat": { methodName: "executeGoogleChat", needsConnection: false },
  "google-contacts": {
    methodName: "executeGoogleContacts",
    needsConnection: false,
  },
  "google-meet": { methodName: "executeGoogleMeet", needsConnection: false },
  "goto-meeting": { methodName: "executeGoToMeeting", needsConnection: false },
  "goto-webinar": { methodName: "executeGoToWebinar", needsConnection: false },
  grain: { methodName: "executeGrain", needsConnection: false },
  "higher-logic": { methodName: "executeHigherLogic", needsConnection: false },
  hivebrite: { methodName: "executeHivebrite", needsConnection: false },
  hootsuite: { methodName: "executeHootsuite", needsConnection: false },
  hopin: { methodName: "executeHopin", needsConnection: false },
  iterable: { methodName: "executeIterable", needsConnection: false },
  "iterable-sms": { methodName: "executeIterableSms", needsConnection: false },
  "kajabi-communities": {
    methodName: "executeKajabiCommunities",
    needsConnection: false,
  },
  khoros: { methodName: "executeKhoros", needsConnection: false },
  klaviyo: { methodName: "executeKlaviyo", needsConnection: false },
  "klaviyo-sms": { methodName: "executeKlaviyoSms", needsConnection: false },
  later: { methodName: "executeLater", needsConnection: false },
  line: { methodName: "executeLine", needsConnection: false },
  listrak: { methodName: "executeListrak", needsConnection: false },
  livechat: { methodName: "executeLiveChat", needsConnection: false },
  livestorm: { methodName: "executeLivestorm", needsConnection: false },
  luma: { methodName: "executeLuma", needsConnection: false },
  mailchimp: { methodName: "executeMailchimp", needsConnection: false },
  "mailchimp-surveys": {
    methodName: "executeMailchimpSurveys",
    needsConnection: false,
  },
  "mailchimp-transactional": {
    methodName: "executeMailchimpTransactional",
    needsConnection: false,
  },
  mailgun: { methodName: "executeMailgun", needsConnection: false },
  maropost: { methodName: "executeMaropost", needsConnection: false },
  meetup: { methodName: "executeMeetup", needsConnection: false },
  meltwater: { methodName: "executeMeltwater", needsConnection: false },
  mention: { methodName: "executeMention", needsConnection: false },
  messagebird: { methodName: "executeMessageBird", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof CommunicationExecutors2>;
