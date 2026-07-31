import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type CraftCmsCredentials = {
  siteBaseUrl: string;
  graphqlToken: string;
  entryUid: string;
};

export class CraftCmsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

const SELECTED_ENTRY_QUERY = `query RelaySelectedEntryLifecycle($uid: [String]) {
  entries(uid: $uid, limit: 1) {
    uid
    status
    dateCreated
    dateUpdated
  }
}`;

@Injectable()
export class CraftCmsApiAdapter {
  async health(credentials: CraftCmsCredentials) {
    return this.getSelectedEntryLifecycle(credentials);
  }

  async getSelectedEntryLifecycle(credentials: CraftCmsCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/actions/graphql/api`;
    const url = new URL(path, `${boundary.origin}/`);
    if (
      url.origin !== boundary.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new CraftCmsApiError(
        "policy_blocked",
        "Craft CMS requests must stay on the approved GraphQL action route.",
        403,
      );

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${boundary.graphqlToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: SELECTED_ENTRY_QUERY,
          variables: { uid: [boundary.entryUid] },
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new CraftCmsApiError(
        "provider_unavailable",
        "Craft CMS GraphQL API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new CraftCmsApiError(
        "policy_blocked",
        "Craft CMS response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new CraftCmsApiError(
        this.safeCode(response.status),
        `Craft CMS GraphQL API returned HTTP ${response.status}.`,
        response.status,
      );
    const envelope = this.object(value, "GraphQL response");
    if (Array.isArray(envelope.errors) && envelope.errors.length)
      throw new CraftCmsApiError(
        "provider_validation_error",
        "Craft CMS rejected the fixed selected-entry query.",
        502,
      );
    const data = this.object(envelope.data, "GraphQL data");
    if (!Array.isArray(data.entries) || data.entries.length !== 1)
      throw new CraftCmsApiError(
        "provider_validation_error",
        "Craft CMS did not return exactly the selected entry.",
        502,
      );
    const entry = this.object(data.entries[0], "selected entry");
    if (entry.uid !== boundary.entryUid)
      throw new CraftCmsApiError(
        "provider_validation_error",
        "Craft CMS returned a different entry than the selected entry.",
        502,
      );
    return {
      entry: {
        entryUid: boundary.entryUid,
        status: this.requiredText(entry.status, "entry status", 40),
        dateCreated: this.requiredText(
          entry.dateCreated,
          "date-created value",
          100,
        ),
        dateUpdated: this.requiredText(
          entry.dateUpdated,
          "date-updated value",
          100,
        ),
        entryContentOrIdentityIncluded: false,
        otherProjectDataIncluded: false,
      },
    };
  }

  private validate(value: CraftCmsCredentials) {
    let url: URL;
    try {
      url = new URL(value.siteBaseUrl);
    } catch {
      throw new CraftCmsApiError(
        "provider_validation_error",
        "Enter a valid Craft CMS HTTPS site base URL.",
        400,
      );
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const rawPath = url.pathname;
    const normalizedPath = rawPath === "/" ? "" : rawPath.replace(/\/$/, "");
    const safePath =
      normalizedPath === "" ||
      (/^\/(?:[A-Za-z0-9._~-]+)(?:\/[A-Za-z0-9._~-]+)*$/.test(normalizedPath) &&
        !normalizedPath
          .split("/")
          .some((part) => part === "." || part === ".."));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !hostname ||
      hostname !== url.hostname.toLowerCase() ||
      !safePath ||
      /%2f|%5c/i.test(value.siteBaseUrl)
    )
      throw new CraftCmsApiError(
        "policy_blocked",
        "Craft CMS requires one exact public HTTPS site base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (!/^[\x21-\x7e]{32,4096}$/.test(value.graphqlToken))
      throw new CraftCmsApiError(
        "credential_missing",
        "Craft CMS requires one valid dedicated read-only GraphQL schema token.",
        401,
      );
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        value.entryUid,
      )
    )
      throw new CraftCmsApiError(
        "provider_validation_error",
        "Craft CMS requires one exact lowercase selected entry UUID.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      graphqlToken: value.graphqlToken,
      entryUid: value.entryUid,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new CraftCmsApiError(
        "provider_unavailable",
        "Craft CMS host DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new CraftCmsApiError(
        "policy_blocked",
        "Craft CMS host must resolve only to public addresses.",
        403,
      );
  }

  private publicAddress(value: string) {
    if (isIP(value) === 4) {
      const [a, b, c] = value.split(".").map(Number);
      return !(
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0 && (c === 0 || c === 2)) ||
        (a === 192 && b === 88 && c === 99) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113)
      );
    }
    if (isIP(value) === 6) {
      const normalized = value.toLowerCase();
      return !(
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fe8") ||
        normalized.startsWith("fe9") ||
        normalized.startsWith("fea") ||
        normalized.startsWith("feb") ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("ff") ||
        normalized.startsWith("2001:db8:") ||
        normalized.startsWith("::ffff:")
      );
    }
    return false;
  }

  private requiredText(value: unknown, label: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum)
      throw new CraftCmsApiError(
        "provider_validation_error",
        `Craft CMS returned an invalid ${label}.`,
        502,
      );
    return value;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new CraftCmsApiError(
        "provider_validation_error",
        `Craft CMS returned invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 400 || status === 404 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
