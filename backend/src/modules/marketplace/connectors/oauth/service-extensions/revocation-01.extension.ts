import { safeConnectorFetch } from "../../safe-connector-fetch";
import type { MarketplaceConnectorOAuthService } from "../../connector-oauth.service";
import type { MarketplaceConnectionEntity } from "../../../../../entities";
import { BadRequestException } from "@nestjs/common";

export const OAuthRevocationExtension01 = {
  async revokeDigitalOceanSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    if (!accessToken)
      throw new BadRequestException(
        "DigitalOcean disconnect credentials are incomplete",
      );
    const response = await safeConnectorFetch(
      "https://cloud.digitalocean.com/v1/oauth/revoke",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token: accessToken }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new BadRequestException("DigitalOcean upstream revoke failed");
  },

  async revokeFirebaseSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!token)
      throw new BadRequestException(
        "Firebase disconnect credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new BadRequestException("Firebase Google OAuth revoke failed");
  },

  async revokeSupabaseSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.stringOrNull(stored.clientSecret);
    const refreshToken = this.stringOrNull(stored.refreshToken);
    if (!clientId || !clientSecret || !refreshToken)
      throw new BadRequestException(
        "Supabase disconnect credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://api.supabase.com/v1/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new BadRequestException("Supabase upstream revoke failed");
  },

  async disconnectAcuitySchedulingSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    const clientId =
      this.stringOrNull(stored.clientId) ??
      this.configService.get<string>("ACUITY_SCHEDULING_CLIENT_ID")?.trim();
    const clientSecret =
      this.stringOrNull(stored.clientSecret) ??
      this.configService.get<string>("ACUITY_SCHEDULING_CLIENT_SECRET")?.trim();
    if (!accessToken || !clientId || !clientSecret) {
      throw new BadRequestException(
        "Acuity Scheduling disconnect credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch(
      "https://acuityscheduling.com/oauth2/disconnect",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          access_token: accessToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      throw new BadRequestException(
        "Acuity Scheduling upstream disconnect failed",
      );
    }
  },

  async revokeFilloutSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    if (!accessToken)
      throw new BadRequestException("Fillout disconnect token is unavailable");
    const response = await safeConnectorFetch(
      "https://server.fillout.com/public/oauth/invalidate",
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authentication: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok)
      throw new BadRequestException(
        "Fillout token invalidation failed; the local connection was retained",
      );
  },

  async revokeKlaviyoSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const isSms = connection.appSlug === "klaviyo-sms";
    const clientId =
      this.configService
        .get<string>(isSms ? "KLAVIYO_SMS_CLIENT_ID" : "KLAVIYO_CLIENT_ID")
        ?.trim() ?? this.stringOrNull(connection.metadata?.clientId);
    const clientSecret = this.configService
      .get<string>(
        isSms ? "KLAVIYO_SMS_CLIENT_SECRET" : "KLAVIYO_CLIENT_SECRET",
      )
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "Klaviyo disconnect credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://a.klaviyo.com/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token,
        token_type_hint: stored.refreshToken ? "refresh_token" : "access_token",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException(
        "Klaviyo token revocation failed; the local connection was retained",
      );
  },

  async revokeTimelyTimeTrackingSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!token) return;
    const clientId =
      this.configService
        .get<string>("TIMELY_TIME_TRACKING_CLIENT_ID")
        ?.trim() ?? this.stringOrNull(stored.clientId);
    const clientSecret = this.configService
      .get<string>("TIMELY_TIME_TRACKING_CLIENT_SECRET")
      ?.trim();
    if (!clientId || !clientSecret) return;
    const response = await safeConnectorFetch("https://api.timelyapp.com/1.1/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        token_type_hint: stored.refreshToken ? "refresh_token" : "access_token",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new BadRequestException("Timely OAuth token revocation failed");
  },

  async revokeXeroSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    const refreshToken = this.stringOrNull(stored.refreshToken);
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.stringOrNull(stored.clientSecret);
    const connectionId = this.stringOrNull(
      connection.metadata?.xeroConnectionId,
    );
    if (
      !accessToken ||
      !refreshToken ||
      !clientId ||
      !clientSecret ||
      !connectionId ||
      !this.isUuid(connectionId)
    )
      throw new BadRequestException(
        "Xero revocation credentials are incomplete",
      );
    const disconnect = await safeConnectorFetch(
      `https://api.xero.com/connections/${encodeURIComponent(connectionId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!disconnect.ok)
      throw new BadRequestException("Xero organisation disconnect failed");
    const revoke = await safeConnectorFetch("https://identity.xero.com/connect/revocation", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ token: refreshToken }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!revoke.ok)
      throw new BadRequestException("Xero token revocation failed");
  },

  async revokeQuickBooksSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.configService.get<string>("QUICKBOOKS_CLIENT_ID")?.trim() ??
      this.stringOrNull(stored.clientId);
    const clientSecret = this.configService
      .get<string>("QUICKBOOKS_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "QuickBooks revocation credentials are incomplete",
      );
    const revoke = await safeConnectorFetch(
      "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: JSON.stringify({ token }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!revoke.ok)
      throw new BadRequestException("QuickBooks token revocation failed");
  },

  async revokeBeehiivSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.configService.get<string>("BEEHIIV_CLIENT_ID")?.trim() ??
      this.stringOrNull(stored.clientId);
    const clientSecret =
      this.configService.get<string>("BEEHIIV_CLIENT_SECRET")?.trim() ??
      this.stringOrNull(stored.clientSecret);
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "beehiiv revocation credentials are incomplete",
      );
    const revoke = await safeConnectorFetch("https://app.beehiiv.com/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token,
        token_type_hint: this.stringOrNull(stored.refreshToken)
          ? "refresh_token"
          : "access_token",
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!revoke.ok)
      throw new BadRequestException("beehiiv token revocation failed");
  },

  async revokeFreshBooksSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.configService.get<string>("FRESHBOOKS_CLIENT_ID")?.trim() ??
      this.stringOrNull(stored.clientId);
    const clientSecret = this.configService
      .get<string>("FRESHBOOKS_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "FreshBooks revocation credentials are incomplete",
      );
    const revoke = await safeConnectorFetch("https://api.freshbooks.com/auth/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        token,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!revoke.ok)
      throw new BadRequestException("FreshBooks token revocation failed");
  },

  async revokeWaveSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.configService.get<string>("WAVE_CLIENT_ID")?.trim() ??
      this.stringOrNull(stored.clientId);
    const clientSecret = this.configService
      .get<string>("WAVE_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "Wave revocation credentials are incomplete",
      );
    const revoke = await safeConnectorFetch(
      "https://api.waveapps.com/oauth2/token-revoke/",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          token,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!revoke.ok)
      throw new BadRequestException("Wave token revocation failed");
  },

  async revokeSalesforceSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const origin = this.stringOrNull(
      connection.metadata?.salesforceInstanceOrigin,
    );
    if (!token || !origin)
      throw new BadRequestException(
        "Salesforce revocation credentials are incomplete",
      );
    let url: URL;
    try {
      const instance = new URL(origin);
      if (
        instance.protocol !== "https:" ||
        !instance.hostname.toLowerCase().endsWith(".my.salesforce.com") ||
        instance.username ||
        instance.password ||
        instance.port ||
        (instance.pathname !== "/" && instance.pathname !== "") ||
        instance.search ||
        instance.hash
      )
        throw new Error();
      url = new URL("/services/oauth2/revoke", instance.origin);
    } catch {
      throw new BadRequestException("Salesforce instance binding is invalid");
    }
    const response = await safeConnectorFetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new BadRequestException("Salesforce token revocation failed");
  },

  async revokeHubSpotSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const refreshToken = this.stringOrNull(stored.refreshToken);
    const clientId = this.configService
      .get<string>("HUBSPOT_CLIENT_ID")
      ?.trim();
    const clientSecret = this.configService
      .get<string>("HUBSPOT_CLIENT_SECRET")
      ?.trim();
    if (!refreshToken || !clientId || !clientSecret)
      throw new BadRequestException(
        "HubSpot revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch(
      "https://api.hubapi.com/oauth/2026-03/token/revoke",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          token: refreshToken,
          token_type_hint: "refresh_token",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new BadRequestException("HubSpot token revocation failed");
  },

  async revokeClioManageSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    if (!accessToken)
      throw new BadRequestException(
        "Clio Manage deauthorization token is missing",
      );
    const response = await safeConnectorFetch("https://app.clio.com/oauth/deauthorize", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token: accessToken }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new BadRequestException(
        "Clio Manage upstream deauthorization failed",
      );
  },

  async revokeClioGrowSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    const clientId = this.configService
      .get<string>("CLIO_GROW_CLIENT_ID")
      ?.trim();
    const clientSecret = this.configService
      .get<string>("CLIO_GROW_CLIENT_SECRET")
      ?.trim();
    if (!accessToken || !clientId || !clientSecret)
      throw new BadRequestException(
        "Clio Grow revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://auth.api.clio.com/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token: accessToken }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new BadRequestException(
        "Clio Grow upstream token revocation failed",
      );
  },

  async revokeSmartsheetSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    const apiOrigin = this.stringOrNull(
      connection.metadata?.smartsheetApiOrigin,
    );
    if (!accessToken || apiOrigin !== "https://api.smartsheet.com/2.0")
      throw new BadRequestException(
        "Smartsheet revocation binding is incomplete",
      );
    const response = await safeConnectorFetch(`${apiOrigin}/token`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "smartsheet-integration-source": "AI,Relay Console,Marketplace",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (![200, 204, 401, 404].includes(response.status))
      throw new BadRequestException("Smartsheet token revocation failed");
  },

  async revokeTodoistSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    const clientId = this.configService
      .get<string>("TODOIST_CLIENT_ID")
      ?.trim();
    const clientSecret = this.configService
      .get<string>("TODOIST_CLIENT_SECRET")
      ?.trim();
    if (!accessToken || !clientId || !clientSecret)
      throw new BadRequestException(
        "Todoist revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://api.todoist.com/api/v1/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token: accessToken,
        token_type_hint: "access_token",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (![200, 204].includes(response.status))
      throw new BadRequestException("Todoist token revocation failed");
  },

  async revokeDocusignSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId = this.configService
      .get<string>("DOCUSIGN_CLIENT_ID")
      ?.trim();
    const clientSecret = this.configService
      .get<string>("DOCUSIGN_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "Docusign revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://account.docusign.com/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (![200, 204].includes(response.status))
      throw new BadRequestException("Docusign token revocation failed");
  },

  async revokeCloseSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const refreshToken = this.stringOrNull(stored.refreshToken);
    const clientId = this.configService.get<string>("CLOSE_CLIENT_ID")?.trim();
    const clientSecret = this.configService
      .get<string>("CLOSE_CLIENT_SECRET")
      ?.trim();
    if (!refreshToken || !clientId || !clientSecret)
      throw new BadRequestException(
        "Close revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://api.close.com/oauth2/revoke/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: refreshToken,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new BadRequestException("Close token revocation failed");
  },

  async revokeZendeskSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    if (!accessToken) return;
    const authority = this.connectionAuthority("zendesk", connection);
    const response = await safeConnectorFetch(
      `${new URL(authority.tokenUrl).origin}/api/v2/oauth/tokens/current.json`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!response.ok && response.status !== 404)
      throw new BadRequestException("Zendesk token revocation failed");
  },

  async revokeIntercomSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    if (!accessToken) return;
    const region = this.stringOrNull(
      connection.metadata?.intercomRegion,
    )?.toUpperCase();
    const apiOrigin = this.stringOrNull(connection.metadata?.intercomApiOrigin);
    if (!region || apiOrigin !== this.intercomApiOrigin(region))
      throw new BadRequestException("Intercom revocation authority is invalid");
    const response = await safeConnectorFetch(`${apiOrigin}/auth/uninstall`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Intercom-Version": "2.15",
      },
      body: "{}",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (![200, 204, 401, 404].includes(response.status))
      throw new BadRequestException("Intercom token revocation failed");
  },

  async revokeSquareAppointmentsSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    const clientId =
      this.stringOrNull(stored.clientId) ??
      this.configService.get<string>("SQUARE_APPOINTMENTS_CLIENT_ID")?.trim();
    const clientSecret =
      this.stringOrNull(stored.clientSecret) ??
      this.configService
        .get<string>("SQUARE_APPOINTMENTS_CLIENT_SECRET")
        ?.trim();
    if (!accessToken || !clientId || !clientSecret) {
      throw new BadRequestException(
        "Square Appointments revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch("https://connect.squareup.com/oauth2/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Client ${clientSecret}`,
        "Content-Type": "application/json",
        "Square-Version": "2026-05-20",
      },
      body: JSON.stringify({
        access_token: accessToken,
        client_id: clientId,
        revoke_only_access_token: false,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException(
        "Square upstream authorization revocation failed",
      );
    }
  },

  async revokeJaneAppSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const refreshToken = this.stringOrNull(stored.refreshToken);
    const clientId =
      this.configService.get<string>("JANE_APP_CLIENT_ID")?.trim() ??
      this.stringOrNull(stored.clientId);
    const clientSecret = this.configService
      .get<string>("JANE_APP_CLIENT_SECRET")
      ?.trim();
    if (!refreshToken || !clientId || !clientSecret) {
      throw new BadRequestException(
        "Jane App revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch(
      "https://login.id.janeapp.com/realms/jane/protocol/openid-connect/revoke",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: refreshToken,
          token_type_hint: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      throw new BadRequestException("Jane App token revocation failed");
    }
  },

  async revokeAdobeAcrobatSignSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!token)
      throw new BadRequestException(
        "Adobe Acrobat Sign revocation token is missing",
      );
    const authority = this.adobeAcrobatSignAuthority(
      this.stringOrNull(connection.metadata?.adobeAcrobatSignApiOrigin) ?? "",
    );
    const response = await safeConnectorFetch(`${authority.apiOrigin}/oauth/v2/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException(
        "Adobe Acrobat Sign upstream token revocation failed",
      );
  },

  async revokeSignRequestSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!token)
      throw new BadRequestException("SignRequest revocation token is missing");
    const response = await safeConnectorFetch(
      "https://signrequest.com/api/v1/oauth2/revoke_token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token,
          token_type_hint: this.stringOrNull(stored.refreshToken)
            ? "refresh_token"
            : "access_token",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok)
      throw new BadRequestException(
        "SignRequest upstream token revocation failed",
      );
  },

  async revokeSigneasySession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.refreshToken);
    const clientId = this.configService
      .get<string>("SIGNEASY_CLIENT_ID")
      ?.trim();
    const clientSecret = this.configService
      .get<string>("SIGNEASY_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "Signeasy revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://auth.signeasy.com/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        token,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException(
        "Signeasy upstream refresh-token revocation failed",
      );
  },

  async revokeRightSignatureSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.accessToken);
    const clientId = this.configService
      .get<string>("RIGHTSIGNATURE_CLIENT_ID")
      ?.trim();
    const clientSecret = this.configService
      .get<string>("RIGHTSIGNATURE_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "RightSignature revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch(
      "https://api.rightsignature.com/oauth/revoke",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({ token }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok)
      throw new BadRequestException(
        "RightSignature upstream access-token revocation failed",
      );
  },

  async revokeRingCentralSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.stringOrNull(stored.clientSecret);
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!clientId || !clientSecret || !token) {
      throw new BadRequestException(
        "RingCentral session revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch(
      "https://platform.ringcentral.com/restapi/oauth/revoke",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({ token }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok)
      throw new BadRequestException("RingCentral session revocation failed");
  },

  async revokeRestreamSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const refreshToken = this.stringOrNull(stored.refreshToken);
    const accessToken = this.stringOrNull(stored.accessToken);
    const token = refreshToken ?? accessToken;
    if (!token) {
      throw new BadRequestException("Restream revocation token is missing");
    }
    const response = await safeConnectorFetch("https://api.restream.io/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token,
        token_type_hint: refreshToken ? "refresh_token" : "access_token",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status !== 200) {
      throw new BadRequestException("Restream token revocation failed");
    }
  },

  async deauthorizeDialpad(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.accessToken);
    if (!token)
      throw new BadRequestException("Dialpad deauthorization token is missing");
    const response = await safeConnectorFetch("https://dialpad.com/oauth2/deauthorize", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: "",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException("Dialpad deauthorization failed");
  },

  async disableAircallIntegration(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.accessToken);
    if (!token)
      throw new BadRequestException(
        "Aircall integration-disable token is missing",
      );
    const response = await safeConnectorFetch(
      "https://api.aircall.io/v1/integrations/disable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: "",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok)
      throw new BadRequestException("Aircall integration disable failed");
  },

  async revokeLineSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.stringOrNull(stored.clientSecret);
    if (!accessToken || !clientId || !clientSecret)
      throw new BadRequestException(
        "LINE revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://api.line.me/oauth2/v2.1/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        access_token: accessToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException("LINE upstream token revocation failed");
  },

  async revokeSlackSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.accessToken);
    if (!token)
      throw new BadRequestException("Slack revocation token is missing");
    const response = await safeConnectorFetch("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok || body.ok !== true) {
      throw new BadRequestException("Slack upstream token revocation failed");
    }
  },

  async revokeGitHubSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.stringOrNull(stored.clientSecret);
    if (!accessToken || !clientId || !clientSecret) {
      throw new BadRequestException(
        "GitHub token revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch(
      `https://api.github.com/applications/${encodeURIComponent(clientId)}/token`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "RelayConsole",
        },
        body: JSON.stringify({ access_token: accessToken }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      throw new BadRequestException("GitHub upstream token revocation failed");
    }
  },

  async revokeGitLabSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.stringOrNull(stored.clientSecret);
    if (!token || !clientId || !clientSecret) {
      throw new BadRequestException(
        "GitLab token revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch("https://gitlab.com/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException("GitLab upstream token revocation failed");
  },

  async revokeLinearSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.accessToken);
    if (!token) {
      throw new BadRequestException("Linear revocation token is missing");
    }
    const response = await safeConnectorFetch("https://api.linear.app/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token }).toString(),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException("Linear upstream token revocation failed");
    }
  },

  async revokeMondaySession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.stringOrNull(stored.clientSecret);
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "Monday.com token revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch(
      "https://auth.monday.com/oauth_ms/oauth/revoke",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          client_id: clientId,
          client_secret: clientSecret,
          token_type_hint: stored.refreshToken
            ? "refresh_token"
            : "access_token",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok)
      throw new BadRequestException(
        "Monday.com upstream token revocation failed",
      );
  },

  async revokeAsanaSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token = this.stringOrNull(stored.refreshToken);
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.stringOrNull(stored.clientSecret);
    if (!token || !clientId || !clientSecret) {
      throw new BadRequestException(
        "Asana token revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch("https://app.asana.com/-/oauth_revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token,
      }).toString(),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException("Asana upstream token revocation failed");
    }
  },

  async revokeZohoCrmSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!token) {
      throw new BadRequestException("Zoho CRM revocation token is missing");
    }
    const accountsOrigin =
      this.stringOrNull(connection.metadata?.zohoAccountsOrigin) ?? "";
    const authority =
      connection.appSlug === "zoho-desk"
        ? this.zohoDeskAuthority(accountsOrigin)
        : this.zohoCrmAuthority(accountsOrigin);
    const revokeUrl = new URL(
      `${authority.accountsOrigin}/oauth/v2/token/revoke`,
    );
    revokeUrl.searchParams.set("token", token);
    const response = await safeConnectorFetch(revokeUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException(
        "Zoho CRM upstream token revocation failed",
      );
    }
  },

  async revokeZohoPeopleSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!token) {
      throw new BadRequestException("Zoho People revocation token is missing");
    }
    const authority = this.zohoPeopleAuthority(
      this.stringOrNull(connection.metadata?.zohoAccountsOrigin) ?? "",
    );
    const revokeUrl = new URL(
      `${authority.accountsOrigin}/oauth/v2/token/revoke`,
    );
    revokeUrl.searchParams.set("token", token);
    const response = await safeConnectorFetch(revokeUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException(
        "Zoho People upstream token revocation failed",
      );
    }
  },

  async revokeZohoCampaignsSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!token) {
      throw new BadRequestException(
        "Zoho Campaigns revocation token is missing",
      );
    }
    const authority = this.zohoCampaignsAuthority(
      this.stringOrNull(connection.metadata?.zohoAccountsOrigin) ?? "",
    );
    const revokeUrl = new URL(
      `${authority.accountsOrigin}/oauth/v2/token/revoke`,
    );
    revokeUrl.searchParams.set("token", token);
    const response = await safeConnectorFetch(revokeUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException(
        "Zoho Campaigns upstream token revocation failed",
      );
    }
  },

  async revokeZohoAnalyticsSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!token) {
      throw new BadRequestException(
        "Zoho Analytics revocation token is missing",
      );
    }
    const authority = this.zohoAnalyticsAuthority(
      this.stringOrNull(connection.metadata?.zohoAccountsOrigin) ?? "",
    );
    const revokeUrl = new URL(
      `${authority.accountsOrigin}/oauth/v2/token/revoke`,
    );
    revokeUrl.searchParams.set("token", token);
    const response = await safeConnectorFetch(revokeUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException(
        "Zoho Analytics upstream token revocation failed",
      );
    }
  },

  async revokeZohoMailSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!token) {
      throw new BadRequestException("Zoho Mail revocation token is missing");
    }
    const authority = this.zohoMailAuthority(
      this.stringOrNull(connection.metadata?.zohoAccountsOrigin) ?? "",
    );
    const revokeUrl = new URL(
      `${authority.accountsOrigin}/oauth/v2/token/revoke`,
    );
    revokeUrl.searchParams.set("token", token);
    const response = await safeConnectorFetch(revokeUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException(
        "Zoho Mail upstream token revocation failed",
      );
    }
  },

  async revokeZohoWorkDriveSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
    connection: MarketplaceConnectionEntity,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    if (!token) {
      throw new BadRequestException(
        "Zoho WorkDrive revocation token is missing",
      );
    }
    const authority = this.zohoWorkDriveAuthority(
      this.stringOrNull(connection.metadata?.zohoAccountsOrigin) ?? "",
    );
    const revokeUrl = new URL(
      `${authority.accountsOrigin}/oauth/v2/token/revoke`,
    );
    revokeUrl.searchParams.set("token", token);
    const response = await safeConnectorFetch(revokeUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException(
        "Zoho WorkDrive upstream token revocation failed",
      );
    }
  },

  async revokeQuipSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId = this.stringOrNull(stored.clientId);
    const clientSecret = this.stringOrNull(stored.clientSecret);
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "Quip revocation credentials are incomplete",
      );
    const response = await safeConnectorFetch("https://platform.quip.com/1/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException("Quip upstream token revocation failed");
  },

  async revokeProductboardSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.configService.get<string>("PRODUCTBOARD_CLIENT_ID")?.trim() ??
      this.stringOrNull(stored.clientId);
    const clientSecret =
      this.configService.get<string>("PRODUCTBOARD_CLIENT_SECRET")?.trim() ??
      this.stringOrNull(stored.clientSecret);
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "Productboard revocation credentials are incomplete",
      );
    const url = new URL("https://app.productboard.com/oauth2/revoke");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("token", token);
    const response = await safeConnectorFetch(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException(
        "Productboard upstream token revocation failed",
      );
  },

  async revokeBoxSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const token =
      this.stringOrNull(stored.refreshToken) ??
      this.stringOrNull(stored.accessToken);
    const clientId =
      this.configService.get<string>("BOX_CLIENT_ID")?.trim() ??
      this.stringOrNull(stored.clientId);
    const clientSecret = this.configService
      .get<string>("BOX_CLIENT_SECRET")
      ?.trim();
    if (!token || !clientId || !clientSecret)
      throw new BadRequestException(
        "Box revocation credentials are incomplete",
      );
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token,
    });
    const response = await safeConnectorFetch("https://api.box.com/oauth2/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new BadRequestException("Box upstream token revocation failed");
  },

  async revokeMiroSession(
    this: MarketplaceConnectorOAuthService,
    stored: Record<string, unknown>,
  ) {
    const accessToken = this.stringOrNull(stored.accessToken);
    const clientId =
      this.configService.get<string>("MIRO_CLIENT_ID")?.trim() ??
      this.stringOrNull(stored.clientId);
    const clientSecret = this.configService
      .get<string>("MIRO_CLIENT_SECRET")
      ?.trim();
    if (!accessToken || !clientId || !clientSecret) {
      throw new BadRequestException(
        "Miro revocation credentials are incomplete",
      );
    }
    const response = await safeConnectorFetch("https://api.miro.com/v2/oauth/revoke", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accessToken, clientId, clientSecret }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new BadRequestException("Miro upstream token revocation failed");
    }
  },
};
