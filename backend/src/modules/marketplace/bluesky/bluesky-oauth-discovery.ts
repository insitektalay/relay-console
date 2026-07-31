import { BadRequestException, Injectable } from "@nestjs/common";
import { BlueskyOAuthSecurity } from "./bluesky-oauth-security";

export type BlueskyOAuthBinding = {
  handle: string;
  did: string;
  pds: string;
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  pushedAuthorizationRequestEndpoint: string;
  revocationEndpoint: string | null;
};

@Injectable()
export class BlueskyOAuthDiscovery {
  constructor(private readonly security: BlueskyOAuthSecurity) {}

  async discover(rawHandle: string): Promise<BlueskyOAuthBinding> {
    const handle = this.normalizeHandle(rawHandle);
    const resolveUrl = new URL(
      "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle",
    );
    resolveUrl.searchParams.set("handle", handle);
    const resolved = await this.security.fetchJson(resolveUrl.toString(), {
      maxRedirects: 0,
    });
    const did = this.requireDid(resolved.body.did);
    const didDocument = await this.fetchDidDocument(did);
    this.assertHandleClaim(didDocument, handle);
    const pds = await this.extractPds(did, didDocument);
    const protectedResource = await this.security.fetchJson(
      `${pds}/.well-known/oauth-protected-resource`,
    );
    const resource = this.requireOrigin(
      protectedResource.body.resource,
      "protected-resource identifier",
    );
    if (resource !== pds) {
      throw new BadRequestException("Bluesky protected-resource PDS mismatch");
    }
    const issuers = this.stringArray(
      protectedResource.body.authorization_servers,
    );
    if (issuers.length !== 1) {
      throw new BadRequestException(
        "Bluesky protected resource must declare exactly one authorization server",
      );
    }
    const issuer = this.requireOrigin(issuers[0], "authorization issuer");
    await this.security.assertSafeHttpsUrl(issuer);
    const metadata = await this.security.fetchJson(
      `${issuer}/.well-known/oauth-authorization-server`,
    );
    if (
      this.requireOrigin(metadata.body.issuer, "metadata issuer") !== issuer
    ) {
      throw new BadRequestException("Bluesky authorization issuer mismatch");
    }
    this.assertIncludes(
      metadata.body.response_types_supported,
      "code",
      "response type",
    );
    this.assertIncludes(
      metadata.body.grant_types_supported,
      "authorization_code",
      "authorization-code grant",
    );
    this.assertIncludes(
      metadata.body.grant_types_supported,
      "refresh_token",
      "refresh-token grant",
    );
    this.assertIncludes(
      metadata.body.code_challenge_methods_supported,
      "S256",
      "PKCE S256",
    );
    this.assertIncludes(
      metadata.body.dpop_signing_alg_values_supported,
      "ES256",
      "DPoP ES256",
    );
    this.assertIncludes(
      metadata.body.scopes_supported,
      "atproto",
      "atproto scope",
    );
    this.assertIncludes(
      metadata.body.token_endpoint_auth_methods_supported,
      "none",
      "public-client token authentication",
    );
    const authorizationEndpoint = await this.requireSafeEndpoint(
      metadata.body.authorization_endpoint,
      issuer,
      "authorization endpoint",
    );
    const tokenEndpoint = await this.requireSafeEndpoint(
      metadata.body.token_endpoint,
      issuer,
      "token endpoint",
    );
    const pushedAuthorizationRequestEndpoint = await this.requireSafeEndpoint(
      metadata.body.pushed_authorization_request_endpoint,
      issuer,
      "PAR endpoint",
    );
    const revocationEndpoint = metadata.body.revocation_endpoint
      ? await this.requireSafeEndpoint(
          metadata.body.revocation_endpoint,
          issuer,
          "revocation endpoint",
        )
      : null;
    return {
      handle,
      did,
      pds,
      issuer,
      authorizationEndpoint,
      tokenEndpoint,
      pushedAuthorizationRequestEndpoint,
      revocationEndpoint,
    };
  }

  private async fetchDidDocument(did: string) {
    if (did.startsWith("did:plc:")) {
      const result = await this.security.fetchJson(
        `https://plc.directory/${encodeURIComponent(did)}`,
        { maxRedirects: 0 },
      );
      return result.body;
    }
    if (did.startsWith("did:web:")) {
      const segments = did.slice("did:web:".length).split(":");
      const hostname = decodeURIComponent(segments.shift() ?? "");
      if (!hostname || segments.some((segment) => !segment)) {
        throw new BadRequestException("Bluesky did:web identifier is invalid");
      }
      const path = segments.length
        ? `/${segments.map(encodeURIComponent).join("/")}/did.json`
        : "/.well-known/did.json";
      const result = await this.security.fetchJson(
        `https://${hostname}${path}`,
        {
          maxRedirects: 0,
        },
      );
      return result.body;
    }
    throw new BadRequestException("Bluesky DID method is not supported");
  }

  private async extractPds(did: string, document: Record<string, unknown>) {
    if (document.id !== did) {
      throw new BadRequestException("Bluesky DID document identifier mismatch");
    }
    const services = Array.isArray(document.service) ? document.service : [];
    const matches = services.filter((service) => {
      if (!service || typeof service !== "object" || Array.isArray(service))
        return false;
      const value = service as Record<string, unknown>;
      return value.id === "#atproto_pds" || value.id === `${did}#atproto_pds`;
    }) as Array<Record<string, unknown>>;
    if (
      matches.length !== 1 ||
      matches[0].type !== "AtprotoPersonalDataServer"
    ) {
      throw new BadRequestException(
        "Bluesky DID document has no unique AT Protocol PDS",
      );
    }
    const pds = this.requireOrigin(matches[0].serviceEndpoint, "PDS endpoint");
    await this.security.assertSafeHttpsUrl(pds);
    return pds;
  }

  private assertHandleClaim(document: Record<string, unknown>, handle: string) {
    const aliases = this.stringArray(document.alsoKnownAs);
    if (!aliases.includes(`at://${handle}`)) {
      throw new BadRequestException(
        "Bluesky DID document did not verify the resolved handle",
      );
    }
  }

  private normalizeHandle(rawHandle: string) {
    const handle = String(rawHandle ?? "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();
    if (
      handle.length < 3 ||
      handle.length > 253 ||
      !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(handle) ||
      !handle.includes(".") ||
      handle.includes("..")
    ) {
      throw new BadRequestException("Bluesky handle is invalid");
    }
    return handle;
  }

  private requireDid(value: unknown) {
    const did = typeof value === "string" ? value.trim() : "";
    if (!/^did:(?:plc|web):[A-Za-z0-9._:%-]+$/.test(did) || did.length > 512) {
      throw new BadRequestException(
        "Bluesky handle did not resolve to a supported DID",
      );
    }
    return did;
  }

  private requireOrigin(value: unknown, label: string) {
    if (typeof value !== "string") {
      throw new BadRequestException(`Bluesky ${label} is missing`);
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(`Bluesky ${label} is invalid`);
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new BadRequestException(`Bluesky ${label} must be an HTTPS origin`);
    }
    return url.origin;
  }

  private async requireSafeEndpoint(
    value: unknown,
    issuer: string,
    label: string,
  ) {
    if (typeof value !== "string") {
      throw new BadRequestException(`Bluesky ${label} is missing`);
    }
    const safe = await this.security.assertSafeHttpsUrl(value);
    if (new URL(safe).origin !== issuer) {
      throw new BadRequestException(
        `Bluesky ${label} must stay on the authorization issuer`,
      );
    }
    return safe;
  }

  private assertIncludes(value: unknown, expected: string, label: string) {
    if (!this.stringArray(value).includes(expected)) {
      throw new BadRequestException(
        `Bluesky authorization server lacks ${label}`,
      );
    }
  }

  private stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }
}
