import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

const ZOHO_MAIL_ORIGINS = new Set([
  "https://mail.zoho.com",
  "https://mail.zoho.eu",
  "https://mail.zoho.in",
  "https://mail.zoho.com.au",
  "https://mail.zoho.jp",
  "https://mail.zohocloud.ca",
  "https://mail.zoho.com.cn",
  "https://mail.zoho.ae",
  "https://mail.zoho.sa",
]);

export class ZohoMailApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ZohoMailApiAdapter {
  async listAccounts(accessToken: string, mailOriginInput: unknown) {
    const body = await this.request(accessToken, mailOriginInput, "/api/accounts");
    return this.array(this.object(body).data)
      .slice(0, 25)
      .map((value) => this.shapeAccount(value));
  }

  async listFolders(
    accessToken: string,
    mailOriginInput: unknown,
    accountIdInput: unknown,
  ) {
    const accountId = this.numericId(accountIdInput, "accountId");
    const body = await this.request(
      accessToken,
      mailOriginInput,
      `/api/accounts/${encodeURIComponent(accountId)}/folders`,
    );
    return this.array(this.object(body).data)
      .slice(0, 25)
      .map((value) => this.shapeFolder(value));
  }

  async listMessages(
    accessToken: string,
    mailOriginInput: unknown,
    accountIdInput: unknown,
    folderIdInput: unknown,
    limitInput: unknown = 25,
  ) {
    const accountId = this.numericId(accountIdInput, "accountId");
    const folderId = this.numericId(folderIdInput, "folderId");
    const limit = this.limit(limitInput, 25);
    const body = await this.request(
      accessToken,
      mailOriginInput,
      `/api/accounts/${encodeURIComponent(accountId)}/messages/view`,
      { folderId, limit: String(limit), includeto: "true" },
    );
    return this.array(this.object(body).data)
      .slice(0, limit)
      .map((value) => this.shapeMessageSummary(value));
  }

  async getMessage(
    accessToken: string,
    mailOriginInput: unknown,
    accountIdInput: unknown,
    folderIdInput: unknown,
    messageIdInput: unknown,
  ) {
    const accountId = this.numericId(accountIdInput, "accountId");
    const folderId = this.numericId(folderIdInput, "folderId");
    const messageId = this.numericId(messageIdInput, "messageId");
    const prefix = `/api/accounts/${encodeURIComponent(accountId)}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}`;
    const [detailsBody, contentBody, attachmentsBody] = await Promise.all([
      this.request(accessToken, mailOriginInput, `${prefix}/details`),
      this.request(accessToken, mailOriginInput, `${prefix}/content`),
      this.request(accessToken, mailOriginInput, `${prefix}/attachmentinfo`, {
        includeInline: "false",
      }),
    ]);
    const details = this.object(this.object(detailsBody).data);
    const content = this.object(this.object(contentBody).data);
    const attachmentData = this.object(this.object(attachmentsBody).data);
    const shaped = this.shapeMessageSummary({ ...details, folderId, messageId });
    const attachments = this.array(attachmentData.attachments)
      .slice(0, 25)
      .map((value) => this.shapeAttachment(value));
    return {
      ...shaped,
      contentText: this.sanitizedText(content.content, 8_000),
      attachments,
      attachmentCount: attachments.length,
      inlineContentIncluded: false,
      providerRequestCount: 3,
    };
  }

  private async request(
    accessToken: string,
    mailOriginInput: unknown,
    path: string,
    query: Record<string, string> = {},
  ) {
    const origin = this.mailOrigin(mailOriginInput);
    const url = new URL(path, `${origin}/`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new ZohoMailApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Zoho Mail request timed out"
          : "Zoho Mail request failed",
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok) {
      throw new ZohoMailApiError(
        this.errorCode(response.status),
        `Zoho Mail request failed with ${response.status}`,
        response.status,
      );
    }
    const providerStatus = this.integer(this.object(this.object(body).status).code);
    if (providerStatus !== null && providerStatus !== 200) {
      throw new ZohoMailApiError(
        this.errorCode(providerStatus),
        `Zoho Mail request failed with ${providerStatus}`,
        providerStatus,
      );
    }
    return body;
  }

  private shapeAccount(value: unknown) {
    const account = this.object(value);
    const accountId = this.identifier(account.accountId);
    const email =
      this.string(account.primaryEmailAddress) ??
      this.string(account.emailAddress) ??
      this.string(account.mailboxAddress);
    if (!accountId || !email) {
      throw new ZohoMailApiError(
        "provider_validation_error",
        "Zoho Mail account is incomplete",
      );
    }
    return {
      accountId,
      email,
      displayName:
        this.string(account.displayName) ??
        this.string(account.accountName) ??
        email,
      accountName: this.string(account.accountName),
      accountType: this.string(account.accountType),
      accountStatus:
        this.string(account.accountStatus) ?? this.string(account.status),
    };
  }

  private shapeFolder(value: unknown) {
    const folder = this.object(value);
    const folderId = this.identifier(folder.folderId);
    const folderName = this.string(folder.folderName) ?? this.string(folder.name);
    if (!folderId || !folderName) {
      throw new ZohoMailApiError(
        "provider_validation_error",
        "Zoho Mail folder is incomplete",
      );
    }
    return {
      folderId,
      folderName,
      path: this.string(folder.path) ?? this.string(folder.folderPath),
      folderType: this.string(folder.folderType) ?? this.string(folder.type),
      imapAccess: this.boolean(folder.imapAccess),
      archiveType: this.string(folder.archiveType),
      messageCount: this.integer(folder.messageCount),
      unreadCount: this.integer(folder.unreadCount),
    };
  }

  private shapeMessageSummary(value: unknown) {
    const message = this.object(value);
    const messageId = this.identifier(message.messageId);
    const folderId = this.identifier(message.folderId);
    if (!messageId || !folderId) {
      throw new ZohoMailApiError(
        "provider_validation_error",
        "Zoho Mail message is incomplete",
      );
    }
    return {
      messageId,
      folderId,
      threadId: this.identifier(message.threadId),
      subject: this.sanitizedText(message.subject, 500),
      summary: this.sanitizedText(message.summary, 1_000),
      sender: this.sanitizedText(message.sender, 320),
      fromAddress: this.sanitizedText(message.fromAddress, 500),
      toAddress: this.sanitizedText(message.toAddress, 1_000),
      ccAddress: this.sanitizedText(message.ccAddress, 1_000),
      sentDateInGMT: this.stringOrNumber(message.sentDateInGMT),
      receivedTime: this.stringOrNumber(message.receivedTime),
      status: this.stringOrNumber(message.status),
      status2: this.stringOrNumber(message.status2),
      flagId: this.stringOrNumber(message.flagid),
      priority: this.stringOrNumber(message.priority),
      hasAttachment: this.boolean(message.hasAttachment),
      hasInline: this.boolean(message.hasInline),
      size: this.integer(message.size),
    };
  }

  private shapeAttachment(value: unknown) {
    const attachment = this.object(value);
    const attachmentId = this.identifier(attachment.attachmentId);
    const attachmentName = this.sanitizedText(attachment.attachmentName, 255);
    if (!attachmentId || !attachmentName) {
      throw new ZohoMailApiError(
        "provider_validation_error",
        "Zoho Mail attachment metadata is incomplete",
      );
    }
    return {
      attachmentId,
      attachmentName,
      attachmentSize: this.integer(attachment.attachmentSize),
    };
  }

  private mailOrigin(value: unknown) {
    const text = this.string(value);
    if (!text) {
      throw new ZohoMailApiError(
        "provider_validation_error",
        "Zoho Mail regional origin is missing",
      );
    }
    try {
      const url = new URL(text);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        !ZOHO_MAIL_ORIGINS.has(url.origin)
      ) {
        throw new Error("invalid");
      }
      return url.origin;
    } catch {
      throw new ZohoMailApiError(
        "provider_validation_error",
        "Zoho Mail regional origin is not allowlisted",
      );
    }
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  private stringOrNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return this.string(value);
  }
  private identifier(value: unknown) {
    const text = this.stringOrNumber(value);
    return text && /^[0-9]+$/.test(text) && text.length <= 64 ? text : null;
  }
  private numericId(value: unknown, field: string) {
    const id = this.identifier(value);
    if (!id) {
      throw new ZohoMailApiError(
        "provider_validation_error",
        `${field} must be a numeric Zoho Mail ID`,
      );
    }
    return id;
  }
  private integer(value: unknown) {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }
  private boolean(value: unknown) {
    if (value === true || value === 1 || value === "1" || value === "true") return true;
    if (value === false || value === 0 || value === "0" || value === "false") return false;
    return null;
  }
  private limit(value: unknown, maximum: number) {
    const number = typeof value === "number" ? value : Number(value ?? maximum);
    if (!Number.isFinite(number)) return maximum;
    return Math.max(1, Math.min(maximum, Math.trunc(number)));
  }
  private sanitizedText(value: unknown, maximum: number) {
    const text = this.string(value);
    if (!text) return null;
    return text
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      .replace(/&#(\d+);/g, (_, digits: string) => {
        const codePoint = Number(digits);
        return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : "";
      })
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximum);
  }
  private async safeBody(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return {};
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
