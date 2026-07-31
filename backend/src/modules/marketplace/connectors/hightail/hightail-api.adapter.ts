import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HightailFile = { filename: string; content: Buffer };

export type HightailCredentials = {
  apiToken: string;
  senderEmail: string;
};

export class HightailApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class HightailApiAdapter {
  private static readonly API_ORIGIN = "https://api.spaces.hightail.com";
  private static readonly MAX_FILE_BYTES = 5_000_000;
  private static readonly MAX_TOTAL_BYTES = 25_000_000;
  private static readonly CHUNK_BYTES = 5_242_880;

  health(credentials: HightailCredentials) {
    this.requireCredentials(credentials);
    return { credentialPresent: true, senderEmail: credentials.senderEmail };
  }

  async sendFiles(credentials: HightailCredentials, input: JsonObject) {
    this.requireCredentials(credentials);
    const files = this.files(input.files);
    const recipients = this.recipients(input.recipients);
    const create = await this.providerRequest(
      credentials,
      "/devapi/v1/send/create",
      {
        email: credentials.senderEmail,
        chunkSize: HightailApiAdapter.CHUNK_BYTES,
        fullUrl: true,
        files: files.map((file) => ({
          filename: file.filename,
          fileSize: file.content.length,
        })),
      },
      201,
    );
    const spaceId = this.requiredString(create.spaceId, "spaceId");
    const uploadGroups = this.uploadGroups(create.fullUrls, files);
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      const group = uploadGroups[fileIndex];
      for (let partIndex = 0; partIndex < group.urls.length; partIndex += 1) {
        const start = partIndex * group.chunkSize;
        const chunk = file.content.subarray(start, start + group.chunkSize);
        await this.upload(group.urls[partIndex], chunk);
      }
    }
    const submit = await this.providerRequest(
      credentials,
      "/devapi/v1/send/submit",
      {
        spaceId,
        emails: recipients,
        subject: this.optionalString(input.subject, 500),
        message: this.optionalString(input.message, 5_000),
        sendEmail: this.boolean(input.sendEmail, true),
        sendReceiptRequested: this.boolean(input.sendReceiptRequested, false),
        downloadReceiptRequested: this.boolean(
          input.downloadReceiptRequested,
          false,
        ),
        verifyRecipient: this.boolean(input.verifyRecipient, false),
        allowComment: this.boolean(input.allowComment, false),
        preventDownload: this.boolean(input.preventDownload, false),
        expiresAt: this.optionalPositiveInteger(input.expiresAt),
        accessCode: this.optionalString(input.accessCode, 100),
      },
      200,
    );
    return {
      spaceId,
      fileCount: files.length,
      recipientCount: recipients.length,
      bytesUploaded: files.reduce(
        (total, file) => total + file.content.length,
        0,
      ),
      submitted: true,
      provider: this.redact(submit),
    };
  }

  private async providerRequest(
    credentials: HightailCredentials,
    path: "/devapi/v1/send/create" | "/devapi/v1/send/submit",
    json: JsonObject,
    expectedStatus: number,
  ): Promise<JsonObject> {
    let response: Response;
    try {
      response = await safeConnectorFetch(`${HightailApiAdapter.API_ORIGIN}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json;charset=UTF-8",
          Authorization: credentials.apiToken,
        },
        body: JSON.stringify(json),
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (error instanceof HightailApiError) throw error;
      throw new HightailApiError(
        "provider_unavailable",
        "Hightail could not be reached.",
        502,
      );
    }
    const parsed = await this.responseJson(response);
    if (!response.ok || response.status !== expectedStatus) {
      throw new HightailApiError(
        this.errorCode(response.status),
        this.safeProviderMessage(parsed, response.status),
        response.status,
      );
    }
    return parsed;
  }

  private async upload(value: string, content: Buffer) {
    const url = this.signedUploadUrl(value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "PUT",
        body: new Uint8Array(content),
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new HightailApiError(
        "provider_unavailable",
        "Hightail file upload could not be completed.",
        502,
      );
    }
    if (!response.ok) {
      throw new HightailApiError(
        this.errorCode(response.status),
        `Hightail file upload returned HTTP ${response.status}.`,
        response.status,
      );
    }
  }

  signedUploadUrl(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail returned an invalid upload URL.",
      );
    }
    const hostname = url.hostname.toLowerCase();
    const isS3 =
      hostname === "s3.amazonaws.com" ||
      /\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(hostname);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      !isS3 ||
      !url.searchParams.has("X-Amz-Signature")
    ) {
      throw new HightailApiError(
        "policy_blocked",
        "Hightail upload URLs must be provider-signed HTTPS Amazon S3 URLs.",
        403,
      );
    }
    return url;
  }

  private uploadGroups(value: unknown, files: HightailFile[]) {
    if (!Array.isArray(value) || value.length !== files.length) {
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail did not return one upload plan for each file.",
      );
    }
    return value.map((entry, index) => {
      const object = this.object(entry);
      const chunkSize = this.positiveInteger(object?.chunkSize);
      const urls = Array.isArray(object?.urls)
        ? object.urls.map((url) => this.requiredString(url, "upload URL"))
        : [];
      if (
        !chunkSize ||
        chunkSize >
          HightailApiAdapter.MAX_FILE_BYTES + HightailApiAdapter.CHUNK_BYTES ||
        urls.length < 1 ||
        urls.length > 2 ||
        urls.length !== Math.ceil(files[index].content.length / chunkSize)
      ) {
        throw new HightailApiError(
          "provider_validation_error",
          "Hightail returned an invalid or unbounded upload plan.",
        );
      }
      urls.forEach((url) => this.signedUploadUrl(url));
      return { chunkSize, urls };
    });
  }

  private files(value: unknown): HightailFile[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 5) {
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail requires one to five files per agent send.",
      );
    }
    const names = new Set<string>();
    const files = value.map((entry) => {
      const object = this.object(entry);
      const filename = this.requiredString(object?.filename, "filename");
      if (
        filename.length > 255 ||
        filename === "." ||
        filename === ".." ||
        filename.includes("/") ||
        filename.includes("\\") ||
        /[\u0000-\u001f\u007f]/.test(filename) ||
        names.has(filename.toLowerCase())
      ) {
        throw new HightailApiError(
          "provider_validation_error",
          "Hightail filenames must be unique plain filenames without path separators.",
        );
      }
      names.add(filename.toLowerCase());
      const content = this.base64(object?.contentBase64);
      if (
        content.length < 1 ||
        content.length > HightailApiAdapter.MAX_FILE_BYTES
      ) {
        throw new HightailApiError(
          "provider_validation_error",
          "Each Hightail agent file must be between one byte and five megabytes.",
        );
      }
      return { filename, content };
    });
    if (
      files.reduce((total, file) => total + file.content.length, 0) >
      HightailApiAdapter.MAX_TOTAL_BYTES
    ) {
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail agent sends are limited to 25 megabytes in total.",
      );
    }
    return files;
  }

  private recipients(value: unknown) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail requires one to 100 recipients per send.",
      );
    }
    const recipients = value.map((entry) =>
      this.requiredString(entry, "recipient").toLowerCase(),
    );
    if (
      new Set(recipients).size !== recipients.length ||
      recipients.some(
        (email) =>
          email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      )
    ) {
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail recipients must be unique valid email addresses.",
      );
    }
    return recipients;
  }

  private requireCredentials(credentials: HightailCredentials) {
    if (!credentials.apiToken.trim()) {
      throw new HightailApiError(
        "credential_missing",
        "Hightail API token is missing.",
      );
    }
    if (
      credentials.apiToken.length > 1_024 ||
      /[\r\n]/.test(credentials.apiToken)
    ) {
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail API token is invalid.",
      );
    }
    if (
      credentials.senderEmail.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.senderEmail)
    ) {
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail sender email is invalid.",
      );
    }
  }

  private async responseJson(response: Response): Promise<JsonObject> {
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000) {
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail returned an oversized response.",
      );
    }
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      return this.object(parsed) ?? {};
    } catch {
      return {};
    }
  }

  private safeProviderMessage(value: JsonObject, status: number) {
    const message =
      this.string(value.message) ??
      this.string(value.error) ??
      `Hightail returned HTTP ${status}.`;
    return message.slice(0, 500).replace(/[\r\n]+/g, " ");
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 100).map((entry) => this.redact(entry));
    const object = this.object(value);
    if (!object) return value;
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(object).slice(0, 100)) {
      result[key] = /(token|secret|authorization|credential|signed|url)/i.test(
        key,
      )
        ? "[REDACTED]"
        : this.redact(entry);
    }
    return result;
  }

  private optionalString(value: unknown, maxLength: number) {
    if (value === undefined || value === null || value === "") return undefined;
    const result = this.requiredString(value, "value");
    if (result.length > maxLength)
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail text field is too long.",
      );
    return result;
  }

  private optionalPositiveInteger(value: unknown) {
    if (value === undefined || value === null) return undefined;
    const result = this.positiveInteger(value);
    if (!result)
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail expiration must be a positive millisecond timestamp.",
      );
    return result;
  }

  private boolean(value: unknown, fallback: boolean) {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== "boolean")
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail delivery flags must be boolean values.",
      );
    return value;
  }

  private base64(value: unknown) {
    const encoded = this.requiredString(value, "file content");
    const paddingLength = encoded.endsWith("==")
      ? 2
      : encoded.endsWith("=")
        ? 1
        : 0;
    const decodedLength = (encoded.length / 4) * 3 - paddingLength;
    const unpadded = encoded.slice(0, encoded.length - paddingLength);
    if (
      encoded.length % 4 !== 0 ||
      decodedLength > HightailApiAdapter.MAX_FILE_BYTES ||
      !/^[A-Za-z0-9+/]+$/.test(unpadded)
    ) {
      throw new HightailApiError(
        "provider_validation_error",
        "Hightail file content must be valid base64.",
      );
    }
    return Buffer.from(encoded, "base64");
  }

  private requiredString(value: unknown, label: string) {
    const result = this.string(value);
    if (!result)
      throw new HightailApiError(
        "provider_validation_error",
        `Hightail ${label} is required.`,
      );
    return result;
  }

  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private positiveInteger(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0
      ? value
      : null;
  }

  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }
}
