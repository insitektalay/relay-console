import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const CommercePaymentsExecutors2 = {
  async executeZohoInvoice(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho-invoice",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.zohoInvoiceCredentials(
      connection,
      token.accessToken,
    );
    const tool = this.registry.getTool("zoho-invoice", input.toolName)!;
    if (tool.name !== "zohoInvoice.getOrganization")
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    const action = "zoho_invoice_organization_get";
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "zoho-invoice",
    );
    const data = await this.zohoInvoiceApi.getOrganization(credentials);
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: "marketplace.zoho-invoice.getOrganization.executed",
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        action,
        organizationIdHash: this.hash(credentials.organizationId),
        region: connection.metadata?.zohoRegion,
      },
    });
    return this.ok(data, "Zoho Invoice getOrganization completed.");
  },
};

export const CommercePaymentsExecutors2Registrations = {
  "zoho-invoice": { methodName: "executeZohoInvoice", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof CommercePaymentsExecutors2>;
