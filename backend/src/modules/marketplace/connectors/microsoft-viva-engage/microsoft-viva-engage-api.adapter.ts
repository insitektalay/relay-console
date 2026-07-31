import { Injectable } from "@nestjs/common";

export class MicrosoftVivaEngageApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export type MicrosoftVivaEngageBinding = {
  currentUserId: string;
  networkId: string;
  communityId: string;
};
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const SAFE_ID = /^\d{1,32}$/;
const ORIGIN = "https://www.yammer.com";

@Injectable()
export class MicrosoftVivaEngageApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(token: string, binding: MicrosoftVivaEngageBinding) {
    const [network, currentUser] = await Promise.all([
      this.getNetwork(token, binding),
      this.getCurrentUser(token, binding),
    ]);
    if (
      network.network.id !== binding.networkId ||
      currentUser.currentUser.id !== binding.currentUserId
    )
      throw new MicrosoftVivaEngageApiError(
        "microsoft_viva_engage_binding_mismatch",
        "Viva Engage returned a different network or current user.",
      );
    return {
      reachable: true,
      networkId: network.network.id,
      currentUserId: currentUser.currentUser.id,
      selectedCommunityId: binding.communityId,
    };
  }

  async getNetwork(token: string, binding: MicrosoftVivaEngageBinding) {
    this.binding(binding);
    const raw = await this.get(token, "/networks/current.json");
    const value = Array.isArray(raw) ? raw[0] : raw;
    const network = this.network(this.object(value));
    if (!network.id)
      throw new MicrosoftVivaEngageApiError(
        "microsoft_viva_engage_response_invalid",
        "Viva Engage returned an invalid current network.",
      );
    return { network };
  }

  async getCurrentUser(token: string, binding: MicrosoftVivaEngageBinding) {
    this.binding(binding);
    const currentUser = this.user(
      this.object(await this.get(token, "/users/current.json")),
    );
    if (!currentUser.id)
      throw new MicrosoftVivaEngageApiError(
        "microsoft_viva_engage_response_invalid",
        "Viva Engage returned an invalid current user.",
      );
    return { currentUser };
  }

  async listMyCommunities(token: string, binding: MicrosoftVivaEngageBinding) {
    const safe = this.binding(binding);
    const values = this.array(
      await this.get(token, `/groups/for_user/${safe.currentUserId}.json`),
    )
      .slice(0, 25)
      .map((value) => this.community(this.object(value)));
    return {
      communities: values,
      resultCount: values.length,
      nextPageFollowed: false,
    };
  }

  async listSelectedCommunityMessages(
    token: string,
    binding: MicrosoftVivaEngageBinding,
  ) {
    const safe = this.binding(binding);
    const root = this.object(
      await this.get(
        token,
        `/messages/in_group/${safe.communityId}.json?threaded=extended&limit=25`,
      ),
    );
    const messages = this.array(root.messages).slice(0, 25);
    if (
      messages.some(
        (value) =>
          this.identifier(this.object(value).group_id) !== safe.communityId,
      )
    )
      throw new MicrosoftVivaEngageApiError(
        "microsoft_viva_engage_selected_community_mismatch",
        "Viva Engage returned a message outside the selected community.",
      );
    return {
      messages: messages.map((value) => this.message(this.object(value))),
      resultCount: messages.length,
      nextPageFollowed: false,
    };
  }

  private async get(token: string, pathAndQuery: string) {
    if (!token.trim())
      throw new MicrosoftVivaEngageApiError(
        "microsoft_viva_engage_token_invalid",
        "Viva Engage connection token is missing.",
      );
    const url = new URL(`/api/v1${pathAndQuery}`, ORIGIN);
    const allowed =
      url.pathname === "/api/v1/networks/current.json" ||
      url.pathname === "/api/v1/users/current.json" ||
      /^\/api\/v1\/groups\/for_user\/\d{1,32}\.json$/.test(url.pathname) ||
      /^\/api\/v1\/messages\/in_group\/\d{1,32}\.json$/.test(url.pathname);
    const messageQuery = url.pathname.includes("/messages/in_group/");
    if (
      url.origin !== ORIGIN ||
      !allowed ||
      (messageQuery
        ? url.searchParams.get("threaded") !== "extended" ||
          url.searchParams.get("limit") !== "25" ||
          [...url.searchParams.keys()].some(
            (key) => !["threaded", "limit"].includes(key),
          )
        : url.search !== "")
    )
      throw new MicrosoftVivaEngageApiError(
        "microsoft_viva_engage_path_blocked",
        "Viva Engage request is outside the fixed selected-community GET V1 allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new MicrosoftVivaEngageApiError(
        "microsoft_viva_engage_unavailable",
        "Viva Engage is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new MicrosoftVivaEngageApiError(
        "microsoft_viva_engage_response_too_large",
        "Viva Engage response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MicrosoftVivaEngageApiError(
        "microsoft_viva_engage_response_invalid",
        "Viva Engage returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new MicrosoftVivaEngageApiError(
        response.status === 401
          ? "microsoft_viva_engage_token_invalid"
          : response.status === 403
            ? "microsoft_viva_engage_permission_denied"
            : response.status === 404
              ? "microsoft_viva_engage_not_found"
              : response.status === 429
                ? "microsoft_viva_engage_rate_limited"
                : "microsoft_viva_engage_api_error",
        "Viva Engage request failed.",
        response.status,
      );
    return body;
  }

  private binding(value: MicrosoftVivaEngageBinding) {
    if (
      !SAFE_ID.test(value.currentUserId) ||
      !SAFE_ID.test(value.networkId) ||
      !SAFE_ID.test(value.communityId)
    )
      throw new MicrosoftVivaEngageApiError(
        "microsoft_viva_engage_binding_invalid",
        "Verified numeric Viva Engage network, user, and community IDs are required.",
      );
    return value;
  }

  private network(row: Record<string, unknown>) {
    return {
      id: this.identifier(row.id),
      name: this.scalar(row.name),
      permalink: this.scalar(row.permalink, 1_024),
      adminFieldsExcluded: true,
    };
  }

  private user(row: Record<string, unknown>) {
    return {
      id: this.identifier(row.id),
      displayName: this.scalar(row.full_name ?? row.name),
      emailContactExcluded: true,
      profileDetailsExcluded: true,
    };
  }

  private community(row: Record<string, unknown>) {
    return {
      id: this.identifier(row.id),
      name: this.scalar(row.name),
      description: this.scalar(row.description, 1_000),
      privacy: this.scalar(row.privacy, 32),
      moderated: this.scalar(row.moderated),
      external: this.scalar(row.external),
      membershipDirectoryExcluded: true,
    };
  }

  private message(row: Record<string, unknown>) {
    const body = this.object(row.body);
    return {
      id: this.identifier(row.id),
      threadId: this.identifier(row.thread_id),
      communityId: this.identifier(row.group_id),
      bodyText: this.scalar(body.plain ?? row.content_excerpt, 4_000),
      createdAt: this.scalar(row.created_at, 64),
      messageType: this.scalar(row.message_type, 64),
      senderIdentityExcluded: true,
      mentionsReactionsExcluded: true,
      attachmentsExcluded: true,
    };
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private identifier(value: unknown): string | null {
    const normalized =
      typeof value === "string"
        ? value
        : typeof value === "number" && Number.isSafeInteger(value)
          ? String(value)
          : "";
    return SAFE_ID.test(normalized) ? normalized : null;
  }

  private scalar(value: unknown, max = 512): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, max);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
}
