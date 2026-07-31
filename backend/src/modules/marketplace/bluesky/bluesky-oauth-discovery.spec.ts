import { BadRequestException } from "@nestjs/common";
import { BlueskyOAuthDiscovery } from "./bluesky-oauth-discovery";
import { BlueskyOAuthSecurity } from "./bluesky-oauth-security";

describe("BlueskyOAuthDiscovery", () => {
  const did = "did:plc:z72i7hdynmk6r22z27h6tvur";
  const pds = "https://bsky.social";
  const issuer = "https://oauth.bsky.app";

  function subject(overrides: Record<string, Record<string, unknown>> = {}) {
    const bodies: Record<string, Record<string, unknown>> = {
      "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=bsky.app":
        { did },
      [`https://plc.directory/${encodeURIComponent(did)}`]: {
        id: did,
        alsoKnownAs: ["at://bsky.app"],
        service: [
          {
            id: "#atproto_pds",
            type: "AtprotoPersonalDataServer",
            serviceEndpoint: pds,
          },
        ],
      },
      [`${pds}/.well-known/oauth-protected-resource`]: {
        resource: pds,
        authorization_servers: [issuer],
      },
      [`${issuer}/.well-known/oauth-authorization-server`]: {
        issuer,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        dpop_signing_alg_values_supported: ["ES256"],
        scopes_supported: ["atproto"],
        token_endpoint_auth_methods_supported: ["none"],
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        pushed_authorization_request_endpoint: `${issuer}/par`,
        revocation_endpoint: `${issuer}/revoke`,
      },
      ...overrides,
    };
    const security = {
      fetchJson: jest.fn(async (url: string) => {
        const body = bodies[url];
        if (!body) throw new Error(`unexpected URL ${url}`);
        return { url, response: new Response(), body };
      }),
      assertSafeHttpsUrl: jest.fn(async (url: string) => url),
    } as unknown as BlueskyOAuthSecurity;
    return { discovery: new BlueskyOAuthDiscovery(security), security };
  }

  it("binds handle, DID, PDS, issuer, PAR, token, and revoke endpoints", async () => {
    const { discovery } = subject();
    await expect(discovery.discover("@BSKY.APP")).resolves.toEqual({
      handle: "bsky.app",
      did,
      pds,
      issuer,
      authorizationEndpoint: `${issuer}/authorize`,
      tokenEndpoint: `${issuer}/token`,
      pushedAuthorizationRequestEndpoint: `${issuer}/par`,
      revocationEndpoint: `${issuer}/revoke`,
    });
  });

  it("rejects a protected-resource substitution", async () => {
    const { discovery } = subject({
      [`${pds}/.well-known/oauth-protected-resource`]: {
        resource: "https://evil.example",
        authorization_servers: [issuer],
      },
    });
    await expect(discovery.discover("bsky.app")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects a DID document that does not claim the resolved handle", async () => {
    const { discovery } = subject({
      [`https://plc.directory/${encodeURIComponent(did)}`]: {
        id: did,
        alsoKnownAs: ["at://different.example"],
        service: [
          {
            id: "#atproto_pds",
            type: "AtprotoPersonalDataServer",
            serviceEndpoint: pds,
          },
        ],
      },
    });
    await expect(discovery.discover("bsky.app")).rejects.toThrow(
      "did not verify the resolved handle",
    );
  });

  it("rejects an endpoint that escapes the discovered issuer", async () => {
    const { discovery } = subject({
      [`${issuer}/.well-known/oauth-authorization-server`]: {
        issuer,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        dpop_signing_alg_values_supported: ["ES256"],
        scopes_supported: ["atproto"],
        token_endpoint_auth_methods_supported: ["none"],
        authorization_endpoint: "https://evil.example/authorize",
        token_endpoint: `${issuer}/token`,
        pushed_authorization_request_endpoint: `${issuer}/par`,
      },
    });
    await expect(discovery.discover("bsky.app")).rejects.toThrow(
      "must stay on the authorization issuer",
    );
  });
});
