import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type DrupalCredentials = {
  siteBaseUrl: string;
  nodeBundle: string;
  nodeUuid: string;
};

export class DrupalApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DrupalApiAdapter {
  async health(credentials: DrupalCredentials) {
    return this.getSelectedNodeLifecycle(credentials);
  }

  async getSelectedNodeLifecycle(credentials: DrupalCredentials) {
    const boundary = this.validate(credentials);
    await this.requirePublicHost(boundary.hostname);
    const path = `${boundary.basePath}/jsonapi/node/${boundary.nodeBundle}/${boundary.nodeUuid}`;
    const url = new URL(path, `${boundary.origin}/`);
    url.searchParams.set(
      `fields[node--${boundary.nodeBundle}]`,
      "status,created,changed",
    );
    if (url.origin !== boundary.origin || url.pathname !== path || url.hash)
      throw new DrupalApiError(
        "policy_blocked",
        "Drupal requests must stay on the selected individual-node JSON:API endpoint.",
        403,
      );

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/vnd.api+json" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new DrupalApiError(
        "provider_unavailable",
        "Drupal JSON:API could not be reached.",
        502,
      );
    }

    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new DrupalApiError(
        "policy_blocked",
        "Drupal response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new DrupalApiError(
        this.safeCode(response.status),
        `Drupal JSON:API returned HTTP ${response.status}.`,
        response.status,
      );

    const root = this.object(value, "JSON:API document");
    if ("included" in root)
      throw new DrupalApiError(
        "provider_validation_error",
        "Drupal unexpectedly returned included related resources.",
        502,
      );
    const data = this.object(root.data, "selected node resource");
    const expectedType = `node--${boundary.nodeBundle}`;
    if (data.type !== expectedType || data.id !== boundary.nodeUuid)
      throw new DrupalApiError(
        "provider_validation_error",
        "Drupal returned a different resource than the selected node.",
        502,
      );
    const attributes = this.object(data.attributes, "selected node attributes");
    if (
      typeof attributes.status !== "boolean" ||
      !this.timestamp(attributes.created) ||
      !this.timestamp(attributes.changed)
    )
      throw new DrupalApiError(
        "provider_validation_error",
        "Drupal returned an invalid selected-node lifecycle projection.",
        502,
      );

    return {
      node: {
        uuid: boundary.nodeUuid,
        resourceType: expectedType,
        published: attributes.status,
        createdAt: attributes.created,
        changedAt: attributes.changed,
        contentAuthorAndRelationshipsIncluded: false,
        authenticatedOrMutableAccessIncluded: false,
      },
    };
  }

  private validate(value: DrupalCredentials) {
    let url: URL;
    try {
      url = new URL(value.siteBaseUrl);
    } catch {
      throw new DrupalApiError(
        "provider_validation_error",
        "Enter a valid Drupal HTTPS site base URL.",
        400,
      );
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const normalizedPath =
      url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
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
      throw new DrupalApiError(
        "policy_blocked",
        "Drupal requires one exact public HTTPS site base URL without embedded credentials, unsafe path segments, query, or fragment.",
        403,
      );
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(value.nodeBundle))
      throw new DrupalApiError(
        "provider_validation_error",
        "Drupal requires one exact lowercase node bundle machine name.",
        400,
      );
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        value.nodeUuid,
      )
    )
      throw new DrupalApiError(
        "provider_validation_error",
        "Drupal requires one exact lowercase canonical node UUID.",
        400,
      );
    return {
      origin: url.origin,
      hostname,
      basePath: normalizedPath,
      nodeBundle: value.nodeBundle,
      nodeUuid: value.nodeUuid,
    };
  }

  private async requirePublicHost(hostname: string) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new DrupalApiError(
        "provider_unavailable",
        "Drupal host DNS could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.publicAddress(address))
    )
      throw new DrupalApiError(
        "policy_blocked",
        "Drupal host must resolve only to public addresses.",
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

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new DrupalApiError(
        "provider_validation_error",
        `Drupal returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private timestamp(value: unknown): value is string {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 400 || status === 401 || status === 403 || status === 404)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
