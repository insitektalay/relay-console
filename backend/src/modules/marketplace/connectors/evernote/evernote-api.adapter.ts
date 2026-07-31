import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

// The official Evernote Node SDK ships CommonJS JavaScript without TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Evernote = require("evernote") as any;

type JsonObject = Record<string, unknown>;
export type EvernoteCredentials = { accessToken: string };

export class EvernoteApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

const FULL_ACCESS_OPERATIONS = new Set([
  "authenticateToSharedNote",
  "authenticateToSharedNotebook",
  "copyNote",
  "createLinkedNotebook",
  "createNotebook",
  "createOrUpdateNotebookShares",
  "createSearch",
  "createTag",
  "deleteNote",
  "emailNote",
  "expungeLinkedNotebook",
  "expungeNote",
  "expungeNotebook",
  "expungeSearch",
  "expungeTag",
  "findNoteCounts",
  "findNoteOffset",
  "findNotesMetadata",
  "findRelated",
  "getDefaultNotebook",
  "getFilteredSyncChunk",
  "getLinkedNotebookSyncChunk",
  "getLinkedNotebookSyncState",
  "getNote",
  "getNoteApplicationData",
  "getNoteApplicationDataEntry",
  "getNoteContent",
  "getNoteSearchText",
  "getNoteTagNames",
  "getNotebook",
  "getPublicNotebook",
  "getResource",
  "getResourceAlternateData",
  "getResourceApplicationData",
  "getResourceApplicationDataEntry",
  "getResourceAttributes",
  "getResourceByHash",
  "getResourceData",
  "getResourceRecognition",
  "getResourceSearchText",
  "getSearch",
  "getSharedNotebookByAuth",
  "getSyncChunk",
  "getSyncState",
  "getTag",
  "listLinkedNotebooks",
  "listNoteVersions",
  "listNotebooks",
  "listSearches",
  "listSharedNotebooks",
  "listTags",
  "listTagsByNotebook",
  "manageNotebookShares",
  "manageNoteShares",
  "markLastRead",
  "stopSharingNote",
  "updateLinkedNotebook",
  "updateNote",
  "updateNoteApplicationData",
  "updateNotebook",
  "updateResourceApplicationData",
  "updateSearch",
  "updateTag",
]);

@Injectable()
export class EvernoteApiAdapter {
  async health(credentials: EvernoteCredentials) {
    return this.getProfile(credentials);
  }

  async getProfile(credentials: EvernoteCredentials) {
    return this.call(async () =>
      this.client(credentials).getUserStore().getUser(),
    );
  }

  async listNotebooks(credentials: EvernoteCredentials) {
    return this.call(async () =>
      this.client(credentials).getNoteStore().listNotebooks(),
    );
  }

  async listTags(credentials: EvernoteCredentials) {
    return this.call(async () =>
      this.client(credentials).getNoteStore().listTags(),
    );
  }

  async searchNotes(credentials: EvernoteCredentials, input: JsonObject) {
    const limit = this.clamp(input.limit, 50, 1, 100);
    const offset = this.clamp(input.offset, 0, 0, 100000);
    const filter = new Evernote.NoteStore.NoteFilter({
      words: this.optionalString(input.words),
      notebookGuid: this.optionalGuid(input.notebookGuid),
      ascending: false,
    });
    const spec = new Evernote.NoteStore.NotesMetadataResultSpec({
      includeTitle: true,
      includeContentLength: true,
      includeCreated: true,
      includeUpdated: true,
      includeDeleted: true,
      includeUpdateSequenceNum: true,
      includeNotebookGuid: true,
      includeTagGuids: true,
      includeAttributes: true,
      includeLargestResourceMime: true,
      includeLargestResourceSize: true,
    });
    return this.call(async () =>
      this.client(credentials)
        .getNoteStore()
        .findNotesMetadata(filter, offset, limit, spec),
    );
  }

  async getNote(credentials: EvernoteCredentials, input: JsonObject) {
    const guid = this.requiredGuid(input.guid, "guid");
    return this.call(async () =>
      this.client(credentials)
        .getNoteStore()
        .getNote(
          guid,
          input.withContent !== false,
          input.withResourcesData === true,
          false,
          false,
        ),
    );
  }

  async createNote(credentials: EvernoteCredentials, input: JsonObject) {
    const note = this.note(input, false);
    return this.call(async () =>
      this.client(credentials).getNoteStore().createNote(note),
    );
  }

  async updateNote(credentials: EvernoteCredentials, input: JsonObject) {
    const note = this.note(input, true);
    return this.call(async () =>
      this.client(credentials).getNoteStore().updateNote(note),
    );
  }

  async deleteNote(credentials: EvernoteCredentials, input: JsonObject) {
    const guid = this.requiredGuid(input.guid, "guid");
    return this.call(async () => ({
      updateSequenceNum: await this.client(credentials)
        .getNoteStore()
        .deleteNote(guid),
    }));
  }

  async invoke(credentials: EvernoteCredentials, input: JsonObject) {
    const operation = this.requiredString(input.operation, "operation");
    if (!FULL_ACCESS_OPERATIONS.has(operation)) {
      throw new EvernoteApiError(
        "policy_blocked",
        "That Evernote NoteStore operation is not in the documented Full Access allowlist.",
      );
    }
    const args = Array.isArray(input.args) ? input.args.slice(0, 12) : [];
    this.rejectCredentialFields(args);
    const noteStore = this.client(credentials).getNoteStore() as Record<
      string,
      (...values: unknown[]) => Promise<unknown>
    >;
    if (typeof noteStore[operation] !== "function") {
      throw new EvernoteApiError(
        "tool_unavailable",
        `Evernote operation ${operation} is unavailable in the deployed SDK.`,
      );
    }
    return this.call(async () => noteStore[operation](...args));
  }

  private client(credentials: EvernoteCredentials) {
    if (!credentials.accessToken)
      throw new EvernoteApiError(
        "credential_missing",
        "Evernote OAuth token is missing.",
      );
    return new Evernote.Client({
      token: credentials.accessToken,
      sandbox: false,
      china: false,
    });
  }

  private note(input: JsonObject, requireGuid: boolean) {
    const guid = requireGuid
      ? this.requiredGuid(input.guid, "guid")
      : this.optionalGuid(input.guid);
    const title = this.optionalString(input.title);
    const content = this.optionalString(input.content);
    if (!requireGuid && (!title || !content))
      throw new EvernoteApiError(
        "provider_validation_error",
        "title and content are required.",
      );
    if (title && title.length > 255)
      throw new EvernoteApiError(
        "provider_validation_error",
        "Evernote note title exceeds 255 characters.",
      );
    if (content && Buffer.byteLength(content) > 5_000_000)
      throw new EvernoteApiError(
        "provider_validation_error",
        "Evernote note content exceeds 5 MB.",
      );
    if (
      content &&
      (!content.includes("<en-note") ||
        /<!ENTITY|<!DOCTYPE(?!\s+en-note)/i.test(content))
    ) {
      throw new EvernoteApiError(
        "provider_validation_error",
        "Evernote content must be ENML with an en-note root and no custom entities.",
      );
    }
    const tagNames = Array.isArray(input.tagNames)
      ? input.tagNames
          .filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          )
          .slice(0, 100)
      : undefined;
    return new Evernote.Types.Note({
      ...(guid ? { guid } : {}),
      ...(title ? { title } : {}),
      ...(content ? { content } : {}),
      ...(this.optionalGuid(input.notebookGuid)
        ? { notebookGuid: this.optionalGuid(input.notebookGuid) }
        : {}),
      ...(tagNames ? { tagNames } : {}),
    });
  }

  private async call(work: () => Promise<unknown>) {
    try {
      return this.bound(await work());
    } catch (error) {
      if (error instanceof EvernoteApiError) throw error;
      const value = error as JsonObject;
      const code = Number(value?.errorCode ?? value?.statusCode ?? 0);
      const message =
        typeof value?.message === "string"
          ? value.message.slice(0, 300)
          : "Evernote API request failed.";
      if (code === 19 || /rate.?limit/i.test(message))
        throw new EvernoteApiError("provider_rate_limited", message, 429);
      if (code === 9 || /auth.*expired|invalid.*auth/i.test(message))
        throw new EvernoteApiError(
          "token_expired",
          "Evernote authorization expired or was revoked.",
          401,
        );
      if (code === 3 || /permission/i.test(message))
        throw new EvernoteApiError("insufficient_scope", message, 403);
      throw new EvernoteApiError("provider_unavailable", message);
    }
  }

  private bound(value: unknown): unknown {
    const seen = new WeakSet<object>();
    const visit = (entry: unknown, depth: number): unknown => {
      if (depth > 8) return "[TRUNCATED]";
      if (typeof entry === "string")
        return entry.length > 500_000
          ? `${entry.slice(0, 500_000)}[TRUNCATED]`
          : entry;
      if (typeof entry !== "object" || entry === null) return entry;
      if (seen.has(entry)) return "[CIRCULAR]";
      seen.add(entry);
      if (Array.isArray(entry))
        return entry.slice(0, 500).map((item) => visit(item, depth + 1));
      const output: JsonObject = {};
      for (const [key, child] of Object.entries(entry as JsonObject).slice(
        0,
        500,
      )) {
        output[key] = /(auth|credential|consumer.?secret|token)/i.test(key)
          ? "[REDACTED]"
          : visit(child, depth + 1);
      }
      return output;
    };
    return visit(value, 0);
  }

  private rejectCredentialFields(value: unknown) {
    const visit = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(visit);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (/(auth|credential|consumer.?secret|token)/i.test(key))
          throw new EvernoteApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        visit(child);
      }
    };
    visit(value);
  }

  private requiredString(value: unknown, field: string) {
    const result = this.optionalString(value);
    if (!result)
      throw new EvernoteApiError(
        "provider_validation_error",
        `${field} is required.`,
      );
    return result;
  }
  private optionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
  private optionalGuid(value: unknown) {
    const guid = this.optionalString(value);
    return guid && /^[0-9a-f-]{36}$/i.test(guid) ? guid : undefined;
  }
  private requiredGuid(value: unknown, field: string) {
    const guid = this.optionalGuid(value);
    if (!guid)
      throw new EvernoteApiError(
        "provider_validation_error",
        `${field} must be an Evernote GUID.`,
      );
    return guid;
  }
  private clamp(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value ?? fallback);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), min), max)
      : fallback;
  }
}
