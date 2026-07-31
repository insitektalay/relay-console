import { Injectable } from "@nestjs/common";

export class OneNoteApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const API_ORIGIN = "https://graph.microsoft.com";
const SAFE_ID = /^[A-Za-z0-9._!~=-]{1,512}$/;

@Injectable()
export class OneNoteApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(accessToken: string) {
    const result = await this.listNotebooks(accessToken);
    return { reachable: true, resultCount: result.resultCount };
  }

  async listNotebooks(accessToken: string) {
    return this.notebooks(
      await this.get(accessToken, "/v1.0/me/onenote/notebooks"),
    );
  }

  async listSections(accessToken: string, input: Record<string, unknown>) {
    const notebookId = this.id(input.notebookId, "notebookId");
    return this.sections(
      await this.get(
        accessToken,
        `/v1.0/me/onenote/notebooks/${notebookId}/sections`,
      ),
    );
  }

  async listPages(accessToken: string, input: Record<string, unknown>) {
    const sectionId = this.id(input.sectionId, "sectionId");
    return this.pages(
      await this.get(
        accessToken,
        `/v1.0/me/onenote/sections/${sectionId}/pages`,
      ),
    );
  }

  async getPage(accessToken: string, input: Record<string, unknown>) {
    const pageId = this.id(input.pageId, "pageId");
    return {
      page: this.page(
        this.object(
          await this.get(accessToken, `/v1.0/me/onenote/pages/${pageId}`),
        ),
      ),
    };
  }

  private async get(accessToken: string, path: string) {
    if (!accessToken.trim())
      throw new OneNoteApiError(
        "onenote_token_invalid",
        "OneNote connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
    if (
      url.origin !== API_ORIGIN ||
      !/^\/v1\.0\/me\/onenote\/(?:notebooks(?:\/[A-Za-z0-9._!~=-]{1,512}\/sections)?|sections\/[A-Za-z0-9._!~=-]{1,512}\/pages|pages\/[A-Za-z0-9._!~=-]{1,512})$/.test(
        url.pathname,
      ) ||
      /\/(content|resources|operations)(\/|$)/i.test(url.pathname) ||
      url.search
    )
      throw new OneNoteApiError(
        "onenote_path_blocked",
        "OneNote request path is outside the bounded delegated metadata-read V1 allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new OneNoteApiError(
        "onenote_unavailable",
        "Microsoft Graph OneNote is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new OneNoteApiError(
        "onenote_response_too_large",
        "Microsoft Graph OneNote response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new OneNoteApiError(
        "onenote_response_invalid",
        "Microsoft Graph returned an invalid OneNote response.",
      );
    }
    if (!response.ok)
      throw new OneNoteApiError(
        response.status === 401
          ? "onenote_token_invalid"
          : response.status === 403
            ? "onenote_permission_denied"
            : response.status === 404
              ? "onenote_not_found"
              : response.status === 429
                ? "onenote_rate_limited"
                : "onenote_graph_error",
        "Microsoft Graph OneNote request failed.",
        response.status,
      );
    return body;
  }

  private notebooks(value: unknown) {
    const rows = this.rows(value).map((row) => this.notebook(row));
    return {
      notebooks: rows,
      resultCount: rows.length,
      nextPageFollowed: false,
    };
  }

  private sections(value: unknown) {
    const rows = this.rows(value).map((row) => this.section(row));
    return {
      sections: rows,
      resultCount: rows.length,
      nextPageFollowed: false,
    };
  }

  private pages(value: unknown) {
    const rows = this.rows(value).map((row) => this.page(row));
    return { pages: rows, resultCount: rows.length, nextPageFollowed: false };
  }

  private rows(value: unknown) {
    const root = this.object(value);
    return Array.isArray(root.value)
      ? root.value.slice(0, 25).map((row) => this.object(row))
      : [];
  }

  private notebook(row: Record<string, unknown>) {
    return {
      id: this.scalar(row.id),
      displayName: this.scalar(row.displayName),
      createdDateTime: this.scalar(row.createdDateTime),
      lastModifiedDateTime: this.scalar(row.lastModifiedDateTime),
      isDefault: this.scalar(row.isDefault),
      isShared: this.scalar(row.isShared),
      userRole: this.scalar(row.userRole),
      webUrl: this.scalar(
        this.object(this.object(row.links).oneNoteWebUrl).href,
        2048,
      ),
    };
  }

  private section(row: Record<string, unknown>) {
    return {
      id: this.scalar(row.id),
      displayName: this.scalar(row.displayName),
      createdDateTime: this.scalar(row.createdDateTime),
      lastModifiedDateTime: this.scalar(row.lastModifiedDateTime),
      isDefault: this.scalar(row.isDefault),
      pagesUrl: null,
    };
  }

  private page(row: Record<string, unknown>) {
    return {
      id: this.scalar(row.id),
      title: this.scalar(row.title),
      createdDateTime: this.scalar(row.createdDateTime),
      lastModifiedDateTime: this.scalar(row.lastModifiedDateTime),
      level: this.scalar(row.level),
      order: this.scalar(row.order),
      contentUrlExcluded: true,
      contentExcluded: true,
      previewExcluded: true,
      createdByIdentityExcluded: true,
      lastModifiedByIdentityExcluded: true,
    };
  }

  private id(value: unknown, field: string) {
    if (typeof value !== "string" || !SAFE_ID.test(value))
      throw new OneNoteApiError(
        "onenote_input_invalid",
        `A safe explicit ${field} is required.`,
      );
    return value;
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private scalar(value: unknown, max = 512): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, max);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
}
