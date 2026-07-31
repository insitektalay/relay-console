import { COGNITO_FORMS_MCP_RESOURCE } from "../cognito-forms/cognito-forms-mcp.adapter";
import { JOTFORM_MCP_RESOURCE } from "../jotform/jotform-mcp.adapter";
import type { MarketplaceOAuthStateEntity } from "../../../../entities";
import type {
  MarketplaceConnectorOAuthService,
  OAuthTokenResponse,
} from "../connector-oauth.service";

type OAuthCompleteInput = Parameters<
  MarketplaceConnectorOAuthService["completeOAuth"]
>[1];
type OAuthManifest = ReturnType<
  MarketplaceConnectorOAuthService["requireOAuthManifest"]
>;
type OAuthAuthority = ReturnType<
  MarketplaceConnectorOAuthService["oauthStateAuthority"]
>;

type OAuthCompleteTokenExchangeInput = {
  manifest: OAuthManifest;
  input: OAuthCompleteInput;
  oauthState: MarketplaceOAuthStateEntity;
  authority: OAuthAuthority;
  callbackProviderSession: Record<string, unknown> | null;
  clientSecret: string | null | undefined;
  codeVerifier: string | null;
};

export async function exchangeOAuthCompletionToken(
  service: MarketplaceConnectorOAuthService,
  {
    manifest,
    input,
    oauthState,
    authority,
    callbackProviderSession,
    clientSecret,
    codeVerifier,
  }: OAuthCompleteTokenExchangeInput,
): Promise<OAuthTokenResponse> {
  return ["egnyte", "contentful"].includes(manifest.slug)
    ? {
        access_token: input.code,
        token_type: "Bearer",
      }
    : manifest.slug === "mastodon"
      ? await service.exchangeMastodonAuthorizationCode(
          service.stringOrNull(
            callbackProviderSession?.mastodonInstanceOrigin,
          ) ?? "",
          input.code,
          oauthState.redirectUri,
          oauthState.clientId,
          clientSecret!,
          codeVerifier ?? "",
        )
      : manifest.slug === "7shifts"
        ? await service.exchangeToken(
            manifest.slug,
            {
              grant_type: "client_credentials",
              client_id: oauthState.clientId,
              client_secret: clientSecret!,
              scope: oauthState.scopes.join(" "),
            },
            authority,
          )
        : await service.exchangeToken(
            manifest.slug,
            manifest.slug === "teamwork"
              ? {
                  code: input.code,
                  client_id: oauthState.clientId,
                  client_secret: clientSecret!,
                  redirect_uri: oauthState.redirectUri,
                }
              : manifest.slug === "vercel"
                ? {
                    code: input.code,
                    client_id: oauthState.clientId,
                    client_secret: clientSecret!,
                    redirect_uri: oauthState.redirectUri,
                  }
                : manifest.slug === "fillout"
                  ? {
                      code: input.code,
                      client_id: oauthState.clientId,
                      client_secret: clientSecret!,
                      redirect_uri: oauthState.redirectUri,
                    }
                  : manifest.slug === "intercom"
                    ? {
                        code: input.code,
                        client_id: oauthState.clientId,
                        client_secret: clientSecret!,
                      }
                    : manifest.slug === "help-scout"
                      ? {
                          grant_type: "authorization_code",
                          code: input.code,
                          client_id: oauthState.clientId,
                          client_secret: clientSecret!,
                        }
                      : manifest.slug === "clickup"
                        ? {
                            client_id: oauthState.clientId,
                            client_secret: clientSecret!,
                            code: input.code,
                            expiring: "1",
                          }
                        : manifest.slug === "webflow"
                          ? {
                              client_id: oauthState.clientId,
                              client_secret: clientSecret!,
                              code: input.code,
                              redirect_uri: oauthState.redirectUri,
                            }
                          : manifest.slug === "shopify"
                            ? {
                                client_id: oauthState.clientId,
                                client_secret: clientSecret!,
                                code: input.code,
                                expiring: "1",
                              }
                            : manifest.slug === "pcloud"
                              ? {
                                  client_id: oauthState.clientId,
                                  client_secret: clientSecret!,
                                  code: input.code,
                                }
                              : {
                                  grant_type: "authorization_code",
                                  code: input.code,
                                  redirect_uri: oauthState.redirectUri,
                                  client_id: oauthState.clientId,
                                  ...(manifest.auth.oauth?.pkce !== false
                                    ? { code_verifier: codeVerifier! }
                                    : {}),
                                  ...(clientSecret
                                    ? { client_secret: clientSecret }
                                    : {}),
                                  ...(manifest.slug === "zendesk"
                                    ? {
                                        expires_in: "1800",
                                        refresh_token_expires_in: "2592000",
                                      }
                                    : {}),
                                  ...(manifest.slug === "pinterest"
                                    ? { continuous_refresh: "true" }
                                    : {}),
                                  ...([
                                    "zoho",
                                    "zoho-workdrive",
                                    "zoho-books",
                                    "zoho-invoice",
                                    "zoho-expense",
                                    "zoho-desk",
                                    "zoho-people",
                                    "zoho-campaigns",
                                    "zoho-analytics",
                                  ].includes(manifest.slug)
                                    ? { scope: oauthState.scopes.join(",") }
                                    : manifest.slug === "frontify"
                                      ? { scope: oauthState.scopes.join("+") }
                                      : [
                                            "deputy",
                                            "myob",
                                            "shootproof",
                                          ].includes(manifest.slug)
                                        ? {
                                            scope: oauthState.scopes.join(" "),
                                          }
                                        : {}),
                                  ...([
                                    "slite",
                                    "otter-ai",
                                    "fireflies-ai",
                                    "bonsai",
                                    "fathom",
                                    "grain",
                                    "whimsical",
                                    "cognito-forms",
                                    "jotform",
                                    "xmind",
                                    "cloudinary",
                                    "remember-the-milk",
                                    "jane-app",
                                  ].includes(manifest.slug)
                                    ? {
                                        resource:
                                          manifest.slug === "otter-ai"
                                            ? "https://mcp.otter.ai/"
                                            : manifest.slug === "fireflies-ai"
                                              ? "https://api.fireflies.ai/mcp"
                                              : manifest.slug === "bonsai"
                                                ? "https://mcp.hellobonsai.com"
                                                : manifest.slug === "fathom"
                                                  ? "https://api.fathom.ai/mcp"
                                                  : manifest.slug === "grain"
                                                    ? "https://api.grain.com"
                                                    : manifest.slug ===
                                                        "whimsical"
                                                      ? "https://mcp.whimsical.com"
                                                      : manifest.slug ===
                                                          "cognito-forms"
                                                        ? COGNITO_FORMS_MCP_RESOURCE
                                                        : manifest.slug ===
                                                            "jotform"
                                                          ? JOTFORM_MCP_RESOURCE
                                                          : manifest.slug ===
                                                              "xmind"
                                                            ? "https://app.xmind.com/api/mcp"
                                                            : manifest.slug ===
                                                                "cloudinary"
                                                              ? "https://asset-management.mcp.cloudinary.com"
                                                              : manifest.slug ===
                                                                  "remember-the-milk"
                                                                ? "https://www.rememberthemilk.com/mcp"
                                                                : manifest.slug ===
                                                                    "jane-app"
                                                                  ? service.normalizeJaneClinicOrigin(
                                                                      service.stringOrNull(
                                                                        callbackProviderSession?.janeClinicOrigin,
                                                                      ) ?? "",
                                                                    )
                                                                  : "https://api.slite.com/mcp",
                                      }
                                    : {}),
                                },
            authority,
          );
}
