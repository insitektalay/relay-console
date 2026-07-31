import { Injectable } from "@nestjs/common";

export class OneDriveApiError extends Error {
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
const SAFE_ID = /^[A-Za-z0-9._!~-]{1,256}$/;
const ITEM_SELECT =
  "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,package,deleted";

@Injectable()
export class OneDriveApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(accessToken: string) {
    const drive = await this.getDrive(accessToken);
    if (!drive.drive.id)
      throw new OneDriveApiError(
        "onedrive_drive_binding_missing",
        "Microsoft Graph did not return the signed-in user's drive binding.",
      );
    return { reachable: true, driveId: drive.drive.id, metadataOnly: true };
  }

  async getDrive(accessToken: string) {
    const body = this.object(
      await this.get(accessToken, "/v1.0/me/drive", {
        $select: "id,driveType,name,owner,quota,webUrl",
      }),
    );
    const owner = this.object(body.owner);
    const ownerUser = this.object(owner.user);
    const quota = this.object(body.quota);
    return {
      drive: {
        id: this.scalar(body.id),
        name: this.scalar(body.name),
        driveType: this.scalar(body.driveType),
        ownerDisplayName: this.scalar(ownerUser.displayName),
        webUrl: this.safeWebUrl(body.webUrl),
        quotaState: this.scalar(quota.state),
        quotaTotal: this.scalar(quota.total),
        quotaUsed: this.scalar(quota.used),
        quotaRemaining: this.scalar(quota.remaining),
      },
    };
  }

  async listRootItems(accessToken: string) {
    return this.items(
      await this.get(accessToken, "/v1.0/me/drive/root/children", {
        $top: "25",
        $select: ITEM_SELECT,
      }),
    );
  }

  async listFolderItems(accessToken: string, input: Record<string, unknown>) {
    const id = this.id(input.folderId, "folderId");
    return this.items(
      await this.get(accessToken, `/v1.0/me/drive/items/${id}/children`, {
        $top: "25",
        $select: ITEM_SELECT,
      }),
    );
  }

  async getItem(accessToken: string, input: Record<string, unknown>) {
    const id = this.id(input.itemId, "itemId");
    return {
      item: this.item(
        this.object(
          await this.get(accessToken, `/v1.0/me/drive/items/${id}`, {
            $select: ITEM_SELECT,
          }),
        ),
      ),
    };
  }

  private async get(
    accessToken: string,
    path: string,
    query: Record<string, string>,
  ) {
    if (!accessToken.trim())
      throw new OneDriveApiError(
        "onedrive_token_invalid",
        "OneDrive connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
    if (
      url.origin !== API_ORIGIN ||
      !(
        url.pathname === "/v1.0/me/drive" ||
        url.pathname.startsWith("/v1.0/me/drive/")
      ) ||
      /\/(content|search|sharedWithMe|permissions|versions)(\/|$)/i.test(
        url.pathname,
      )
    )
      throw new OneDriveApiError(
        "onedrive_path_blocked",
        "OneDrive request path is outside the metadata-only V1 allowlist.",
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
      throw new OneDriveApiError(
        "onedrive_unavailable",
        "Microsoft Graph OneDrive is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new OneDriveApiError(
        "onedrive_response_too_large",
        "Microsoft Graph OneDrive response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new OneDriveApiError(
        "onedrive_response_invalid",
        "Microsoft Graph returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new OneDriveApiError(
        response.status === 401
          ? "onedrive_token_invalid"
          : response.status === 403
            ? "onedrive_permission_denied"
            : response.status === 404
              ? "onedrive_not_found"
              : response.status === 429
                ? "onedrive_rate_limited"
                : "onedrive_graph_error",
        "Microsoft Graph OneDrive request failed.",
        response.status,
      );
    return body;
  }

  private items(value: unknown) {
    const root = this.object(value);
    const rows = Array.isArray(root.value)
      ? root.value.slice(0, 25).map((row) => this.item(this.object(row)))
      : [];
    return { items: rows, resultCount: rows.length, nextPageFollowed: false };
  }
  private item(row: Record<string, unknown>) {
    const file = this.object(row.file);
    const folder = this.object(row.folder);
    const hashes = this.object(file.hashes);
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
      quickXorHash: this.scalar(hashes.quickXorHash),
      childCount: this.scalar(folder.childCount),
      deleted: Boolean(row.deleted),
    };
  }
  private id(value: unknown, field: string) {
    if (typeof value !== "string" || !SAFE_ID.test(value))
      throw new OneDriveApiError(
        "onedrive_input_invalid",
        `A safe explicit ${field} is required.`,
      );
    return value;
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
