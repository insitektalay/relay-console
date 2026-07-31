import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import type { MarketplaceConnectorExecutorRequest } from "../../../types";

export const LegalComplianceExecutors1 = {
  async executeClioManage(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "clio-manage",
      input.connectionId,
    );
    const tool = this.registry.getTool("clio-manage", input.toolName)!;
    if (tool.name !== "clioManage.getConnectionAuthority")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "clio_manage_connection_authority_get",
      "clio-manage",
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const data = await this.clioManageApi.getConnectionAuthority({
      accessToken: token.accessToken,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.clio_manage.connection_authority.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        apiRegion: "us",
        identityAndLegalPracticeDataExcluded: true,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Clio Manage connection authority verified.");
  },

  async executeClioGrow(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "clio-grow",
      input.connectionId,
    );
    const tool = this.registry.getTool("clio-grow", input.toolName)!;
    if (tool.name !== "clioGrow.getConnectionAuthority")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    await this.requireConnectorApproval(
      input,
      connection,
      "clio_grow_connection_authority_get",
      "clio-grow",
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const data = await this.clioGrowApi.getConnectionAuthority({
      accessToken: token.accessToken,
    });
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.clio_grow.connection_authority.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        apiRegion: "us",
        identityFirmAndLegalIntakeDataExcluded: true,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, "Clio Grow connection authority verified.");
  },

  async executeGoogleVault(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "google-vault",
      input.connectionId,
    );
    const tool = this.registry.getTool("google-vault", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    let data: unknown;
    if (tool.name === "googleVault.listMatters") {
      await this.requireConnectorApproval(
        input,
        connection,
        "google_vault_matters_list",
        "google-vault",
      );
      data = await this.googleVaultApi.listMatters(
        token.accessToken,
        input.input,
      );
    } else if (tool.name === "googleVault.getMatterOverview") {
      await this.requireConnectorApproval(
        input,
        connection,
        "google_vault_matter_overview_get",
        "google-vault",
      );
      data = await this.googleVaultApi.getMatterOverview(
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
      eventType: `marketplace.google_vault.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        matterIdHash: this.stringOrNull(input.input.matterId)
          ? this.hash(this.stringOrNull(input.input.matterId)!)
          : null,
        maxResults:
          input.input.maxResults ?? input.input.maxResultsPerResource ?? null,
        evidenceContentAndIdentitiesExcluded: true,
        automaticPagination: false,
        resultHash: this.hash(JSON.stringify(data)),
      },
    });
    return this.ok(data, `Google Vault ${tool.name.split(".")[1]} completed.`);
  },
};

export const LegalComplianceExecutors1Registrations = {
  "clio-grow": { methodName: "executeClioGrow", needsConnection: false },
  "clio-manage": { methodName: "executeClioManage", needsConnection: false },
  "google-vault": { methodName: "executeGoogleVault", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof LegalComplianceExecutors1>;
