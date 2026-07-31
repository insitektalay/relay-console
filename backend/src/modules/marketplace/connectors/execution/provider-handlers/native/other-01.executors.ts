import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const OtherExecutors1 = {
  async executeBrandfolder(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "brandfolder",
      input.connectionId,
    );
    const credentials = this.brandfolderCredentials(
      this.credentials.decrypt(connection),
    );
    const tool = this.registry.getTool("brandfolder", input.toolName)!;
    const path =
      tool.name === "brandfolder.upload"
        ? ""
        : this.requiredString(input.input.path, "path");
    const query =
      input.input.query &&
      typeof input.input.query === "object" &&
      !Array.isArray(input.input.query)
        ? (input.input.query as Record<string, unknown>)
        : undefined;
    let data: unknown;
    if (tool.name === "brandfolder.read") {
      data = await this.brandfolderApi.request(credentials, {
        method: "GET",
        path,
        query,
      });
    } else if (tool.name === "brandfolder.manage") {
      await this.requireConnectorApproval(
        input,
        connection,
        "brandfolder_dam_manage",
        "brandfolder",
      );
      data = await this.brandfolderApi.request(credentials, {
        method: this.requiredString(input.input.method, "method"),
        path,
        query,
        json:
          input.input.json &&
          typeof input.input.json === "object" &&
          !Array.isArray(input.input.json)
            ? (input.input.json as Record<string, unknown>)
            : undefined,
        contentBase64:
          this.stringOrNull(input.input.contentBase64) ?? undefined,
        contentType: this.stringOrNull(input.input.contentType) ?? undefined,
        headers:
          input.input.headers &&
          typeof input.input.headers === "object" &&
          !Array.isArray(input.input.headers)
            ? (input.input.headers as Record<string, unknown>)
            : undefined,
      });
    } else if (tool.name === "brandfolder.upload") {
      await this.requireConnectorApproval(
        input,
        connection,
        "brandfolder_dam_manage",
        "brandfolder",
      );
      const destinationType = this.requiredString(
        input.input.destinationType,
        "destinationType",
      );
      if (destinationType !== "brandfolder" && destinationType !== "collection")
        return this.safeError(
          "provider_validation_error",
          "destinationType must be brandfolder or collection",
        );
      data = await this.brandfolderApi.uploadAsset(credentials, {
        destinationType,
        destinationId: this.requiredString(
          input.input.destinationId,
          "destinationId",
        ),
        sectionId: this.requiredString(input.input.sectionId, "sectionId"),
        name: this.requiredString(input.input.name, "name"),
        description: this.stringOrNull(input.input.description) ?? undefined,
        fileName: this.requiredString(input.input.fileName, "fileName"),
        contentBase64: this.requiredString(
          input.input.contentBase64,
          "contentBase64",
        ),
        contentType: this.stringOrNull(input.input.contentType) ?? undefined,
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
      eventType: `marketplace.brandfolder.${tool.name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: tool.name,
        capability: tool.capability,
        method:
          tool.name === "brandfolder.read"
            ? "GET"
            : tool.name === "brandfolder.upload"
              ? "UPLOAD"
              : this.stringOrNull(input.input.method),
        path:
          tool.name === "brandfolder.upload"
            ? `/${this.stringOrNull(input.input.destinationType) ?? "destination"}/${this.stringOrNull(input.input.destinationId) ?? "unknown"}/assets`
            : path,
      },
    });
    return this.ok(data, `Brandfolder ${tool.name.split(".")[1]} completed.`);
  },

  async executeZohoMail(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "zoho-mail",
      input.connectionId,
    );
    const tool = this.registry.getTool("zoho-mail", input.toolName)!;
    const token = await this.oauth.refreshIfNeeded(connection);
    const mailOrigin = this.stringOrNull(connection.metadata?.zohoMailOrigin);
    const boundAccountId = this.stringOrNull(
      connection.metadata?.zohoAccountId,
    );
    if (!mailOrigin || !boundAccountId) {
      return this.safeError(
        "connection_not_ready",
        "Zoho Mail regional account binding is missing",
      );
    }
    if (tool.name === "relay_zoho_mail_list_accounts") {
      if (Object.keys(input.input ?? {}).length) {
        return this.safeError(
          "provider_validation_error",
          "Zoho Mail account listing does not accept parameters",
        );
      }
      const accounts = await this.zohoMailApi.listAccounts(
        token.accessToken,
        mailOrigin,
      );
      if (!accounts.some((account) => account.accountId === boundAccountId)) {
        return this.safeError(
          "provider_validation_error",
          "Zoho Mail connected account was not returned by the regional API",
        );
      }
      return this.ok(
        {
          accounts,
          count: accounts.length,
          boundAccountId,
          providerRequestCount: 1,
        },
        "Zoho Mail accounts read completed.",
      );
    }
    const accountId = this.stringOrNull(input.input.accountId);
    if (accountId !== boundAccountId) {
      return this.safeError(
        "provider_validation_error",
        "accountId must match the connection-bound Zoho Mail account",
      );
    }
    if (tool.name === "relay_zoho_mail_list_folders") {
      const folders = await this.zohoMailApi.listFolders(
        token.accessToken,
        mailOrigin,
        accountId,
      );
      return this.ok(
        { folders, count: folders.length, accountId, providerRequestCount: 1 },
        "Zoho Mail folders read completed.",
      );
    }
    if (tool.name === "relay_zoho_mail_list_messages_filtered") {
      const messages = await this.zohoMailApi.listMessages(
        token.accessToken,
        mailOrigin,
        accountId,
        input.input.folderId,
        input.input.limit,
      );
      return this.ok(
        {
          messages,
          count: messages.length,
          accountId,
          folderId: this.stringOrNull(input.input.folderId),
          providerRequestCount: 1,
          nextPageFollowed: false,
        },
        "Zoho Mail message summaries read completed.",
      );
    }
    if (tool.name === "relay_zoho_mail_get_message") {
      const message = await this.zohoMailApi.getMessage(
        token.accessToken,
        mailOrigin,
        accountId,
        input.input.folderId,
        input.input.messageId,
      );
      return this.ok(
        { message, accountId, providerRequestCount: 3 },
        "Zoho Mail message read completed.",
      );
    }
    return this.safeError(
      "tool_unavailable",
      `${input.toolName} is not implemented`,
    );
  },
};

export const OtherExecutors1Registrations = {
  brandfolder: { methodName: "executeBrandfolder", needsConnection: false },
  "zoho-mail": { methodName: "executeZohoMail", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof OtherExecutors1>;
