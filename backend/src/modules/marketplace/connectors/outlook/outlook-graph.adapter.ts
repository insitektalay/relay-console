import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

export type OutlookGraphRequest = {
  accessToken: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
};

export class OutlookGraphError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class OutlookGraphAdapter {
  private readonly baseUrl = "https://graph.microsoft.com/v1.0";

  async getMe(accessToken: string) {
    const profile = await this.readOnlyGet(
      accessToken,
      new URL("https://graph.microsoft.com/oidc/userinfo"),
      false,
    );
    return {
      id: this.scalar(profile.sub, 256),
      displayName: this.scalar(profile.name, 512),
      mail: this.scalar(profile.email, 320),
      userPrincipalName: this.scalar(profile.email, 320),
    };
  }

  async listRootMailFolders(
    accessToken: string,
    input: Record<string, unknown>,
  ) {
    const maximum = this.maxResults(input.maxResults);
    const url = this.readUrl("/me/mailFolders", {
      $top: String(maximum),
      $select:
        "id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount",
    });
    const root = await this.readOnlyGet(accessToken, url, false);
    const folders = this.values(root)
      .slice(0, maximum)
      .map((entry) => this.folder(entry));
    return {
      semanticReadContract: "outlook-signed-in-root-mail-folders-v1",
      folders,
      resultCount: folders.length,
      truncated: Boolean(root["@odata.nextLink"]),
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async listInboxMessages(accessToken: string, input: Record<string, unknown>) {
    return this.listBoundedInbox(accessToken, input, false);
  }

  async listUnreadMessages(
    accessToken: string,
    input: Record<string, unknown>,
  ) {
    return this.listBoundedInbox(accessToken, input, true);
  }

  async getMessage(accessToken: string, input: Record<string, unknown>) {
    const messageId = this.messageId(input.messageId);
    const url = this.readUrl(`/me/messages/${messageId}`, {
      $select:
        "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,importance,hasAttachments,conversationId,webLink,categories,bodyPreview,body",
    });
    const root = await this.readOnlyGet(accessToken, url, true);
    return {
      semanticReadContract: "outlook-signed-in-message-plain-text-v1",
      message: this.message(root, true),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async listBoundedInbox(
    accessToken: string,
    input: Record<string, unknown>,
    unreadOnly: boolean,
  ) {
    const maximum = this.maxResults(input.maxResults);
    const url = this.readUrl("/me/mailFolders/inbox/messages", {
      $top: String(maximum),
      $orderby: "receivedDateTime desc",
      $select:
        "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,importance,hasAttachments,conversationId,webLink,categories,bodyPreview",
      ...(unreadOnly ? { $filter: "isRead eq false" } : {}),
    });
    const root = await this.readOnlyGet(accessToken, url, true);
    const messages = this.values(root)
      .slice(0, maximum)
      .map((entry) => this.message(entry, false));
    return {
      semanticReadContract: unreadOnly
        ? "outlook-signed-in-unread-inbox-v1"
        : "outlook-signed-in-recent-inbox-v1",
      messages,
      resultCount: messages.length,
      unreadOnly,
      truncated: Boolean(root["@odata.nextLink"]),
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async readInbox(accessToken: string, input: Record<string, unknown>) {
    return this.searchMessages(accessToken, { ...input, folderId: "inbox" });
  }

  async listMailFolders(accessToken: string, input: Record<string, unknown>) {
    const parentFolderId = this.stringOrNull(input.parentFolderId);
    const path = parentFolderId
      ? `/me/mailFolders/${encodeURIComponent(parentFolderId)}/childFolders`
      : "/me/mailFolders";
    return this.request({
      accessToken,
      method: "GET",
      path,
      query: {
        $top: Math.min(Math.max(Number(input.top ?? 50), 1), 100),
        $select:
          "id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount,isHidden",
        ...(input.includeHidden === true ? { includeHiddenFolders: true } : {}),
      },
    });
  }

  async createMailFolder(accessToken: string, input: Record<string, unknown>) {
    const parentFolderId =
      this.stringOrNull(input.parentFolderId) ?? "msgfolderroot";
    return this.request({
      accessToken,
      method: "POST",
      path: `/me/mailFolders/${encodeURIComponent(parentFolderId)}/childFolders`,
      body: {
        displayName: this.stringOrNull(input.displayName),
        isHidden: input.isHidden === true,
      },
    });
  }

  async searchMessages(accessToken: string, input: Record<string, unknown>) {
    const folderId = this.stringOrNull(input.folderId);
    const path = folderId
      ? `/me/mailFolders/${encodeURIComponent(folderId)}/messages`
      : "/me/messages";
    const query: Record<string, string | number> = {
      $top: Math.min(Math.max(Number(input.top ?? 10), 1), 50),
      $select:
        "id,subject,from,sender,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,conversationId,hasAttachments,internetMessageId,isRead,categories,parentFolderId",
      $orderby: "receivedDateTime desc",
    };
    if (typeof input.search === "string" && input.search.trim()) {
      query.$search = `"${input.search.trim().replaceAll('"', '\\"')}"`;
    }
    if (typeof input.filter === "string" && input.filter.trim()) {
      query.$filter = input.filter.trim();
    } else if (typeof input.since === "string" && input.since.trim()) {
      query.$filter = `receivedDateTime ge ${input.since.trim()}`;
    }
    return this.request({
      accessToken,
      method: "GET",
      path,
      query,
    });
  }

  async fetchMessage(
    accessToken: string,
    messageId: string,
    includeBody: boolean,
  ) {
    const select = [
      "id",
      "subject",
      "from",
      "sender",
      "toRecipients",
      "ccRecipients",
      "bccRecipients",
      "receivedDateTime",
      "sentDateTime",
      "bodyPreview",
      "conversationId",
      "hasAttachments",
      "internetMessageId",
      "isRead",
      "categories",
      "parentFolderId",
      ...(includeBody ? ["body"] : []),
    ].join(",");
    return this.request({
      accessToken,
      method: "GET",
      path: `/me/messages/${encodeURIComponent(messageId)}`,
      query: { $select: select },
    });
  }

  async createDraft(accessToken: string, message: Record<string, unknown>) {
    return this.request({
      accessToken,
      method: "POST",
      path: "/me/messages",
      body: message,
    });
  }

  async sendDraft(accessToken: string, draftId: string) {
    return this.request({
      accessToken,
      method: "POST",
      path: `/me/messages/${encodeURIComponent(draftId)}/send`,
      body: {},
    });
  }

  async sendMail(
    accessToken: string,
    message: Record<string, unknown>,
    saveToSentItems = true,
  ) {
    return this.request({
      accessToken,
      method: "POST",
      path: "/me/sendMail",
      body: { message, saveToSentItems },
    });
  }

  async sendMailAs(
    accessToken: string,
    senderAddress: string,
    message: Record<string, unknown>,
    saveToSentItems = true,
  ) {
    return this.request({
      accessToken,
      method: "POST",
      path: `/users/${encodeURIComponent(senderAddress)}/sendMail`,
      body: { message, saveToSentItems },
    });
  }

  async reply(
    accessToken: string,
    messageId: string,
    body: Record<string, unknown>,
  ) {
    return this.request({
      accessToken,
      method: "POST",
      path: `/me/messages/${encodeURIComponent(messageId)}/reply`,
      body,
    });
  }

  async forward(
    accessToken: string,
    messageId: string,
    body: Record<string, unknown>,
  ) {
    return this.request({
      accessToken,
      method: "POST",
      path: `/me/messages/${encodeURIComponent(messageId)}/forward`,
      body,
    });
  }

  async moveMessage(
    accessToken: string,
    messageId: string,
    destinationFolderId: string,
  ) {
    return this.request({
      accessToken,
      method: "POST",
      path: `/me/messages/${encodeURIComponent(messageId)}/move`,
      body: { destinationId: destinationFolderId },
    });
  }

  async archiveMessage(accessToken: string, messageId: string) {
    return this.moveMessage(accessToken, messageId, "archive");
  }

  async deleteMessage(accessToken: string, messageId: string) {
    return this.request({
      accessToken,
      method: "DELETE",
      path: `/me/messages/${encodeURIComponent(messageId)}`,
    });
  }

  async updateMessage(
    accessToken: string,
    messageId: string,
    body: Record<string, unknown>,
  ) {
    return this.request({
      accessToken,
      method: "PATCH",
      path: `/me/messages/${encodeURIComponent(messageId)}`,
      body,
    });
  }

  async markMessageRead(
    accessToken: string,
    messageId: string,
    isRead: boolean,
  ) {
    return this.updateMessage(accessToken, messageId, { isRead });
  }

  async listCategories(accessToken: string) {
    return this.request({
      accessToken,
      method: "GET",
      path: "/me/outlook/masterCategories",
      query: { $select: "id,displayName,color" },
    });
  }

  async createCategory(accessToken: string, input: Record<string, unknown>) {
    return this.request({
      accessToken,
      method: "POST",
      path: "/me/outlook/masterCategories",
      body: {
        displayName: this.stringOrNull(input.displayName),
        ...(this.stringOrNull(input.color)
          ? { color: this.stringOrNull(input.color) }
          : {}),
      },
    });
  }

  async updateCategory(
    accessToken: string,
    categoryId: string,
    input: Record<string, unknown>,
  ) {
    return this.request({
      accessToken,
      method: "PATCH",
      path: `/me/outlook/masterCategories/${encodeURIComponent(categoryId)}`,
      body: {
        ...(this.stringOrNull(input.color)
          ? { color: this.stringOrNull(input.color) }
          : {}),
      },
    });
  }

  async deleteCategory(accessToken: string, categoryId: string) {
    return this.request({
      accessToken,
      method: "DELETE",
      path: `/me/outlook/masterCategories/${encodeURIComponent(categoryId)}`,
    });
  }

  async listInboxRules(accessToken: string) {
    return this.request({
      accessToken,
      method: "GET",
      path: "/me/mailFolders/inbox/messageRules",
    });
  }

  async createInboxRule(accessToken: string, rule: Record<string, unknown>) {
    return this.request({
      accessToken,
      method: "POST",
      path: "/me/mailFolders/inbox/messageRules",
      body: rule,
    });
  }

  async updateInboxRule(
    accessToken: string,
    ruleId: string,
    rule: Record<string, unknown>,
  ) {
    return this.request({
      accessToken,
      method: "PATCH",
      path: `/me/mailFolders/inbox/messageRules/${encodeURIComponent(ruleId)}`,
      body: rule,
    });
  }

  async batch(accessToken: string, requests: Array<Record<string, unknown>>) {
    return this.request({
      accessToken,
      method: "POST",
      path: "/$batch",
      body: { requests },
    });
  }

  private readUrl(path: string, query: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    return url;
  }

  private async readOnlyGet(
    accessToken: string,
    url: URL,
    preferText: boolean,
  ): Promise<Record<string, unknown>> {
    if (!accessToken || accessToken.length > 30_000)
      throw new OutlookGraphError(
        "credential_missing",
        "Outlook access token is missing.",
      );
    if (!this.safeReadUrl(url))
      throw new OutlookGraphError(
        "provider_validation_error",
        "Outlook URL is outside Relay's signed-in-mailbox read allowlist.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(preferText ? { Prefer: 'outlook.body-content-type="text"' } : {}),
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new OutlookGraphError(
        "provider_unavailable",
        "Microsoft Graph could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new OutlookGraphError(
        "provider_validation_error",
        "Outlook response exceeded Relay's 1 MB bound.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new OutlookGraphError(
        "provider_validation_error",
        "Microsoft Graph returned invalid JSON.",
      );
    }
    if (!response.ok)
      throw new OutlookGraphError(
        this.errorCodeForStatus(response.status),
        "Microsoft Graph rejected the bounded Outlook read.",
        response.status,
      );
    return this.object(body);
  }

  private safeReadUrl(url: URL) {
    if (
      url.protocol !== "https:" ||
      url.hostname !== "graph.microsoft.com" ||
      url.hash ||
      url.username ||
      url.password
    )
      return false;
    if (url.pathname === "/oidc/userinfo") return !url.search;
    const keys = [...url.searchParams.keys()].sort().join(",");
    if (url.pathname === "/v1.0/me/mailFolders")
      return (
        keys === "$select,$top" && this.validTop(url.searchParams.get("$top"))
      );
    if (url.pathname === "/v1.0/me/mailFolders/inbox/messages") {
      const unread = url.searchParams.has("$filter");
      return (
        keys ===
          (unread
            ? "$filter,$orderby,$select,$top"
            : "$orderby,$select,$top") &&
        this.validTop(url.searchParams.get("$top")) &&
        url.searchParams.get("$orderby") === "receivedDateTime desc" &&
        (!unread || url.searchParams.get("$filter") === "isRead eq false")
      );
    }
    return (
      /^\/v1\.0\/me\/messages\/[A-Za-z0-9_=.~-]{1,1024}$/.test(url.pathname) &&
      keys === "$select"
    );
  }

  private folder(value: unknown) {
    const folder = this.object(value);
    return {
      id: this.scalar(folder.id, 1_024),
      displayName: this.scalar(folder.displayName, 512),
      parentFolderId: this.scalar(folder.parentFolderId, 1_024),
      childFolderCount: this.number(folder.childFolderCount),
      unreadItemCount: this.number(folder.unreadItemCount),
      totalItemCount: this.number(folder.totalItemCount),
      hiddenFoldersExcluded: true,
    };
  }

  private message(value: unknown, includeBody: boolean) {
    const message = this.object(value);
    const body = this.object(message.body);
    return {
      id: this.scalar(message.id, 1_024),
      subject: this.scalar(message.subject, 512),
      from: this.address(message.from),
      toRecipients: this.addresses(message.toRecipients),
      ccRecipients: this.addresses(message.ccRecipients),
      receivedDateTime: this.scalar(message.receivedDateTime, 64),
      sentDateTime: this.scalar(message.sentDateTime, 64),
      isRead: typeof message.isRead === "boolean" ? message.isRead : null,
      importance: this.scalar(message.importance, 32),
      hasAttachments:
        typeof message.hasAttachments === "boolean"
          ? message.hasAttachments
          : null,
      conversationId: this.scalar(message.conversationId, 1_024),
      webLink: this.safeOutlookLink(message.webLink),
      categories: this.array(message.categories)
        .slice(0, 25)
        .map((entry) => this.scalar(entry, 128)),
      bodyPreview: this.scalar(message.bodyPreview, 1_000),
      ...(includeBody
        ? {
            body: this.scalar(body.content, 8_000),
            bodyContentType: "text",
          }
        : {}),
      attachmentsReturned: false,
      htmlReturned: false,
      rawHeadersReturned: false,
    };
  }

  private address(value: unknown) {
    const email = this.object(this.object(value).emailAddress);
    return {
      name: this.scalar(email.name, 512),
      address: this.scalar(email.address, 320),
    };
  }

  private addresses(value: unknown) {
    return this.array(value)
      .slice(0, 25)
      .map((entry) => this.address(entry));
  }

  private boundary() {
    return {
      delegatedOnly: true,
      selfMailboxOnly: true,
      maxResults: 25,
      maxBodyCharacters: 8_000,
      sharedMailEnabled: false,
      applicationPermissionsEnabled: false,
      attachmentsEnabled: false,
      searchEnabled: false,
      writesEnabled: false,
      calendarContactsFilesDirectoryEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
      rawProviderToolExposure: false,
      redactionStatus:
        "shared-application-attachments-mime-search-export-writes-other-graph-pagination-raw-excluded",
    };
  }

  private maxResults(value: unknown) {
    if (value === undefined || value === null) return 25;
    if (
      !Number.isInteger(value) ||
      (value as number) < 1 ||
      (value as number) > 25
    )
      throw new OutlookGraphError(
        "provider_validation_error",
        "maxResults must be an integer from 1 through 25.",
      );
    return value as number;
  }

  private validTop(value: string | null) {
    return Boolean(value && /^(?:[1-9]|1[0-9]|2[0-5])$/.test(value));
  }

  private messageId(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_=.~-]{1,1024}$/.test(value))
      throw new OutlookGraphError(
        "provider_validation_error",
        "messageId must be an explicit safe Graph message ID.",
      );
    return value;
  }

  private safeOutlookLink(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" &&
        ["outlook.office.com", "outlook.live.com"].includes(url.hostname)
        ? url.toString().slice(0, 2_048)
        : null;
    } catch {
      return null;
    }
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private values(value: Record<string, unknown>) {
    return this.array(value.value);
  }

  private scalar(value: unknown, maximum: number) {
    return typeof value === "string" && value ? value.slice(0, maximum) : null;
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  async request(input: OutlookGraphRequest) {
    const url = new URL(`${this.baseUrl}${input.path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value !== null && value !== undefined)
        url.searchParams.set(key, String(value));
    }
    const response = await safeConnectorFetch(url, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body:
        input.method === "GET" || input.body === undefined
          ? undefined
          : JSON.stringify(input.body),
    });
    const body = await this.safeBody(response);
    if (!response.ok) {
      throw new OutlookGraphError(
        this.errorCodeForStatus(response.status),
        this.safeGraphMessage(body) ??
          `Microsoft Graph returned ${response.status}`,
        response.status,
        body,
      );
    }
    return body;
  }

  private async safeBody(response: Response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }

  private safeGraphMessage(body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const error = (body as Record<string, unknown>).error;
    if (!error || typeof error !== "object" || Array.isArray(error))
      return null;
    return typeof (error as Record<string, unknown>).message === "string"
      ? ((error as Record<string, unknown>).message as string)
      : null;
  }

  private errorCodeForStatus(
    status: number,
  ): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    if (status >= 400) return "provider_validation_error";
    return "graph_error";
  }

  private stringOrNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}
