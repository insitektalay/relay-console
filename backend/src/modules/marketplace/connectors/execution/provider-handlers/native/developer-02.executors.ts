import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";
import { ConnectorExecutionError } from "../../connector-execution.error";

export const DeveloperExecutors2 = {
  async executeGitHub(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "github",
      input.connectionId,
    );
    const tool = this.registry.getTool("github", input.toolName)!;
    if (tool.name === "relay_github_draft_comment") {
      const owner = this.requiredString(input.input.owner, "owner");
      const repo = this.requiredString(input.input.repo, "repo");
      const number = this.positiveInteger(input.input.number, "number");
      const body = this.requiredString(input.input.body, "body");
      if (body.length > 8000) {
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "body must be 8000 characters or fewer",
        );
      }
      return this.ok(
        {
          owner,
          repo,
          number,
          body,
          bodyHash: this.hash(body),
          providerSideEffect: false,
        },
        "GitHub comment draft prepared locally.",
      );
    }

    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_github_search_repositories") {
      const result = await this.githubApi.searchRepositories(
        token.accessToken,
        input.input.query,
        input.input.maxResults,
      );
      return this.ok(result, "GitHub repository search completed.");
    }
    if (tool.name === "relay_github_list_issues") {
      const result = await this.githubApi.listIssues(
        token.accessToken,
        input.input.owner,
        input.input.repo,
        input.input.state,
        input.input.maxResults,
      );
      return this.ok(result, "GitHub issues read completed.");
    }
    if (tool.name === "relay_github_list_pull_requests") {
      const result = await this.githubApi.listPullRequests(
        token.accessToken,
        input.input.owner,
        input.input.repo,
        input.input.state,
        input.input.maxResults,
      );
      return this.ok(result, "GitHub pull requests read completed.");
    }
    if (
      tool.name === "relay_github_comment_issue" ||
      tool.name === "relay_github_comment_pull_request"
    ) {
      const owner = this.requiredString(input.input.owner, "owner");
      const repo = this.requiredString(input.input.repo, "repo");
      const number = this.positiveInteger(
        tool.name === "relay_github_comment_issue"
          ? input.input.issueNumber
          : input.input.pullNumber,
        tool.name === "relay_github_comment_issue"
          ? "issueNumber"
          : "pullNumber",
      );
      const body = this.requiredString(input.input.body, "body");
      const idempotencyKey = this.requiredString(
        input.input.idempotencyKey,
        "idempotencyKey",
      );
      if (body.length > 8000) {
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "body must be 8000 characters or fewer",
        );
      }
      const action =
        tool.name === "relay_github_comment_issue"
          ? "github_issue_comment_create"
          : "github_pull_request_comment_create";
      await this.requireGitHubApproval(input, connection, {
        action,
        owner,
        repo,
        number,
        body,
        idempotencyKey,
      });
      const result = await this.githubApi.createConversationComment(
        token.accessToken,
        { owner, repo, number, body, idempotencyKey },
      );
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: `marketplace.github.${
          tool.name === "relay_github_comment_issue" ? "issue" : "pull_request"
        }.comment.created`,
        resourceId: connection.id,
        metadata: {
          owner,
          repo,
          number,
          bodyHash: this.hash(body),
          idempotencyKey,
          commentId: this.stringOrNull(
            (result as Record<string, unknown>).commentId,
          ),
        },
      });
      return this.ok(result, "Approved GitHub comment posted.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeGitLab(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "gitlab",
      input.connectionId,
    );
    const tool = this.registry.getTool("gitlab", input.toolName)!;
    if (tool.name === "relay_gitlab_draft_comment") {
      const projectPath = this.requiredString(
        input.input.projectPath,
        "projectPath",
      );
      const iid = this.positiveInteger(input.input.iid, "iid");
      const target = this.requiredString(input.input.target, "target");
      const body = this.requiredString(input.input.body, "body");
      if (!["issue", "merge_request"].includes(target)) {
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "target must be issue or merge_request",
        );
      }
      if (body.length > 8000) {
        throw new ConnectorExecutionError(
          "provider_validation_error",
          "body must be 8000 characters or fewer",
        );
      }
      return this.ok(
        {
          projectPath,
          iid,
          target,
          body,
          bodyHash: this.hash(body),
          providerSideEffect: false,
        },
        "GitLab comment draft prepared locally.",
      );
    }
    const token = await this.oauth.refreshIfNeeded(connection);
    if (tool.name === "relay_gitlab_search_projects") {
      const result = await this.gitlabApi.searchProjects(
        token.accessToken,
        input.input.query,
        input.input.maxResults,
      );
      return this.ok(result, "GitLab project search completed.");
    }
    if (tool.name === "relay_gitlab_list_issues") {
      const result = await this.gitlabApi.listIssues(
        token.accessToken,
        input.input.projectPath,
        input.input.state,
        input.input.maxResults,
      );
      return this.ok(result, "GitLab issues read completed.");
    }
    if (tool.name === "relay_gitlab_list_merge_requests") {
      const result = await this.gitlabApi.listMergeRequests(
        token.accessToken,
        input.input.projectPath,
        input.input.state,
        input.input.maxResults,
      );
      return this.ok(result, "GitLab merge requests read completed.");
    }
    if (
      tool.name === "relay_gitlab_comment_issue" ||
      tool.name === "relay_gitlab_comment_merge_request"
    ) {
      const projectPath = this.requiredString(
        input.input.projectPath,
        "projectPath",
      );
      const target =
        tool.name === "relay_gitlab_comment_issue" ? "issue" : "merge_request";
      const iid = this.positiveInteger(
        target === "issue" ? input.input.issueIid : input.input.mergeRequestIid,
        target === "issue" ? "issueIid" : "mergeRequestIid",
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
          ? "gitlab_issue_comment_create"
          : "gitlab_merge_request_comment_create";
      await this.requireGitLabApproval(input, connection, {
        action,
        projectPath,
        iid,
        body,
        idempotencyKey,
      });
      const result = await this.gitlabApi.createComment(token.accessToken, {
        projectPath,
        iid,
        target,
        body,
        idempotencyKey,
      });
      await this.recordAudit({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: `marketplace.gitlab.${target}.comment.created`,
        resourceId: connection.id,
        metadata: {
          projectPath,
          iid,
          bodyHash: this.hash(body),
          idempotencyKey,
          noteId: this.stringOrNull((result as Record<string, unknown>).noteId),
        },
      });
      return this.ok(result, "Approved GitLab comment posted.");
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },

  async executeGoogleAnalytics(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-analytics",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-analytics", input.toolName)!;
    const requestedPropertyId = this.stringOrNull(input.input.propertyId);
    const boundPropertyId = this.stringOrNull(
      connection.metadata?.selectedPropertyId,
    );
    if (!boundPropertyId || requestedPropertyId !== boundPropertyId)
      return this.safeError(
        "connection_not_ready",
        "Google Analytics requires the explicit GA4 property bound during OAuth connection setup.",
      );
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "googleAnalytics.getProperty")
      data = await this.googleAnalyticsApi.getProperty(
        token.accessToken,
        input.input,
      );
    else if (tool.name === "googleAnalytics.getOverview")
      data = await this.googleAnalyticsApi.getOverview(
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
      eventType: `marketplace.google-analytics.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        propertyIdHash: this.hash(boundPropertyId),
        explicitPropertyOnly: true,
        propertyDiscoveryEnabled: false,
        arbitraryReportsEnabled: false,
        realtimeReportsEnabled: false,
        audienceOrUserDetailAccessed: false,
        pageSearchGeoCustomDetailAccessed: false,
        mutationsEnabled: false,
        automaticPagination: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      `Google Analytics ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeGoogleMapsPlatform(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-maps-platform",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-maps-platform", input.toolName)!;
    const apiKey = this.requiredMapsApiKey(
      this.credentials.decrypt(connection),
    );
    let data: unknown;
    if (tool.name === "googleMapsPlatform.geocodeAddress")
      data = await this.googleMapsPlatformApi.geocodeAddress(
        apiKey,
        input.input,
      );
    else if (tool.name === "googleMapsPlatform.reverseGeocode")
      data = await this.googleMapsPlatformApi.reverseGeocode(
        apiKey,
        input.input,
      );
    else if (tool.name === "googleMapsPlatform.searchPlaces")
      data = await this.googleMapsPlatformApi.searchPlaces(apiKey, input.input);
    else if (tool.name === "googleMapsPlatform.computeRoute")
      data = await this.googleMapsPlatformApi.computeRoute(apiKey, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.google-maps-platform.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        serverApiKeyOnly: true,
        fixedEndpointsOnly: true,
        providerRequestCount: 1,
        writesEnabled: false,
        expandedPlaceContentEnabled: false,
        trackingNavigationEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        persistenceEnabled: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      `Google Maps Platform ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeGoogleSearchConsole(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-search-console",
      input.connectionId,
    );
    const tool = this.registry.getTool(
      "google-search-console",
      input.toolName,
    )!;
    const boundSiteUrl = this.stringOrNull(
      connection.metadata?.selectedSiteUrl,
    );
    if (!boundSiteUrl)
      return this.safeError(
        "connection_not_ready",
        "Google Search Console requires a property bound during OAuth connection setup.",
      );
    const suppliedSiteUrl = this.stringOrNull(input.input.siteUrl);
    if (suppliedSiteUrl && suppliedSiteUrl !== boundSiteUrl)
      return this.safeError(
        "connection_not_ready",
        "Google Search Console actions cannot leave the property bound during OAuth setup.",
      );
    const scopedInput =
      tool.name === "googleSearchConsole.listProperties"
        ? input.input
        : { ...input.input, siteUrl: boundSiteUrl };
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "googleSearchConsole.listProperties")
      data = await this.googleSearchConsoleApi.listProperties(
        token.accessToken,
        scopedInput,
      );
    else if (tool.name === "googleSearchConsole.getProperty")
      data = await this.googleSearchConsoleApi.getProperty(
        token.accessToken,
        scopedInput,
      );
    else if (tool.name === "googleSearchConsole.querySearchAnalytics")
      data = await this.googleSearchConsoleApi.querySearchAnalytics(
        token.accessToken,
        scopedInput,
      );
    else if (tool.name === "googleSearchConsole.inspectUrl")
      data = await this.googleSearchConsoleApi.inspectUrl(
        token.accessToken,
        scopedInput,
      );
    else if (tool.name === "googleSearchConsole.listSitemaps")
      data = await this.googleSearchConsoleApi.listSitemaps(
        token.accessToken,
        scopedInput,
      );
    else if (tool.name === "googleSearchConsole.getSitemap")
      data = await this.googleSearchConsoleApi.getSitemap(
        token.accessToken,
        scopedInput,
      );
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.google-search-console.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        siteUrlHash: this.hash(boundSiteUrl),
        readOnlyV1: true,
        selectedPropertyOnly:
          tool.name !== "googleSearchConsole.listProperties",
        writesEnabled: false,
        broadExportsEnabled: false,
        automaticPagination: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(
      data,
      `Google Search Console ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeGreenhouse(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "greenhouse",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.greenhouseCredentials(token.credentials);
    const tool = this.registry.getTool("greenhouse", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "greenhouse.listJobs") {
      action = "greenhouse_job_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "greenhouse",
      );
      data = await this.greenhouseApi.listJobs(credentials, input.input);
    } else if (name === "greenhouse.listOffices") {
      action = "greenhouse_office_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "greenhouse",
      );
      data = await this.greenhouseApi.listOffices(credentials, input.input);
    } else if (name === "greenhouse.listDepartments") {
      action = "greenhouse_department_list";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "greenhouse",
      );
      data = await this.greenhouseApi.listDepartments(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.greenhouse.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        organizationIdHash: this.hash(credentials.organizationId),
        tokenRefreshed: token.refreshed,
        limit: input.input.limit ?? null,
        automaticPagination: false,
        candidateDataReturned: false,
      },
    });
    return this.ok(data, `Greenhouse ${name.split(".")[1]} completed.`);
  },

  async executeGrowthBookCloud(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "growthbook-cloud",
      input.connectionId,
    );
    const credentials = this.growthBookCloudCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("growthbook-cloud", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "growthbook-cloud",
    );
    const data = await this.growthBookCloudApi.read(credentials, operation, {
      resourceId: input.input.resourceId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.growthbook-cloud.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `GrowthBook Cloud ${operation} completed.`);
  },

  async executeHeroku(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "heroku",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.herokuCredentials(token.credentials);
    const tool = this.registry.getTool("heroku", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "heroku.listTeamApps") {
      action = "heroku_team_app_list";
      await this.requireConnectorApproval(input, connection, action, "heroku");
      data = await this.herokuApi.listTeamApps(credentials, input.input);
    } else if (name === "heroku.listReleases") {
      action = "heroku_app_release_list";
      await this.requireConnectorApproval(input, connection, action, "heroku");
      data = await this.herokuApi.listReleases(credentials, input.input);
    } else if (name === "heroku.listDynos") {
      action = "heroku_app_dyno_list";
      await this.requireConnectorApproval(input, connection, action, "heroku");
      data = await this.herokuApi.listDynos(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.heroku.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        teamIdHash: this.hash(credentials.teamId),
        appIdHash: this.hash(credentials.appId),
        tokenRefreshed: token.refreshed,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Heroku ${name.split(".")[1]} completed.`);
  },

  async executeHightouch(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "hightouch",
        input.connectionId,
      ),
      credentials = this.hightouchCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("hightouch", input.toolName)!;
    if (tool.name !== "hightouch.getModelReadinessSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.hightouchApi.getModelReadinessSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Hightouch model readiness summary read completed.");
  },

  async executeHomebrew(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "homebrew",
      input.connectionId,
    );
    const credentials = this.homebrewCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("homebrew", input.toolName)!;
    let data: unknown;
    if (tool.name === "homebrew.getFormulaSummary")
      data = await this.homebrewApi.getFormulaSummary(credentials);
    else if (tool.name === "homebrew.getCaskSummary")
      data = await this.homebrewApi.getCaskSummary(credentials);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.homebrew.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        fixedPublicOrigin: true,
        selectedItemBound: true,
        sourceAndArtifactDetailsExcluded: true,
        packageAndHostMutationsBlocked: true,
      },
    });
    return this.ok(data, `Homebrew ${tool.name.split(".")[1]} completed.`);
  },

  async executeHyperproof(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "hyperproof",
      input.connectionId,
    );
    const credentials = this.hyperproofCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("hyperproof", input.toolName)!;
    if (tool.name !== "hyperproof.getControl")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.hyperproofApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.hyperproof.control_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        controlId: this.stringOrNull(input.input.controlId),
      },
    });
    return this.ok(data, "Hyperproof control read.");
  },

  async executeInsightly(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "insightly",
      input.connectionId,
    );
    const tool = this.registry.getTool("insightly", input.toolName)!;
    if (tool.name !== "insightly.listCustomFields")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "custom_field_metadata",
      "insightly",
    );
    const data = await this.insightlyApi.listCustomFields(
      this.insightlyCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.insightly.list_custom_fields.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedApiKey: true,
        exactPodBound: true,
        fixedPath: true,
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
    return this.ok(data, "Insightly custom-field metadata listed.");
  },

  async executeKeap(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "keap",
      input.connectionId,
    );
    const tool = this.registry.getTool("keap", input.toolName)!;
    if (tool.name !== "keap.listContactCustomFields")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "contact_custom_field_metadata",
      "keap",
    );
    const data = await this.keapApi.listContactCustomFields(
      this.keapCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.keap.list_contact_custom_fields.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedToken: true,
        fixedProviderOrigin: true,
        fixedContactModelPath: true,
        providerRequestCount: 1,
        maxResults: 100,
        privateSchemaLogicReturned: false,
        contactDataReturned: false,
        commerceDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Keap contact custom-field metadata listed.");
  },

  async executeKochava(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "kochava",
        input.connectionId,
      ),
      credentials = this.kochavaCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("kochava", input.toolName)!;
    if (tool.name !== "kochava.listAppReferences")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.kochavaApi.listAppReferences(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Kochava app-reference read completed.");
  },

  async executeLaunchDarkly(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "launchdarkly",
      input.connectionId,
    );
    const credentials = this.launchDarklyCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("launchdarkly", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "launchdarkly",
    );
    const data = await this.launchDarklyApi.read(credentials, operation, {
      resourceId: input.input.resourceId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.launchdarkly.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `LaunchDarkly ${operation} completed.`);
  },

  async executeLedgy(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "ledgy",
      input.connectionId,
    );
    const credentials = this.ledgyCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("ledgy", input.toolName)!;
    if (tool.name !== "ledgy.getCompanyIdentity")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.ledgyApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.ledgy.company_identity_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
      },
    });
    return this.ok(data, "Ledgy company identity read.");
  },

  async executeLever(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "lever",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.leverCredentials(token.credentials);
    const tool = this.registry.getTool("lever", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "lever.listPostings") {
      action = "lever_posting_list";
      await this.requireConnectorApproval(input, connection, action, "lever");
      data = await this.leverApi.listPostings(credentials, input.input);
    } else if (name === "lever.listStages") {
      action = "lever_stage_list";
      await this.requireConnectorApproval(input, connection, action, "lever");
      data = await this.leverApi.listStages(credentials, input.input);
    } else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.lever.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(credentials.accountId),
        tokenRefreshed: token.refreshed,
        limit: input.input.limit ?? null,
        automaticPagination: false,
        confidentialDataReturned: false,
        candidateDataReturned: false,
      },
    });
    return this.ok(data, `Lever ${name.split(".")[1]} completed.`);
  },

  async executeLogRocket(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "logrocket",
      input.connectionId,
    );
    const tool = this.registry.getTool("logrocket", input.toolName)!;
    if (tool.name !== "logrocket.findIssues")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "project_issues_find",
      "logrocket",
    );
    const data = await this.logRocketMcp.findIssues(
      this.logRocketCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.logrocket.find_issues.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedProjectApiKey: true,
        exactProjectBound: true,
        issuesToolsetOnly: true,
        remoteToolName: "find_issues",
        sessionsEnabled: false,
        sessionWatchingEnabled: false,
        metricsEnabled: false,
        galileoEnabled: false,
        accountDiscoveryEnabled: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "LogRocket project issues queried.");
  },

  async executeLytics(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "lytics",
        input.connectionId,
      ),
      credentials = this.lyticsCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("lytics", input.toolName)!;
    if (tool.name !== "lytics.getSegmentReadinessSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.lyticsApi.getSegmentReadinessSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(data, "Lytics segment readiness summary read completed.");
  },

  async executeMatomoSelfHosted(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "matomo-self-hosted",
      input.connectionId,
    );
    const credentials = this.matomoSelfHostedCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("matomo-self-hosted", input.toolName)!;
    await this.requireConnectorApproval(
      input,
      connection,
      tool.functionName,
      "matomo-self-hosted",
    );
    const { approvalId: _approvalId, ...payload } = input.input;
    let data: unknown;
    if (tool.name === "matomoSelfHosted.summary")
      data = await this.matomoSelfHostedApi.summary(credentials, payload);
    else if (tool.name === "matomoSelfHosted.topPages")
      data = await this.matomoSelfHostedApi.topPages(credentials, payload);
    else if (tool.name === "matomoSelfHosted.referrerTypes")
      data = await this.matomoSelfHostedApi.referrerTypes(credentials, payload);
    else if (tool.name === "matomoSelfHosted.countries")
      data = await this.matomoSelfHostedApi.countries(credentials, payload);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.matomo_self_hosted.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        siteId: credentials.siteId,
        installationBound: true,
        window: this.stringOrNull(input.input.window) ?? "today",
        limit: input.input.limit ?? null,
        analyticsContentLogged: false,
      },
    });
    return this.ok(
      data,
      `Matomo Self-Hosted ${tool.name.split(".")[1]} completed.`,
    );
  },

  async executeMicrosoftEntraId(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "microsoft-entra-id",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const tool = this.registry.getTool("microsoft-entra-id", input.toolName)!;
    if (tool.name !== "microsoft-entra-id.getSignedInIdentity")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const operation = this.requiredString(input.input.operation, "operation");
    const data = await this.microsoftEntraIdGraph.read(
      token.accessToken,
      operation,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.microsoft_entra_id.identity_read",
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, "Microsoft Entra signed-in identity read.");
  },

  async executeMixpanel(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "mixpanel",
      input.connectionId,
    );
    const credentials = this.mixpanelCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("mixpanel", input.toolName)!;
    let data: unknown;
    if (tool.name === "mixpanel.getProjectBinding")
      data = await this.mixpanelApi.accountBinding(credentials);
    else if (tool.name === "mixpanel.listCohorts")
      data = await this.mixpanelApi.listCohorts(credentials);
    else if (tool.name === "mixpanel.listAnnotations")
      data = await this.mixpanelApi.listAnnotations(credentials, input.input);
    else
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.mixpanel.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        projectIdHash: this.hash(credentials.projectId),
      },
    });
    return this.ok(data, `Mixpanel ${tool.name.split(".")[1]} completed.`);
  },

  async executeMParticle(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
        input.workspaceId,
        "mparticle",
        input.connectionId,
      ),
      credentials = this.mParticleCredentials(
        this.credentials.decrypt(connection),
      ),
      tool = this.registry.getTool("mparticle", input.toolName)!;
    if (tool.name !== "mparticle.getAudienceReadinessSummary")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data =
      await this.mParticleApi.getAudienceReadinessSummary(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${tool.functionName}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability },
    });
    return this.ok(
      data,
      "mParticle audience readiness summary read completed.",
    );
  },

  async executeNetlify(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "netlify",
      input.connectionId,
    );
    const credentials = this.netlifyCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("netlify", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "netlify.listSites") {
      action = "netlify_site_list";
      await this.requireConnectorApproval(input, connection, action, "netlify");
      data = await this.netlifyApi.listSites(credentials, input.input);
    } else if (name === "netlify.getSite") {
      action = "netlify_site_get";
      await this.requireConnectorApproval(input, connection, action, "netlify");
      data = await this.netlifyApi.getSite(credentials);
    } else if (name === "netlify.listDeploys") {
      action = "netlify_site_deploy_list";
      await this.requireConnectorApproval(input, connection, action, "netlify");
      data = await this.netlifyApi.listDeploys(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.netlify.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountSlugHash: this.hash(credentials.accountSlug),
        siteIdHash: this.hash(credentials.siteId),
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Netlify ${name.split(".")[1]} completed.`);
  },

  async executeNewRelic(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "new-relic",
      input.connectionId,
    );
    const credentials = this.newRelicCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("new-relic", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "newRelic.searchEntities") {
      action = "new_relic_search_entities";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "new-relic",
      );
      data = await this.newRelicApi.searchEntities(credentials, input.input);
    } else if (name === "newRelic.getEntity") {
      action = "new_relic_get_entity";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "new-relic",
      );
      data = await this.newRelicApi.getEntity(
        credentials,
        input.input as { guid: unknown },
      );
    } else if (name === "newRelic.readAccountHealth") {
      action = "new_relic_read_account_health";
      await this.requireConnectorApproval(
        input,
        connection,
        action,
        "new-relic",
      );
      data = await this.newRelicApi.readAccountHealth(credentials);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.new-relic.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        accountIdHash: this.hash(String(credentials.accountId)),
        region: credentials.region,
        entityGuidHash: this.stringOrNull(input.input.guid)
          ? this.hash(this.stringOrNull(input.input.guid)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `New Relic ${name.split(".")[1]} completed.`);
  },

  async executeNimble(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "nimble",
      input.connectionId,
    );
    const tool = this.registry.getTool("nimble", input.toolName)!;
    if (tool.name !== "nimble.listContactFields")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "contact_field_metadata",
      "nimble",
    );
    const data = await this.nimbleApi.listContactFields(
      this.nimbleCredentials(this.credentials.decrypt(connection)),
      input.input,
    );
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.nimble.list_contact_fields.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        inputHash: this.hash(JSON.stringify(input.input)),
        customerOwnedApiKey: true,
        fixedProviderOrigin: true,
        fixedPath: true,
        providerRequestCount: 1,
        maxResults: 100,
        privateSchemaLogicReturned: false,
        contactDataReturned: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Nimble contact-field metadata listed.");
  },

  async executeOkta(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "okta",
      input.connectionId,
    );
    const credentials = this.oktaCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("okta", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "okta.listApplications") {
      action = "okta_application_list";
      await this.requireConnectorApproval(input, connection, action, "okta");
      data = await this.oktaApi.listApplications(credentials, input.input);
    } else if (name === "okta.getApplication") {
      action = "okta_application_get";
      await this.requireConnectorApproval(input, connection, action, "okta");
      data = await this.oktaApi.getApplication(credentials);
    } else if (name === "okta.listApplicationGroups") {
      action = "okta_application_group_list";
      await this.requireConnectorApproval(input, connection, action, "okta");
      data = await this.oktaApi.listApplicationGroups(credentials, input.input);
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.okta.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        orgOriginHash: this.hash(credentials.origin),
        applicationIdHash: this.hash(credentials.applicationId),
        limit: input.input.limit ?? null,
        accessTokenPersisted: false,
      },
    });
    return this.ok(data, `Okta ${name.split(".")[1]} completed.`);
  },

  async executeOptimizelyRollouts(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "optimizely-rollouts",
      input.connectionId,
    );
    const credentials = this.optimizelyRolloutsCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("optimizely-rollouts", input.toolName)!;
    const operation = this.requiredString(input.input.operation, "operation");
    await this.requireConnectorApproval(
      input,
      connection,
      tool.capability,
      "optimizely-rollouts",
    );
    const data = await this.optimizelyRolloutsApi.read(credentials, operation, {
      resourceId: input.input.resourceId,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.optimizely-rollouts.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: { toolName: tool.name, capability: tool.capability, operation },
    });
    return this.ok(data, `Optimizely Rollouts ${operation} completed.`);
  },

  async executeOsano(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "osano",
      input.connectionId,
    );
    const credentials = this.osanoCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("osano", input.toolName)!;
    if (tool.name !== "osano.listCookieConsentConfigs")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const data = await this.osanoApi.read(credentials, input.input);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.osano.cookie_consent_configs_read",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        operation: this.stringOrNull(input.input.operation),
        limit: input.input.limit ?? 20,
      },
    });
    return this.ok(data, "Osano consent configurations listed.");
  },
};

export const DeveloperExecutors2Registrations = {
  github: { methodName: "executeGitHub", needsConnection: false },
  gitlab: { methodName: "executeGitLab", needsConnection: false },
  "google-analytics": {
    methodName: "executeGoogleAnalytics",
    needsConnection: false,
  },
  "google-maps-platform": {
    methodName: "executeGoogleMapsPlatform",
    needsConnection: false,
  },
  "google-search-console": {
    methodName: "executeGoogleSearchConsole",
    needsConnection: false,
  },
  greenhouse: { methodName: "executeGreenhouse", needsConnection: false },
  "growthbook-cloud": {
    methodName: "executeGrowthBookCloud",
    needsConnection: false,
  },
  heroku: { methodName: "executeHeroku", needsConnection: false },
  hightouch: { methodName: "executeHightouch", needsConnection: false },
  homebrew: { methodName: "executeHomebrew", needsConnection: false },
  hyperproof: { methodName: "executeHyperproof", needsConnection: false },
  insightly: { methodName: "executeInsightly", needsConnection: false },
  keap: { methodName: "executeKeap", needsConnection: false },
  kochava: { methodName: "executeKochava", needsConnection: false },
  launchdarkly: { methodName: "executeLaunchDarkly", needsConnection: false },
  ledgy: { methodName: "executeLedgy", needsConnection: false },
  lever: { methodName: "executeLever", needsConnection: false },
  logrocket: { methodName: "executeLogRocket", needsConnection: false },
  lytics: { methodName: "executeLytics", needsConnection: false },
  "matomo-self-hosted": {
    methodName: "executeMatomoSelfHosted",
    needsConnection: false,
  },
  "microsoft-entra-id": {
    methodName: "executeMicrosoftEntraId",
    needsConnection: false,
  },
  mixpanel: { methodName: "executeMixpanel", needsConnection: false },
  mparticle: { methodName: "executeMParticle", needsConnection: false },
  netlify: { methodName: "executeNetlify", needsConnection: false },
  "new-relic": { methodName: "executeNewRelic", needsConnection: false },
  nimble: { methodName: "executeNimble", needsConnection: false },
  okta: { methodName: "executeOkta", needsConnection: false },
  "optimizely-rollouts": {
    methodName: "executeOptimizelyRollouts",
    needsConnection: false,
  },
  osano: { methodName: "executeOsano", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof DeveloperExecutors2>;
