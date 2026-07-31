import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const DeveloperExecutors1 = {
  async executeAbTastyFeatureExperimentation(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ab-tasty-feature-experimentation",
      input.connectionId,
    );
    const credentials = this.abTastyFeatureExperimentationCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool(
      "ab-tasty-feature-experimentation",
      input.toolName,
    )!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "ab-tasty-feature-experimentation",
    );
    const data = await this.abTastyFeatureExperimentationApi.read(
      credentials,
      operation,
      { resourceId: input.input.resourceId },
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.ab-tasty-feature-experimentation.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(
      data,
      `AB Tasty Feature Experimentation ${operation} completed.`,
    );
  },

  async executeAdjust(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "adjust",
        input.connectionId,
      ),
      credentials = this.adjustCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("adjust", input.toolName)!;
    if (tool.name !== "adjust.listAppReferences")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.adjustApi.listAppReferences(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Adjust app-reference read completed.");
  },

  async executeAdobeAnalytics(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "adobe-analytics",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("adobe-analytics", input.toolName)!;
    if (tool.name !== "adobe-analytics.read")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.adobeAnalyticsMcp.callRead(
      token.accessToken,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.adobe_analytics.read.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        providerTool: this.stringOrNull(input.input.toolName),
        argumentKeys: Object.keys(
          this.objectOrNull(input.input.arguments) ?? {},
        ).slice(0, 50),
      },
    });
    return this.ok(data, "Adobe Analytics read completed.");
  },

  async executeAdobeTarget(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "adobe-target",
      input.connectionId,
    );
    const credentials = this.adobeTargetCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("adobe-target", input.toolName)!;
    if (tool.name !== "adobe-target.listActivities")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.adobeTargetApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.adobe_target.activities_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        offset: input.input.offset ?? 0,
        limit: input.input.limit ?? 20,
      },
    });
    return this.ok(data, "Adobe Target activities listed.");
  },

  async executeAmplitude(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "amplitude",
      input.connectionId,
    );
    const credentials = this.amplitudeCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("amplitude", input.toolName)!;
    let data: unknown;
    if (tool.name === "amplitude.getProjectBinding") {
      data = await this.amplitudeApi.projectBinding(credentials);
    } else if (tool.name === "amplitude.getDailyUsers") {
      data = await this.amplitudeApi.getDailyUsers(credentials, input.input);
    } else if (tool.name === "amplitude.getAverageSessionLength") {
      data = await this.amplitudeApi.getAverageSessionLength(
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
      eventType: `marketplace.amplitude.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, `Amplitude ${tool.name.split(".")[1]} completed.`);
  },

  async executeAmplitudeExperiment(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "amplitude-experiment",
      input.connectionId,
    );
    const credentials = this.amplitudeExperimentCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("amplitude-experiment", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "amplitude-experiment",
    );
    const data = await this.amplitudeExperimentApi.read(
      credentials,
      operation,
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.amplitude-experiment.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Amplitude Experiment ${operation} completed.`);
  },

  async executeApolloGraphOs(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "apollo-graphql-studio",
      input.connectionId,
    );
    const tool = this.registry.getTool(
      "apollo-graphql-studio",
      input.toolName,
    )!;
    const credentials = this.apolloGraphOsCredentials(
      this.credentials.decrypt(connection),
      connection,
    );
    let data: unknown;
    let eventType: string;
    if (tool.name === "relay_apollo_graphos_get_graph_artifact") {
      data = await this.apolloGraphOsApi.getGraphArtifact(credentials);
      eventType = "marketplace.apollo_graphos.graph_artifact_get.executed";
    } else if (tool.name === "relay_apollo_graphos_get_launch_status") {
      data = await this.apolloGraphOsApi.getLaunchStatus(
        credentials,
        input.input.launchId,
      );
      eventType = "marketplace.apollo_graphos.launch_status_get.executed";
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        exactGraphVariantBinding: true,
        fixedGraphQLDocument: true,
        providerContentStored: false,
      },
    });
    return this.ok(data, "Apollo GraphOS metadata read completed.");
  },

  async executeAppcues(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "appcues",
      input.connectionId,
    );
    const tool = this.registry.getTool("appcues", input.toolName)!;
    if (tool.name !== "appcues.listFlows")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "flow_inventory",
      "appcues",
    );
    const data = await this.appcuesApi.listFlows(
      this.appcuesCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.appcues.list_flows.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedApiKeyAndSecret: true,
        exactAccountBound: true,
        regionBound: true,
        providerRequestCount: 1,
        maxResults: 50,
        creatorIdsReturned: false,
        tagsReturned: false,
        urlsReturned: false,
        userDataReturned: false,
        segmentDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Appcues flow inventory listed.");
  },

  async executeAppsFlyer(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "appsflyer",
        input.connectionId,
      ),
      credentials = this.appsFlyerCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("appsflyer", input.toolName)!;
    if (
      tool.name !== "appsflyer.listAppReferences" &&
      tool.name !== "appsflyer.getAudienceConnectionSummary"
    )
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      tool.name === "appsflyer.listAppReferences"
        ? await this.appsFlyerApi.listAppReferences(credentials)
        : await this.appsFlyerApi.getAudienceConnectionSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(
      data,
      tool.name === "appsflyer.listAppReferences"
        ? "AppsFlyer app-reference read completed."
        : "AppsFlyer Audiences connection summary read completed.",
    );
  },

  async executeAtlassianCompass(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "atlassian-compass",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const cloudId = this.requiredString(
      connection.metadata?.cloudId,
      "Compass cloud ID",
    );
    const tool = this.registry.getTool("atlassian-compass", input.toolName)!;
    let data: unknown;
    if (tool.name === "atlassian-compass.component-get") {
      data = await this.atlassianCompassApi.componentGet(
        token.accessToken,
        this.requiredString(input.input.componentId, "componentId"),
      );
    } else if (tool.name === "atlassian-compass.component-create") {
      await this.requireConnectorApproval(
        input,
        connection,
        "atlassian_compass_component_create",
        "atlassian-compass",
      );
      data = await this.atlassianCompassApi.componentCreate(
        token.accessToken,
        cloudId,
        {
          name: this.requiredString(input.input.name, "name"),
          typeId: this.requiredString(input.input.typeId, "typeId"),
          description: this.stringOrNull(input.input.description) ?? undefined,
          ownerId: this.stringOrNull(input.input.ownerId) ?? undefined,
        },
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
      eventType: `marketplace.atlassian-compass.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        cloudId,
        componentId: this.stringOrNull(input.input.componentId),
        componentType: this.stringOrNull(input.input.typeId),
      },
    });
    return this.ok(
      data,
      `Atlassian Compass ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeBambooHR(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "bamboohr",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.bambooHRCredentials(token.credentials);
    const tool = this.registry.getTool("bamboohr", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "bamboohr.listLocations") {
      action = "bamboohr_location_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "bamboohr",
      );
      data = await this.bambooHRApi.listLocations(credentials, input.input);
    } else if (name === "bamboohr.getLocation") {
      action = "bamboohr_location_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "bamboohr",
      );
      data = await this.bambooHRApi.getLocation(credentials);
    } else if (name === "bamboohr.listCountries") {
      action = "bamboohr_country_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "bamboohr",
      );
      data = await this.bambooHRApi.listCountries(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.bamboohr.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        companyDomainHash: this.hash(credentials.companyDomain),
        locationIdHash: this.hash(credentials.locationId),
        tokenRefreshed: token.refreshed,
        limit: input.input.limit ?? null,
        employeeDataReturned: false,
      },
    });
    return this.ok(data, `BambooHR ${name.split(".")[1]} completed.`);
  },

  async executeBitbucket(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "bitbucket",
      input.connectionId,
    );
    const tool = this.registry.getTool("bitbucket", input.toolName)!;
    if (tool.name === "relay_bitbucket_draft_comment") {
      const repositoryPath = this.requiredString(
        input.input.repositoryPath,
        "repositoryPath",
      );
      const id = this.positiveInteger(input.input.id, "id");
      const target = this.requiredString(input.input.target, "target");
      const body = this.requiredString(input.input.body, "body");
      if (!["issue", "pull_request"].includes(target))
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "target must be issue or pull_request",
        );
      if (body.length > 8000)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "body must be 8000 characters or fewer",
        );
      return this.ok(
        {
          repositoryPath,
          id,
          target,
          body,
          bodyHash: this.hash(body),
          providerSideEffect: false,
        },
        "Bitbucket comment draft prepared locally.",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_bitbucket_search_repositories") {
      const result = await this.bitbucketApi.searchRepositories(
        token.accessToken,
        input.input.query,
        input.input.maxResults,
      );
      return this.ok(result, "Bitbucket repository search completed.");
    }
    if (tool.name === "relay_bitbucket_list_issues") {
      const result = await this.bitbucketApi.listIssues(
        token.accessToken,
        input.input.repositoryPath,
        input.input.state,
        input.input.maxResults,
      );
      return this.ok(result, "Bitbucket issues read completed.");
    }
    if (tool.name === "relay_bitbucket_list_pull_requests") {
      const result = await this.bitbucketApi.listPullRequests(
        token.accessToken,
        input.input.repositoryPath,
        input.input.state,
        input.input.maxResults,
      );
      return this.ok(result, "Bitbucket pull requests read completed.");
    }
    if (
      tool.name === "relay_bitbucket_comment_issue" ||
      tool.name === "relay_bitbucket_comment_pull_request"
    ) {
      const repositoryPath = this.requiredString(
        input.input.repositoryPath,
        "repositoryPath",
      );
      const target =
        tool.name === "relay_bitbucket_comment_issue"
          ? "issue"
          : "pull_request";
      const id = this.positiveInteger(
        target === "issue" ? input.input.issueId : input.input.pullRequestId,
        target === "issue" ? "issueId" : "pullRequestId",
      );
      const body = this.requiredString(input.input.body, "body");
      const idempotencyKey = this.requiredString(
        input.input.idempotencyKey,
        "idempotencyKey",
      );
      if (body.length > 8000)
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "body must be 8000 characters or fewer",
        );
      const action =
        target === "issue"
          ? "bitbucket_issue_comment_create"
          : "bitbucket_pull_request_comment_create";
      await this.requireBitbucketApproval(input, connection, {
        action,
        repositoryPath,
        id,
        body,
        idempotencyKey,
      });
      const result = await this.bitbucketApi.createComment(token.accessToken, {
        repositoryPath,
        id,
        target,
        body,
        idempotencyKey,
      });
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: `marketplace.bitbucket.${target}.comment.created`,
        resourceId: connection.id,
        metadata: {
          repositoryPath,
          id,
          bodyHash: this.hash(body),
          idempotencyKey,
          commentId: this.stringOrNull(
            (result as Record<string, unknown>).commentId,
          ),
        },
      });
      return this.ok(result, "Approved Bitbucket comment posted.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeBlueConic(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "blueconic",
        input.connectionId,
      ),
      credentials = this.blueConicCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("blueconic", input.toolName)!;
    if (tool.name !== "blueconic.getSegmentReadinessSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.blueConicApi.getSegmentReadinessSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "BlueConic segment readiness summary read completed.");
  },

  async executeBranch(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "branch",
        input.connectionId,
      ),
      credentials = this.branchCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("branch", input.toolName)!;
    if (tool.name !== "branch.inspectBoundLink")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.branchApi.inspectBoundLink(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Branch bound-link structure inspected.");
  },

  async executeCapsuleCrm(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "capsule-crm",
      input.connectionId,
    );
    const tool = this.registry.getTool("capsule-crm", input.toolName)!;
    if (tool.name !== "capsuleCrm.listPartyCustomFields")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "party_custom_field_metadata",
      "capsule-crm",
    );
    const data = await this.capsuleCrmApi.listPartyCustomFields(
      this.capsuleCrmCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.capsule_crm.list_party_custom_fields.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedToken: true,
        fixedProviderOrigin: true,
        fixedPathEntityAndQuery: true,
        providerRequestCount: 1,
        maxResults: 100,
        privateSchemaLogicReturned: false,
        recordDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Capsule CRM party custom-field metadata listed.");
  },

  async executeCarta(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "carta",
      input.connectionId,
    );
    const credentials = this.cartaCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("carta", input.toolName)!;
    if (tool.name !== "carta.listFirms")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.cartaApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.carta.firms_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        pageSize: input.input.pageSize ?? 20,
        paginated: Boolean(input.input.pageToken),
      },
    });
    return this.ok(data, "Carta investment firms listed.");
  },

  async executeCensus(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "census",
        input.connectionId,
      ),
      credentials = this.censusCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("census", input.toolName)!;
    if (tool.name !== "census.getDatasetReadinessSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.censusApi.getDatasetReadinessSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Census dataset readiness summary read completed.");
  },

  async executeChameleon(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "chameleon",
      input.connectionId,
    );
    const tool = this.registry.getTool("chameleon", input.toolName)!;
    if (tool.name !== "chameleon.listTours")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "tour_inventory",
      "chameleon",
    );
    const data = await this.chameleonApi.listTours(
      this.chameleonCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.chameleon.list_tours.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedAccountSecret: true,
        exactAccountBound: true,
        fixedProviderOrigin: true,
        providerRequestCount: 1,
        maxResults: 50,
        segmentIdsReturned: false,
        tagIdsReturned: false,
        dashboardUrlsReturned: false,
        contentSummariesReturned: false,
        audienceSummariesReturned: false,
        statsReturned: false,
        profileDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Chameleon Tour inventory listed.");
  },

  async executeClientSuccess(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "clientsuccess",
      input.connectionId,
    );
    const tool = this.registry.getTool("clientsuccess", input.toolName)!;
    if (tool.name !== "clientsuccess.listClientCustomFields")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "client_custom_field_metadata",
      "clientsuccess",
    );
    const data = await this.clientSuccessApi.listClientCustomFields(
      this.clientSuccessCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.clientsuccess.list_client_custom_fields.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedAuthorization: true,
        fixedProviderOrigin: true,
        fixedPathResourceAndQuery: true,
        providerRequestCount: 1,
        maxResults: 100,
        resourceType: "CLIENT",
        usageCountsReturned: false,
        placeholdersReturned: false,
        optionsReturned: false,
        customerDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "ClientSuccess client custom-field metadata listed.");
  },

  async executeCloudflare(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "cloudflare",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.cloudflareCredentials(
      this.credentials.decrypt(connection),
      token.accessToken,
    );
    const tool = this.registry.getTool("cloudflare", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "cloudflare.listZones") {
      action = "cloudflare_zone_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "cloudflare",
      );
      data = await this.cloudflareApi.listZones(credentials, input.input);
    } else if (name === "cloudflare.getZone") {
      action = "cloudflare_zone_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "cloudflare",
      );
      data = await this.cloudflareApi.getZone(credentials);
    } else if (name === "cloudflare.readZoneTraffic") {
      action = "cloudflare_zone_traffic_overview";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "cloudflare",
      );
      data = await this.cloudflareApi.readZoneTraffic(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.cloudflare.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        zoneIdHash: this.hash(credentials.zoneId),
        limit: input.input.limit ?? null,
        hours: input.input.hours ?? null,
      },
    });
    return this.ok(data, `Cloudflare ${name.split(".")[1]} completed.`);
  },

  async executeConfigCat(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "configcat",
      input.connectionId,
    );
    const credentials = this.configCatCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("configcat", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "configcat",
    );
    const data = await this.configCatApi.read(credentials, operation, {
      resourceId: input.input.resourceId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.configcat.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `ConfigCat ${operation} completed.`);
  },

  async executeCrazyEgg(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "crazy-egg",
      input.connectionId,
    );
    const tool = this.registry.getTool("crazy-egg", input.toolName)!;
    if (tool.name !== "crazyEgg.recordConversions")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "conversion_record",
      "crazy-egg",
    );
    const data = await this.crazyEggApi.recordConversions(
      this.crazyEggCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.crazy_egg.record_conversions.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedSiteApiKey: true,
        exactSiteBound: true,
        providerRequestCount: 1,
        maxConversions: 25,
        providerResponseReturned: false,
        visitorIdentifiersReturned: false,
        analyticsReturned: false,
        recordingsReturned: false,
        writesEnabled: true,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Crazy Egg conversions recorded.");
  },

  async executeCustify(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "custify",
      input.connectionId,
    );
    const tool = this.registry.getTool("custify", input.toolName)!;
    if (tool.name !== "custify.listSegments")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "segment_inventory",
      "custify",
    );
    const data = await this.custifyApi.listSegments(
      this.custifyCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.custify.list_segments.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedApiKey: true,
        exactOriginBound: true,
        fixedPathAndQuery: true,
        providerRequestCount: 1,
        maxResults: 50,
        goalsReturned: false,
        tagsReturned: false,
        membershipReturned: false,
        customerDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Custify segments listed.");
  },

  async executeDatadog(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "datadog",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.datadogCredentials(connection, token.accessToken);
    const tool = this.registry.getTool("datadog", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "datadog.searchMonitors") {
      action = "datadog_search_monitors";
      await this.requireConnectorApproval(input, connection, action, "datadog");
      data = await this.datadogApi.searchMonitors(credentials, input.input);
    } else if (name === "datadog.searchIncidents") {
      action = "datadog_search_incidents";
      await this.requireConnectorApproval(input, connection, action, "datadog");
      data = await this.datadogApi.searchIncidents(credentials, input.input);
    } else if (name === "datadog.listServices") {
      action = "datadog_list_services";
      await this.requireConnectorApproval(input, connection, action, "datadog");
      data = await this.datadogApi.listServices(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.datadog.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        apiOriginHash: this.hash(credentials.apiOrigin),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Datadog ${name.split(".")[1]} completed.`);
  },

  async executeDigitalOcean(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "digitalocean",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.digitalOceanCredentials(token.credentials);
    const tool = this.registry.getTool("digitalocean", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "digitalocean.listProjects") {
      action = "digitalocean_project_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "digitalocean",
      );
      data = await this.digitalOceanApi.listProjects(credentials, input.input);
    } else if (name === "digitalocean.getProject") {
      action = "digitalocean_project_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "digitalocean",
      );
      data = await this.digitalOceanApi.getProject(credentials);
    } else if (name === "digitalocean.listProjectResources") {
      action = "digitalocean_project_resource_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "digitalocean",
      );
      data = await this.digitalOceanApi.listProjectResources(
        credentials,
        input.input,
      );
    } else if (name === "digitalocean.getSelectedResource") {
      action = "digitalocean_selected_resource_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "digitalocean",
      );
      data = await this.digitalOceanApi.getSelectedResource(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.digitalocean.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        teamIdHash: this.hash(credentials.teamId),
        projectIdHash: this.hash(credentials.projectId),
        resourceUrnHash: this.hash(credentials.resourceUrn),
        tokenRefreshed: token.refreshed,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `DigitalOcean ${name.split(".")[1]} completed.`);
  },

  async executeDrata(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "drata",
      input.connectionId,
    );
    const credentials = this.drataCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("drata", input.toolName)!;
    if (tool.name !== "drata.listFrameworks")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.drataApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.drata.frameworks_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        size: input.input.size ?? 20,
        paginated: Boolean(input.input.cursor),
      },
    });
    return this.ok(data, "Drata frameworks listed.");
  },

  async executeFirebase(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "firebase",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.firebaseCredentials(token.credentials);
    const tool = this.registry.getTool("firebase", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "firebase.listProjects") {
      action = "firebase_project_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "firebase",
      );
      data = await this.firebaseApi.listProjects(credentials, input.input);
    } else if (name === "firebase.getProject") {
      action = "firebase_project_get";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "firebase",
      );
      data = await this.firebaseApi.getProject(credentials);
    } else if (name === "firebase.listApps") {
      action = "firebase_app_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "firebase",
      );
      data = await this.firebaseApi.listApps(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.firebase.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        projectIdHash: this.hash(credentials.projectId),
        tokenRefreshed: token.refreshed,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Firebase ${name.split(".")[1]} completed.`);
  },

  async executeFlagsmithCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "flagsmith-cloud",
      input.connectionId,
    );
    const credentials = this.flagsmithCloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("flagsmith-cloud", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "flagsmith-cloud",
    );
    const data = await this.flagsmithCloudApi.read(credentials, operation, {
      resourceId: input.input.resourceId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.flagsmith-cloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Flagsmith Cloud ${operation} completed.`);
  },

  async executeFreshsales(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "freshsales",
      input.connectionId,
    );
    const tool = this.registry.getTool("freshsales", input.toolName)!;
    if (tool.name !== "freshsales.listContactFilters")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "contact_filter_metadata",
      "freshsales",
    );
    const data = await this.freshsalesApi.listContactFilters(
      this.freshsalesCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.freshsales.list_contact_filters.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedApiKey: true,
        exactAccountBound: true,
        fixedPath: true,
        providerRequestCount: 1,
        maxResults: 100,
        criteriaReturned: false,
        contactDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Freshsales contact-filter metadata listed.");
  },

  async executeGainsight(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "gainsight",
      input.connectionId,
    );
    const tool = this.registry.getTool("gainsight", input.toolName)!;
    if (tool.name !== "gainsight.listObjects")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "object_metadata_inventory",
      "gainsight",
    );
    const data = await this.gainsightApi.listObjects(
      this.gainsightCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.gainsight.list_objects.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedAccessKey: true,
        exactTenantBound: true,
        fixedPathAndQuery: true,
        providerRequestCount: 1,
        maxResults: 100,
        requestIdReturned: false,
        keyPrefixesReturned: false,
        createUpdateFlagsReturned: false,
        fieldMetadataReturned: false,
        customerDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Gainsight object metadata listed.");
  },
};

export const DeveloperExecutors1Registrations = {
  "ab-tasty-feature-experimentation": {
    methodName: "executeAbTastyFeatureExperimentation",
    needsConnection: false,
  },
  adjust: { methodName: "executeAdjust", needsConnection: false },
  "adobe-analytics": {
    methodName: "executeAdobeAnalytics",
    needsConnection: false,
  },
  "adobe-target": { methodName: "executeAdobeTarget", needsConnection: false },
  amplitude: { methodName: "executeAmplitude", needsConnection: false },
  "amplitude-experiment": {
    methodName: "executeAmplitudeExperiment",
    needsConnection: false,
  },
  "apollo-graphql-studio": {
    methodName: "executeApolloGraphOs",
    needsConnection: false,
  },
  appcues: { methodName: "executeAppcues", needsConnection: false },
  appsflyer: { methodName: "executeAppsFlyer", needsConnection: false },
  "atlassian-compass": {
    methodName: "executeAtlassianCompass",
    needsConnection: false,
  },
  bamboohr: { methodName: "executeBambooHR", needsConnection: false },
  bitbucket: { methodName: "executeBitbucket", needsConnection: false },
  blueconic: { methodName: "executeBlueConic", needsConnection: false },
  branch: { methodName: "executeBranch", needsConnection: false },
  "capsule-crm": { methodName: "executeCapsuleCrm", needsConnection: false },
  carta: { methodName: "executeCarta", needsConnection: false },
  census: { methodName: "executeCensus", needsConnection: false },
  chameleon: { methodName: "executeChameleon", needsConnection: false },
  clientsuccess: { methodName: "executeClientSuccess", needsConnection: false },
  cloudflare: { methodName: "executeCloudflare", needsConnection: false },
  configcat: { methodName: "executeConfigCat", needsConnection: false },
  "crazy-egg": { methodName: "executeCrazyEgg", needsConnection: false },
  custify: { methodName: "executeCustify", needsConnection: false },
  datadog: { methodName: "executeDatadog", needsConnection: false },
  digitalocean: { methodName: "executeDigitalOcean", needsConnection: false },
  drata: { methodName: "executeDrata", needsConnection: false },
  firebase: { methodName: "executeFirebase", needsConnection: false },
  "flagsmith-cloud": {
    methodName: "executeFlagsmithCloud",
    needsConnection: false,
  },
  freshsales: { methodName: "executeFreshsales", needsConnection: false },
  gainsight: { methodName: "executeGainsight", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof DeveloperExecutors1>;
