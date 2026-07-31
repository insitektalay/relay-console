import { Injectable } from "@nestjs/common";

export class SharePointApiError extends Error {
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
const SAFE_SITE_ID =
  /^[a-z0-9.-]{1,253},[A-Za-z0-9-]{1,64},[A-Za-z0-9-]{1,64}$/;
const ITEM_SELECT =
  "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,package,deleted";

@Injectable()
export class SharePointApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(accessToken: string, siteId: string) {
    const site = await this.getSite(accessToken, siteId);
    if (!site.site.id)
      throw new SharePointApiError(
        "sharepoint_site_binding_missing",
        "Microsoft Graph did not return the selected SharePoint site binding.",
      );
    return { reachable: true, siteId: site.site.id, metadataOnly: true };
  }

  async getSite(accessToken: string, siteId: string) {
    const id = this.siteId(siteId);
    const body = this.object(
      await this.get(accessToken, `/v1.0/sites/${id}`, {
        $select:
          "id,displayName,name,description,webUrl,createdDateTime,lastModifiedDateTime,isPersonalSite",
      }),
    );
    return {
      site: {
        id: this.scalar(body.id),
        displayName: this.scalar(body.displayName),
        name: this.scalar(body.name),
        description: this.scalar(body.description),
        webUrl: this.safeWebUrl(body.webUrl),
        createdAt: this.scalar(body.createdDateTime),
        modifiedAt: this.scalar(body.lastModifiedDateTime),
        personalSite: Boolean(body.isPersonalSite),
      },
    };
  }

  async listLists(accessToken: string, siteId: string) {
    const id = this.siteId(siteId);
    const root = this.object(
      await this.get(accessToken, `/v1.0/sites/${id}/lists`, {
        $top: "25",
        $select:
          "id,displayName,name,description,webUrl,createdDateTime,lastModifiedDateTime,list",
      }),
    );
    const rows = Array.isArray(root.value)
      ? root.value.slice(0, 25).map((value) => {
          const row = this.object(value);
          const list = this.object(row.list);
          return {
            id: this.scalar(row.id),
            displayName: this.scalar(row.displayName),
            name: this.scalar(row.name),
            description: this.scalar(row.description),
            webUrl: this.safeWebUrl(row.webUrl),
            template: this.scalar(list.template),
            hidden: Boolean(list.hidden),
            createdAt: this.scalar(row.createdDateTime),
            modifiedAt: this.scalar(row.lastModifiedDateTime),
            itemsAndFieldsExcluded: true,
          };
        })
      : [];
    return { lists: rows, resultCount: rows.length, nextPageFollowed: false };
  }

  async listDrives(accessToken: string, siteId: string) {
    const id = this.siteId(siteId);
    const root = this.object(
      await this.get(accessToken, `/v1.0/sites/${id}/drives`, {
        $top: "25",
        $select:
          "id,name,description,driveType,webUrl,createdDateTime,lastModifiedDateTime",
      }),
    );
    const rows = Array.isArray(root.value)
      ? root.value.slice(0, 25).map((value) => {
          const row = this.object(value);
          return {
            id: this.scalar(row.id),
            name: this.scalar(row.name),
            description: this.scalar(row.description),
            driveType: this.scalar(row.driveType),
            webUrl: this.safeWebUrl(row.webUrl),
            createdAt: this.scalar(row.createdDateTime),
            modifiedAt: this.scalar(row.lastModifiedDateTime),
          };
        })
      : [];
    return { drives: rows, resultCount: rows.length, nextPageFollowed: false };
  }

  async listDefaultLibraryRoot(accessToken: string, siteId: string) {
    const id = this.siteId(siteId);
    const root = this.object(
      await this.get(accessToken, `/v1.0/sites/${id}/drive/root/children`, {
        $top: "25",
        $select: ITEM_SELECT,
      }),
    );
    const rows = Array.isArray(root.value)
      ? root.value.slice(0, 25).map((value) => this.item(this.object(value)))
      : [];
    return { items: rows, resultCount: rows.length, nextPageFollowed: false };
  }

  private async get(
    accessToken: string,
    path: string,
    query: Record<string, string>,
  ) {
    if (!accessToken.trim())
      throw new SharePointApiError(
        "sharepoint_token_invalid",
        "SharePoint connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
    if (
      url.origin !== API_ORIGIN ||
      !/^\/v1\.0\/sites\/[a-z0-9.-]{1,253},[A-Za-z0-9-]{1,64},[A-Za-z0-9-]{1,64}(?:\/lists|\/drives|\/drive\/root\/children)?$/.test(
        url.pathname,
      ) ||
      /\/(items|columns|content|permissions|analytics|subscriptions|delta|search)(\/|$)/i.test(
        url.pathname,
      )
    )
      throw new SharePointApiError(
        "sharepoint_path_blocked",
        "SharePoint request path is outside the selected-site metadata-only V1 allowlist.",
      );
    for (const [key, value] of Object.entries(query).sort(([a], [b]) =>
      a.localeCompare(b),
    ))
      url.searchParams.set(key, value);
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
      throw new SharePointApiError(
        "sharepoint_unavailable",
        "Microsoft Graph SharePoint is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new SharePointApiError(
        "sharepoint_response_too_large",
        "Microsoft Graph SharePoint response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new SharePointApiError(
        "sharepoint_response_invalid",
        "Microsoft Graph returned an invalid SharePoint response.",
      );
    }
    if (!response.ok)
      throw new SharePointApiError(
        response.status === 401
          ? "sharepoint_token_invalid"
          : response.status === 403
            ? "sharepoint_permission_denied"
            : response.status === 404
              ? "sharepoint_not_found"
              : response.status === 429
                ? "sharepoint_rate_limited"
                : "sharepoint_graph_error",
        "Microsoft Graph SharePoint request failed.",
        response.status,
      );
    return body;
  }

  private siteId(value: string) {
    if (!SAFE_SITE_ID.test(value))
      throw new SharePointApiError(
        "sharepoint_site_id_invalid",
        "A safe connection-bound SharePoint site ID is required.",
      );
    return value;
  }
  private item(row: Record<string, unknown>) {
    const file = this.object(row.file);
    const folder = this.object(row.folder);
    return {
      id: this.scalar(row.id),
      name: this.scalar(row.name),
      kind: Object.keys(folder).length
        ? "folder"
        : Object.keys(file).length
          ? "file"
          : row.package
            ? "package"
            : "item",
      size: this.scalar(row.size),
      createdAt: this.scalar(row.createdDateTime),
      modifiedAt: this.scalar(row.lastModifiedDateTime),
      webUrl: this.safeWebUrl(row.webUrl),
      mimeType: this.scalar(file.mimeType),
      childCount: this.scalar(folder.childCount),
      deleted: Boolean(row.deleted),
    };
  }
  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
  private safeWebUrl(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.toString().slice(0, 2048) : null;
    } catch {
      return null;
    }
  }
}
