import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { MarketplaceConnectorOAuthService } from "./connectors/connector-oauth.service";

@Public()
@Controller("marketplace/oauth/:slug/callback")
export class MarketplaceConnectorOAuthCallbackController {
  private readonly logger = new Logger(
    MarketplaceConnectorOAuthCallbackController.name,
  );

  constructor(
    private readonly connectorOAuthService: MarketplaceConnectorOAuthService,
  ) {}

  private finishBrowserCallback(response: Response, redirectUrl: string) {
    const target = new URL(redirectUrl);
    if (target.protocol !== "relayconsole:") {
      return response.redirect(redirectUrl);
    }

    const connected = target.searchParams.get("status") === "connected";
    const title = connected
      ? "Connection complete"
      : "Connection not completed";
    const detail = connected
      ? "Relay Console is connected. You can close this browser tab."
      : "Nothing was connected. Return to Relay Console for the next step.";
    const safeTarget = JSON.stringify(redirectUrl).replace(/</g, "\\u003c");
    const safeHref = redirectUrl
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    response.status(200).type("html").set({
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    return response.send(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>html{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#11151a;color:#f4f1e8;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{max-width:34rem;margin:2rem;padding:2rem;border:1px solid #38414b;border-radius:16px;background:#171d24}h1{margin:0 0 .75rem;font-size:1.5rem}p{margin:0 0 1.25rem;color:#b8c0ca;line-height:1.5}a{display:inline-block;padding:.75rem 1rem;border-radius:8px;background:#4f91e8;color:#07111d;text-decoration:none;font-weight:600}</style><main class="card"><h1>${title}</h1><p>${detail}</p><a href="${safeHref}">Return to Relay Console</a></main><script>window.location.assign(${safeTarget})</script></html>`,
    );
  }

  @Get()
  async callback(
    @Param("slug") slug: string,
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string | undefined,
    @Query("error_description") _errorDescription: string | undefined,
    @Query("oauth_token") oauthToken: string | undefined,
    @Query("oauth_verifier") oauthVerifier: string | undefined,
    @Query("location") location: string | undefined,
    @Query("accounts-server") accountsServer: string | undefined,
    @Query("locationid") pCloudLocationId: string | undefined,
    @Query("hostname") pCloudHostname: string | undefined,
    @Query("subdomain") subdomain: string | undefined,
    @Query("account_subdomain") accountSubdomain: string | undefined,
    @Query("apicp") apicp: string | undefined,
    @Query("appcp") appcp: string | undefined,
    @Query("h") callbackHmac: string | undefined,
    @Query("hmac") shopifyHmac: string | undefined,
    @Query("shop") shopifyShop: string | undefined,
    @Query("timestamp") shopifyTimestamp: string | undefined,
    @Query("guid") companyGuid: string | undefined,
    @Query("company_id") companyId: string | undefined,
    @Query("installation_id") installationId: string | undefined,
    @Query("realmId") realmId: string | undefined,
    @Query("api_access_point") adobeApiAccessPoint: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const callbackState = state || oauthToken || "";
    const callbackCode = code || oauthVerifier || "";
    if (
      ["egnyte", "contentful"].includes(slug) &&
      !callbackCode &&
      !error &&
      (slug === "contentful" || callbackState)
    ) {
      const safeState = JSON.stringify(callbackState).replace(/</g, "\\u003c");
      const safeName = slug === "contentful" ? "Contentful" : "Egnyte";
      const fragmentState = slug === "contentful";
      response.status(200).type("html").set({
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      });
      return response.send(
        `<!doctype html><meta charset="utf-8"><title>Connecting ${safeName}</title><p id="status">Finishing your ${safeName} connection…</p><script>(()=>{const callbackState=${safeState};const params=new URLSearchParams(location.hash.slice(1));const state=${fragmentState ? 'params.get("state")||callbackState' : "callbackState"};const token=params.get("access_token");const error=params.get("error")||params.get("error_description");history.replaceState(null,"",location.pathname+location.search);fetch(location.pathname,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({state,accessToken:token,error})}).then(r=>r.json()).then(v=>{if(!v.redirectUrl)throw new Error(v.message||"${safeName} connection failed");location.replace(v.redirectUrl)}).catch(e=>{document.getElementById("status").textContent=e.message||"${safeName} connection failed"})})();</script>`,
      );
    }
    if (
      slug === "github" &&
      callbackState &&
      installationId &&
      !callbackCode &&
      !error
    ) {
      try {
        return this.finishBrowserCallback(
          response,
          await this.connectorOAuthService.resumeGitHubOAuthAfterInstallation(
            callbackState,
            installationId,
          ),
        );
      } catch (installationError) {
        return this.finishBrowserCallback(
          response,
          await this.connectorOAuthService.buildCallbackRedirect(slug, {
            state: callbackState,
            status: "error",
            message:
              installationError instanceof Error
                ? installationError.message
                : "GitHub installation setup failed",
          }),
        );
      }
    }
    if (error) {
      const redirectUrl =
        await this.connectorOAuthService.buildCallbackRedirect(slug, {
          state: callbackState,
          status: "error",
          message:
            error === "access_denied"
              ? "OAuth authorization was denied."
              : "OAuth authorization failed.",
        });
      await this.connectorOAuthService.cancelOAuthState(slug, callbackState);
      return this.finishBrowserCallback(response, redirectUrl);
    }
    try {
      const result = await this.connectorOAuthService.completeOAuth(slug, {
        code: callbackCode,
        state: callbackState,
        location,
        accountsServer,
        pCloudLocationId,
        pCloudHostname,
        subdomain,
        accountSubdomain,
        apicp,
        appcp,
        callbackHmac,
        shopifyHmac,
        shopifyShop,
        shopifyTimestamp,
        companyGuid,
        companyId,
        realmId,
        businessId:
          typeof request.query.businessId === "string"
            ? request.query.businessId
            : undefined,
        adobeApiAccessPoint,
        rawCallbackPathAndQuery: request.originalUrl,
      });
      return this.finishBrowserCallback(
        response,
        await this.connectorOAuthService.buildCallbackRedirect(slug, {
          state: callbackState,
          status: "connected",
          connectionId: result.connection.id,
          returnTo: result.returnTo,
        }),
      );
    } catch (callbackError) {
      const rawCode =
        callbackError && typeof callbackError === "object"
          ? (callbackError as { code?: unknown }).code
          : null;
      const failureCode =
        typeof rawCode === "string" && /^[a-z0-9_]{1,80}$/.test(rawCode)
          ? rawCode
          : callbackError instanceof Error &&
              /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(callbackError.name)
            ? callbackError.name
            : "unknown_error";
      this.logger.warn(
        JSON.stringify({
          event: "marketplace.oauth.callback_failed",
          provider: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
            ? slug
            : "invalid",
          failureCode,
        }),
      );
      return this.finishBrowserCallback(
        response,
        await this.connectorOAuthService.buildCallbackRedirect(slug, {
          state: callbackState,
          status: "error",
          message: "OAuth connection failed. Try again.",
        }),
      );
    }
  }

  @Post()
  async implicitCallback(
    @Param("slug") slug: string,
    @Body()
    body: {
      state?: string;
      code?: string | null;
      accessToken?: string | null;
      error?: string | null;
      error_description?: string | null;
    },
    @Res() response: Response,
  ) {
    if (["copper", "intercom"].includes(slug)) {
      const state = body.state?.trim() ?? "";
      if (body.error || !body.code) {
        return response.redirect(
          await this.connectorOAuthService.buildCallbackRedirect(slug, {
            state,
            status: "error",
            message:
              body.error_description ||
              body.error ||
              "Copper did not return an authorization code",
          }),
        );
      }
      try {
        const result = await this.connectorOAuthService.completeOAuth(slug, {
          state,
          code: body.code,
        });
        return response.redirect(
          await this.connectorOAuthService.buildCallbackRedirect(slug, {
            state,
            status: "connected",
            connectionId: result.connection.id,
            returnTo: result.returnTo,
          }),
        );
      } catch (error) {
        return response.redirect(
          await this.connectorOAuthService.buildCallbackRedirect(slug, {
            state,
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : `${slug === "intercom" ? "Intercom" : "Copper"} OAuth callback failed`,
          }),
        );
      }
    }
    if (!["egnyte", "contentful"].includes(slug)) {
      return response.json({
        message: "Implicit OAuth callback is not supported for this provider",
      });
    }
    const state = body.state?.trim() ?? "";
    if (body.error || !body.accessToken) {
      return response.json({
        redirectUrl: await this.connectorOAuthService.buildCallbackRedirect(
          slug,
          {
            state,
            status: "error",
            message:
              body.error ||
              `${slug === "contentful" ? "Contentful" : "Egnyte"} did not return an access token`,
          },
        ),
      });
    }
    try {
      const result = await this.connectorOAuthService.completeOAuth(slug, {
        state,
        code: body.accessToken,
      });
      return response.json({
        redirectUrl: await this.connectorOAuthService.buildCallbackRedirect(
          slug,
          {
            state,
            status: "connected",
            connectionId: result.connection.id,
            returnTo: result.returnTo,
          },
        ),
      });
    } catch (error) {
      return response.json({
        redirectUrl: await this.connectorOAuthService.buildCallbackRedirect(
          slug,
          {
            state,
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : `${slug === "contentful" ? "Contentful" : "Egnyte"} OAuth callback failed`,
          },
        ),
      });
    }
  }
}
