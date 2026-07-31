import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type SentryIssueUpdate } from "../../../sentry/sentry-api.adapter";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const DeveloperExecutors3 = {
  async executePagerDuty(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "pagerduty",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.pagerDutyCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("pagerduty", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "pagerDuty.listIncidents") {
      action = "pagerduty_incident_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "pagerduty",
      );
      data = await this.pagerDutyApi.listIncidents(credentials, input.input);
    } else if (name === "pagerDuty.getIncident") {
      action = "pagerduty_incident_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "pagerduty",
      );
      data = await this.pagerDutyApi.getIncident(
        credentials,
        input.input as { incidentId: unknown },
      );
    } else if (name === "pagerDuty.listServices") {
      action = "pagerduty_service_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "pagerduty",
      );
      data = await this.pagerDutyApi.listServices(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    const audience = this.pagerDutyAccountAudience(connection);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.pagerduty.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountAudienceHash: this.hash(audience),
        apiOrigin: credentials.apiOrigin,
        incidentIdHash: this.stringOrNull(input.input.incidentId)
          ? this.hash(this.stringOrNull(input.input.incidentId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `PagerDuty ${name.split(".")[1]} completed.`);
  },

  async executePendo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "pendo",
      input.connectionId,
    );
    const credentials = this.pendoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("pendo", input.toolName)!;
    let data: unknown;
    if (tool.name === "pendo.getApplicationBinding") {
      data = await this.pendoApi.applicationBinding(credentials);
    } else if (tool.name === "pendo.listDefinitions") {
      data = await this.pendoApi.listDefinitions(credentials, input.input);
    } else if (tool.name === "pendo.getAdoption") {
      data = await this.pendoApi.getAdoption(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.pendo.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        applicationIdHash: this.hash(credentials.applicationId),
      },
    });
    return this.ok(data, `Pendo ${tool.name.split(".")[1]} completed.`);
  },

  async executePlanhat(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "planhat",
      input.connectionId,
    );
    const tool = this.registry.getTool("planhat", input.toolName)!;
    if (tool.name !== "planhat.listCustomFields")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "custom_field_metadata",
      "planhat",
    );
    const data = await this.planhatApi.listCustomFields(
      this.planhatCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.planhat.list_custom_fields.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedApiToken: true,
        exactOriginBound: true,
        fixedPathAndQuery: true,
        providerRequestCount: 1,
        maxResults: 100,
        formulasReturned: false,
        listValuesReturned: false,
        filtersReturned: false,
        referencesReturned: false,
        customerDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Planhat custom-field metadata listed.");
  },

  async executePlausibleSelfHosted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "plausible-self-hosted",
      input.connectionId,
    );
    const credentials = this.plausibleSelfHostedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "plausible-self-hosted",
      input.toolName,
    )!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "plausible-self-hosted",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "plausibleSelfHosted.overview")
      data = await this.plausibleSelfHostedApi.overview(credentials, payload);
    else if (tool.name === "plausibleSelfHosted.topPages")
      data = await this.plausibleSelfHostedApi.topPages(credentials, payload);
    else if (tool.name === "plausibleSelfHosted.sources")
      data = await this.plausibleSelfHostedApi.sources(credentials, payload);
    else if (tool.name === "plausibleSelfHosted.countries")
      data = await this.plausibleSelfHostedApi.countries(credentials, payload);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.plausible_self_hosted.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        siteIdHash: this.hash(credentials.siteId),
        installationBound: true,
        window: this.stringOrNull(input.input.window) ?? "7d",
        limit: input.input.limit ?? null,
        analyticsContentLogged: false,
      },
    });
    return this.ok(
      data,
      `Plausible Self-Hosted ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executePostHog(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "posthog",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.postHogCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("posthog", input.toolName)!;
    let data: unknown;
    if (tool.name === "posthog.listProjects") {
      data = await this.postHogApi.listProjects(credentials);
    } else if (tool.name === "posthog.listDashboards") {
      data = await this.postHogApi.listDashboards(credentials, input.input);
    } else if (tool.name === "posthog.getDashboard") {
      data = await this.postHogApi.getDashboard(credentials, input.input);
    } else if (tool.name === "posthog.listInsights") {
      data = await this.postHogApi.listInsights(credentials, input.input);
    } else if (tool.name === "posthog.getInsight") {
      data = await this.postHogApi.getInsight(credentials, input.input);
    } else if (tool.name === "posthog.runBoundedTrend") {
      await this.requireConnectorApproval(
        input,
        connection,
        "posthog_query_bounded",
        "posthog",
      );
      data = await this.postHogApi.runBoundedTrend(credentials, input.input);
    } else if (tool.name === "posthog.readSchema") {
      data = await this.postHogApi.readSchema(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.posthog.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        organizationIdHash: this.hash(credentials.organizationId),
        projectIdHash: this.hash(credentials.projectId),
      },
    });
    return this.ok(data, `PostHog ${tool.name.split(".")[1]} completed.`);
  },

  async executePostHogFeatureFlags(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "posthog-feature-flags",
      input.connectionId,
    );
    const credentials = this.postHogFeatureFlagsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "posthog-feature-flags",
      input.toolName,
    )!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "posthog-feature-flags",
    );
    const data = await this.postHogFeatureFlagsApi.read(
      credentials,
      operation,
      { resourceId: input.input.resourceId },
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.posthog-feature-flags.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `PostHog Feature Flags ${operation} completed.`);
  },

  async executeSecureframe(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "secureframe",
      input.connectionId,
    );
    const credentials = this.secureframeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("secureframe", input.toolName)!;
    if (tool.name !== "secureframe.listFrameworks")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.secureframeApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.secureframe.frameworks_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        page: input.input.page ?? 1,
        perPage: input.input.perPage ?? 20,
      },
    });
    return this.ok(data, "Secureframe frameworks listed.");
  },

  async executeSegment(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "segment",
      input.connectionId,
    );
    const credentials = this.segmentCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("segment", input.toolName)!;
    let data: unknown;
    if (tool.name === "segment.getWorkspaceBinding")
      data = await this.segmentApi.workspaceBinding(credentials);
    else if (tool.name === "segment.listSources")
      data = await this.segmentApi.listSources(credentials);
    else if (tool.name === "segment.listDestinations")
      data = await this.segmentApi.listDestinations(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.segment.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        workspaceIdHash: this.hash(credentials.workspaceId),
      },
    });
    return this.ok(data, `Segment ${tool.name.split(".")[1]} completed.`);
  },

  async executeSegmentPersonas(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "segment-personas",
        input.connectionId,
      ),
      credentials = this.segmentPersonasCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("segment-personas", input.toolName)!;
    if (tool.name !== "segmentPersonas.getAudienceReadinessSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.segmentApi.getAudienceReadinessSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Segment audience readiness summary read completed.");
  },

  async executeSentry(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sentry",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.sentryCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("sentry", input.toolName)!;
    const update = (): SentryIssueUpdate => ({
      ...(this.stringOrNull(input.input.status)
        ? {
            status: this.stringOrNull(
              input.input.status,
            ) as SentryIssueUpdate["status"],
          }
        : {}),
      ...(this.stringOrNull(input.input.substatus)
        ? {
            substatus: this.stringOrNull(
              input.input.substatus,
            ) as SentryIssueUpdate["substatus"],
          }
        : {}),
      ...(this.stringOrNull(input.input.priority)
        ? {
            priority: this.stringOrNull(
              input.input.priority,
            ) as SentryIssueUpdate["priority"],
          }
        : {}),
    });
    let data: unknown;
    if (tool.name === "sentry.listProjects") {
      data = await this.sentryApi.listProjects(credentials);
    } else if (tool.name === "sentry.searchIssues") {
      data = await this.sentryApi.searchIssues(credentials, {
        project: this.stringOrNull(input.input.project) ?? undefined,
        environment: this.stringOrNull(input.input.environment) ?? undefined,
        query: this.stringOrNull(input.input.query) ?? undefined,
        statsPeriod: this.stringOrNull(input.input.statsPeriod) as
          | "24h"
          | "7d"
          | "14d"
          | undefined,
        sort: this.stringOrNull(input.input.sort) as
          | "date"
          | "new"
          | "freq"
          | "user"
          | undefined,
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (tool.name === "sentry.getIssue") {
      data = await this.sentryApi.getIssue(
        credentials,
        this.requiredString(input.input.issueId, "issueId"),
      );
    } else if (tool.name === "sentry.getEvent") {
      data = await this.sentryApi.getEvent(
        credentials,
        this.requiredString(input.input.projectSlug, "projectSlug"),
        this.requiredString(input.input.eventId, "eventId"),
      );
    } else if (tool.name === "sentry.prepareIssueUpdate") {
      data = {
        issueId: this.requiredString(input.input.issueId, "issueId"),
        update: update(),
        providerMutation: false,
      };
    } else if (tool.name === "sentry.updateIssue") {
      await this.requireConnectorApproval(
        input,
        connection,
        "sentry_issue_update",
        "sentry",
      );
      data = await this.sentryApi.updateIssue(
        credentials,
        this.requiredString(input.input.issueId, "issueId"),
        update(),
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
      eventType: `marketplace.sentry.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        organizationHash: this.hash(credentials.organization),
        ...(input.input.issueId
          ? { issueIdHash: this.hash(String(input.input.issueId)) }
          : {}),
      },
    });
    return this.ok(data, `Sentry ${tool.name.split(".")[1]} completed.`);
  },

  async executeShareworks(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "shareworks",
      input.connectionId,
    );
    const credentials = this.shareworksCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("shareworks", input.toolName)!;
    if (tool.name !== "shareworks.listCompanies")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.shareworksApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.shareworks.companies_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        pageSize: input.input.pageSize ?? 20,
        pageNumber: input.input.pageNumber ?? 1,
      },
    });
    return this.ok(data, "Shareworks companies listed.");
  },

  async executeSingular(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "singular",
        input.connectionId,
      ),
      credentials = this.singularCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("singular", input.toolName)!;
    if (tool.name !== "singular.listAppSiteReferences")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.singularApi.listAppSiteReferences(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Singular app-site reference read completed.");
  },

  async executeSmartlook(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "smartlook",
      input.connectionId,
    );
    const tool = this.registry.getTool("smartlook", input.toolName)!;
    if (tool.name !== "smartlook.listEventDefinitions")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "event_definition_list",
      "smartlook",
    );
    const data = await this.smartlookApi.listEventDefinitions(
      this.smartlookCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.smartlook.list_event_definitions.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedProjectApiToken: true,
        exactProjectTokenBound: true,
        regionBound: true,
        providerRequestCount: 1,
        maxResults: 25,
        visitorsReturned: false,
        sessionsReturned: false,
        recordingsReturned: false,
        eventOccurrencesReturned: false,
        eventPropertiesReturned: false,
        urlsReturned: false,
        cursorsReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Smartlook event definitions listed.");
  },

  async executeSplitIo(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "split-io",
      input.connectionId,
    );
    const credentials = this.splitIoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("split-io", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "split-io",
    );
    const data = await this.splitIoApi.read(credentials, operation, {
      resourceId: input.input.resourceId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.split-io.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Split.io ${operation} completed.`);
  },

  async executeSprinto(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "sprinto",
      input.connectionId,
    );
    const credentials = this.sprintoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("sprinto", input.toolName)!;
    if (tool.name !== "sprinto.listWorkflowChecks")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.sprintoApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.sprinto.workflow_checks_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        first: input.input.first ?? 20,
        paginated: Boolean(input.input.after),
      },
    });
    return this.ok(data, "Sprinto workflow checks listed.");
  },

  async executeStatsig(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "statsig",
      input.connectionId,
    );
    const credentials = this.statsigCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("statsig", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "statsig",
    );
    const data = await this.statsigApi.read(credentials, operation, {
      resourceId: input.input.resourceId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.statsig.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Statsig ${operation} completed.`);
  },

  async executeStatuspage(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "statuspage",
      input.connectionId,
    );
    const credentials = this.statuspageCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("statuspage", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "statuspage.readSummary") {
      action = "statuspage_read_summary";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "statuspage",
      );
      data = await this.statuspageApi.readSummary(credentials);
    } else if (name === "statuspage.listIncidents") {
      action = "statuspage_list_incidents";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "statuspage",
      );
      data = await this.statuspageApi.listIncidents(credentials, input.input);
    } else if (name === "statuspage.listScheduledMaintenances") {
      action = "statuspage_list_scheduled_maintenances";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "statuspage",
      );
      data = await this.statuspageApi.listScheduledMaintenances(
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
      eventType: `marketplace.statuspage.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        pageIdHash: this.hash(credentials.pageId),
        filter: input.input.filter ?? null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Statuspage ${name.split(".")[1]} completed.`);
  },

  async executeSupabase(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "supabase",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.supabaseCredentials(token.credentials);
    const tool = this.registry.getTool("supabase", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "supabase.getOrganization") {
      action = "supabase_organization_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "supabase",
      );
      data = await this.supabaseApi.getOrganization(credentials);
    } else if (name === "supabase.listProjects") {
      action = "supabase_organization_project_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "supabase",
      );
      data = await this.supabaseApi.listProjects(credentials, input.input);
    } else if (name === "supabase.getProject") {
      action = "supabase_project_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "supabase",
      );
      data = await this.supabaseApi.getProject(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.supabase.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        organizationSlugHash: this.hash(credentials.organizationSlug),
        projectRefHash: this.hash(credentials.projectRef),
        tokenRefreshed: token.refreshed,
        limit: input.input.limit ?? null,
        offset: 0,
      },
    });
    return this.ok(data, `Supabase ${name.split(".")[1]} completed.`);
  },

  async executeSupabaseSelfHosted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "supabase-self-hosted",
      input.connectionId,
    );
    const credentials = this.supabaseSelfHostedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("supabase-self-hosted", input.toolName)!;
    if (tool.name !== "supabase-self-hosted.getSelectedRowState")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.supabaseSelfHostedApi.getSelectedRowState(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.supabase-self-hosted.getSelectedRowState.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        newFormatPublishableAnonKeyRequired: true,
        secretAndServiceRoleKeysBlocked: true,
        selectedTableAndRowRlsRequired: true,
        fixedIdAndStatusProjectionOnly: true,
        otherDataServicesAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(data, "Supabase Self-Hosted getSelectedRowState completed.");
  },

  async executeSynologyDsm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "synology-dsm",
      input.connectionId,
    );
    const credentials = this.synologyDsmCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("synology-dsm", input.toolName)!;
    if (tool.name !== "synology-dsm.getSelectedApiCompatibility")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.synologyDsmApi.getSelectedApiCompatibility(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.synology-dsm.getSelectedApiCompatibility.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        publicHttpsOriginBound: true,
        selectedApiNameBound: true,
        unauthenticatedApiInfoOnly: true,
        providerPathsAndPrivateSystemDataExcluded: true,
        loginAdministrationAndMutationsBlocked: true,
      },
    });
    return this.ok(data, "Synology DSM getSelectedApiCompatibility completed.");
  },

  async executeTealium(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "tealium",
        input.connectionId,
      ),
      credentials = this.tealiumCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("tealium", input.toolName)!;
    if (tool.name !== "tealium.getDefinitionReadinessSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.tealiumApi.getDefinitionReadinessSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(
      data,
      "Tealium definition readiness summary read completed.",
    );
  },

  async executeTotango(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "totango",
      input.connectionId,
    );
    const tool = this.registry.getTool("totango", input.toolName)!;
    if (tool.name !== "totango.listFlows")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "flow_inventory",
      "totango",
    );
    const data = await this.totangoApi.listFlows(
      this.totangoCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.totango.list_flows.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedAppToken: true,
        exactRegionBound: true,
        fixedPath: true,
        providerRequestCount: 1,
        maxResults: 30,
        activityCountsReturned: false,
        iconsReturned: false,
        customerDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Totango flows listed.");
  },

  async executeTreasureData(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "treasure-data",
        input.connectionId,
      ),
      credentials = this.treasureDataCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("treasure-data", input.toolName)!;
    if (tool.name !== "treasureData.getDatabaseReadinessSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.treasureDataApi.getDatabaseReadinessSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(
      data,
      "Treasure Data database readiness summary read completed.",
    );
  },

  async executeUmamiSelfHosted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "umami-self-hosted",
      input.connectionId,
    );
    const credentials = this.umamiSelfHostedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("umami-self-hosted", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "umami-self-hosted",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "umamiSelfHosted.stats")
      data = await this.umamiSelfHostedApi.stats(credentials, payload);
    else if (tool.name === "umamiSelfHosted.topPages")
      data = await this.umamiSelfHostedApi.topPages(credentials, payload);
    else if (tool.name === "umamiSelfHosted.pageviews")
      data = await this.umamiSelfHostedApi.pageviews(credentials, payload);
    else if (tool.name === "umamiSelfHosted.activeVisitors")
      data = await this.umamiSelfHostedApi.activeVisitors(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.umami_self_hosted.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        websiteIdHash: this.hash(credentials.websiteId),
        installationBound: true,
        window: this.stringOrNull(input.input.window) ?? null,
        limit: input.input.limit ?? null,
        analyticsContentLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(
      data,
      `Umami Self-Hosted ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeUnleashCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "unleash-cloud",
      input.connectionId,
    );
    const credentials = this.unleashCloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("unleash-cloud", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "unleash-cloud",
    );
    const data = await this.unleashCloudApi.read(credentials, operation, {
      resourceId: input.input.resourceId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.unleash-cloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Unleash Cloud ${operation} completed.`);
  },

  async executeUserflow(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "userflow",
      input.connectionId,
    );
    const tool = this.registry.getTool("userflow", input.toolName)!;
    if (tool.name !== "userflow.listContent")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "content_inventory",
      "userflow",
    );
    const data = await this.userflowApi.listContent(
      this.userflowCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.userflow.list_content.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedEnvironmentApiKey: true,
        exactEnvironmentBound: true,
        regionBound: true,
        providerRequestCount: 1,
        maxResults: 50,
        labelsReturned: false,
        contentVersionsReturned: false,
        contentSessionsReturned: false,
        userDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Userflow content inventory listed.");
  },

  async executeUserpilot(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "userpilot",
      input.connectionId,
    );
    const tool = this.registry.getTool("userpilot", input.toolName)!;
    if (tool.name !== "userpilot.listFeatureEventDefinitions")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "feature_event_inventory",
      "userpilot",
    );
    const data = await this.userpilotApi.listDefinitions(
      this.userpilotCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType:
        "marketplace.userpilot.list_feature_event_definitions.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedEnvironmentApiKey: true,
        exactEnvironmentBound: true,
        exactUserpilotOriginBound: true,
        providerRequestCount: 1,
        maxResults: 100,
        userPropertiesReturned: false,
        companyPropertiesReturned: false,
        segmentsReturned: false,
        analyticsDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Userpilot feature/event definitions listed.");
  },

  async executeVanta(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vanta",
      input.connectionId,
    );
    const credentials = this.vantaCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("vanta", input.toolName)!;
    if (tool.name !== "vanta.listDocuments")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.vantaApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.vanta.documents_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        pageSize: input.input.pageSize ?? 20,
        paginated: Boolean(input.input.pageCursor),
      },
    });
    return this.ok(data, "Vanta document statuses listed.");
  },

  async executeVercel(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vercel",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.vercelCredentials(
      this.credentials.decrypt(connection),
      token.accessToken,
    );
    const tool = this.registry.getTool("vercel", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "vercel.listProjects") {
      action = "vercel_project_list";
      await this.requireConnectorApproval(input, connection, action, "vercel");
      data = await this.vercelApi.listProjects(credentials, input.input);
    } else if (name === "vercel.getProject") {
      action = "vercel_project_get";
      await this.requireConnectorApproval(input, connection, action, "vercel");
      data = await this.vercelApi.getProject(credentials);
    } else if (name === "vercel.listDeployments") {
      action = "vercel_deployment_list";
      await this.requireConnectorApproval(input, connection, action, "vercel");
      data = await this.vercelApi.listDeployments(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.vercel.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        installationIdHash: this.hash(credentials.installationId),
        teamIdHash: credentials.teamId ? this.hash(credentials.teamId) : null,
        projectIdHash: this.hash(credentials.projectId),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Vercel ${name.split(".")[1]} completed.`);
  },

  async executeVitally(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vitally",
      input.connectionId,
    );
    const tool = this.registry.getTool("vitally", input.toolName)!;
    if (tool.name !== "vitally.listCustomTraits")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "custom_trait_schema",
      "vitally",
    );
    const data = await this.vitallyApi.listCustomTraits(
      this.vitallyCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.vitally.list_custom_traits.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedRestApiKey: true,
        exactEnvironmentBound: true,
        exactProviderOriginBound: true,
        approvedModelBound: true,
        providerRequestCount: 1,
        maxResults: 100,
        configuredOptionsReturned: false,
        traitValuesReturned: false,
        customerDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Vitally custom-trait schemas listed.");
  },

  async executeVwoTesting(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "vwo-testing",
      input.connectionId,
    );
    const credentials = this.vwoTestingCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("vwo-testing", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "vwo-testing",
    );
    const data = await this.vwoTestingApi.read(credentials, operation, {
      resourceId: input.input.resourceId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.vwo-testing.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `VWO Testing ${operation} completed.`);
  },

  async executeWorkiva(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "workiva",
      input.connectionId,
    );
    const credentials = this.workivaCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("workiva", input.toolName)!;
    if (tool.name !== "workiva.listFiles")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.workivaApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.workiva.files_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        maxPageSize: input.input.maxPageSize ?? 20,
        region: credentials.region.trim().toLowerCase(),
      },
    });
    return this.ok(data, "Workiva file metadata listed.");
  },

  async executeXrayTestManagement(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "xray-test-management",
      input.connectionId,
    );
    const credentials = this.xrayTestManagementCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("xray-test-management", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "xray-test-management",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "xrayTestManagement.listTests")
      data = await this.xrayTestManagementApi.listTests(credentials, payload);
    else if (tool.name === "xrayTestManagement.getTest")
      data = await this.xrayTestManagementApi.getTest(credentials, payload);
    else if (tool.name === "xrayTestManagement.listTestExecutions")
      data = await this.xrayTestManagementApi.listTestExecutions(
        credentials,
        payload,
      );
    else if (tool.name === "xrayTestManagement.getTestRun")
      data = await this.xrayTestManagementApi.getTestRun(credentials, payload);
    else if (tool.name === "xrayTestManagement.updateTestRunStatus")
      data = await this.xrayTestManagementApi.updateTestRunStatus(
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
      eventType: `marketplace.xray_test_management.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        projectIdHash: this.hash(credentials.projectId),
        issueIdHash: input.input.issueId
          ? this.hash(String(input.input.issueId))
          : null,
        testIssueIdHash: input.input.testIssueId
          ? this.hash(String(input.input.testIssueId))
          : null,
        testExecIssueIdHash: input.input.testExecIssueId
          ? this.hash(String(input.input.testExecIssueId))
          : null,
        limit: input.input.limit ?? null,
        testContentLogged: false,
        credentialsLogged: false,
      },
    });
    return this.ok(
      data,
      `Xray Test Management ${tool.name.split(".")[1]} completed.`,
    );
  },
};

export const DeveloperExecutors3Registrations = {
  pagerduty: { methodName: "executePagerDuty", needsConnection: false },
  pendo: { methodName: "executePendo", needsConnection: false },
  planhat: { methodName: "executePlanhat", needsConnection: false },
  "plausible-self-hosted": {
    methodName: "executePlausibleSelfHosted",
    needsConnection: false,
  },
  posthog: { methodName: "executePostHog", needsConnection: false },
  "posthog-feature-flags": {
    methodName: "executePostHogFeatureFlags",
    needsConnection: false,
  },
  secureframe: { methodName: "executeSecureframe", needsConnection: false },
  segment: { methodName: "executeSegment", needsConnection: false },
  "segment-personas": {
    methodName: "executeSegmentPersonas",
    needsConnection: false,
  },
  sentry: { methodName: "executeSentry", needsConnection: false },
  shareworks: { methodName: "executeShareworks", needsConnection: false },
  singular: { methodName: "executeSingular", needsConnection: false },
  smartlook: { methodName: "executeSmartlook", needsConnection: false },
  "split-io": { methodName: "executeSplitIo", needsConnection: false },
  sprinto: { methodName: "executeSprinto", needsConnection: false },
  statsig: { methodName: "executeStatsig", needsConnection: false },
  statuspage: { methodName: "executeStatuspage", needsConnection: false },
  supabase: { methodName: "executeSupabase", needsConnection: false },
  "supabase-self-hosted": {
    methodName: "executeSupabaseSelfHosted",
    needsConnection: false,
  },
  "synology-dsm": { methodName: "executeSynologyDsm", needsConnection: false },
  tealium: { methodName: "executeTealium", needsConnection: false },
  totango: { methodName: "executeTotango", needsConnection: false },
  "treasure-data": {
    methodName: "executeTreasureData",
    needsConnection: false,
  },
  "umami-self-hosted": {
    methodName: "executeUmamiSelfHosted",
    needsConnection: false,
  },
  "unleash-cloud": {
    methodName: "executeUnleashCloud",
    needsConnection: false,
  },
  userflow: { methodName: "executeUserflow", needsConnection: false },
  userpilot: { methodName: "executeUserpilot", needsConnection: false },
  vanta: { methodName: "executeVanta", needsConnection: false },
  vercel: { methodName: "executeVercel", needsConnection: false },
  vitally: { methodName: "executeVitally", needsConnection: false },
  "vwo-testing": { methodName: "executeVwoTesting", needsConnection: false },
  workiva: { methodName: "executeWorkiva", needsConnection: false },
  "xray-test-management": {
    methodName: "executeXrayTestManagement",
    needsConnection: false,
  },
} satisfies NativeExecutorRegistrationMap<typeof DeveloperExecutors3>;
