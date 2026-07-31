import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WebSocket } from "ws";
import { BillingObservabilityService } from "../cloud-commercial/billing-observability.service";
import { OperationsObservabilityService } from "../cloud-commercial/operations-observability.service";
import { HealthService } from "./health.service";

type CookieJar = Map<string, string>;

type SyntheticMonitorResult = {
  ok: boolean;
  status: "healthy" | "attention";
  checkedAt: string;
};

@Injectable()
export class SyntheticMonitorService {
  private cached:
    | { expiresAt: number; result: SyntheticMonitorResult }
    | undefined;
  private inFlight: Promise<SyntheticMonitorResult> | undefined;

  constructor(
    private readonly health: HealthService,
    private readonly billing: BillingObservabilityService,
    private readonly operations: OperationsObservabilityService,
    private readonly config: ConfigService,
  ) {}

  async check(): Promise<SyntheticMonitorResult> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) return this.cached.result;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.run().then((result) => {
      this.cached = { expiresAt: Date.now() + 4 * 60_000, result };
      return result;
    });
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = undefined;
    }
  }

  private async run(): Promise<SyntheticMonitorResult> {
    const checkedAt = new Date().toISOString();
    try {
      const webOrigin = this.httpsOrigin("CLAWCHAT_WEB_ORIGIN");
      const apiOrigin = this.httpsOrigin("CLAWCHAT_RAILWAY_ORIGIN");
      const websocketOrigin = this.wssOrigin("NEXT_PUBLIC_RAILWAY_WS_BASE_URL");
      const email = this.required("CLAWCHAT_BETA_SMOKE_EMAIL");
      const password = this.required("CLAWCHAT_BETA_SMOKE_PASSWORD");
      const workspaceId = this.required("CLAWCHAT_BETA_SMOKE_WORKSPACE_ID");
      const operatorSecret = this.required("RELAY_OPERATOR_API_SECRET");

      const [ready, billing, operations, web, webRewrite] = await Promise.all([
        this.health.ready(),
        this.billing.snapshot(),
        this.operations.snapshot(),
        this.fetchOk(new URL("/", webOrigin)),
        this.fetchJsonOk(new URL("/api/v1/health/ready", webOrigin), {
          "x-relay-operator-secret": operatorSecret,
        }),
      ]);
      const websocket = await this.authenticatedWebsocket(
        apiOrigin,
        webOrigin,
        websocketOrigin,
        email,
        password,
        workspaceId,
      );
      const ok =
        ready.ok === true &&
        billing.status === "healthy" &&
        Array.isArray(billing.alerts) &&
        billing.alerts.length === 0 &&
        operations.status === "healthy" &&
        Array.isArray(operations.alerts) &&
        operations.alerts.length === 0 &&
        web &&
        webRewrite &&
        websocket;
      return { ok, status: ok ? "healthy" : "attention", checkedAt };
    } catch {
      return { ok: false, status: "attention", checkedAt };
    }
  }

  private async authenticatedWebsocket(
    apiOrigin: string,
    webOrigin: string,
    websocketOrigin: string,
    email: string,
    password: string,
    workspaceId: string,
  ) {
    const cookies: CookieJar = new Map();
    const apiBase = new URL("/api/v1/", apiOrigin);
    const csrf = await this.fetchJsonWithCookies(
      new URL("auth/csrf", apiBase),
      { method: "GET", headers: { accept: "application/json" } },
      cookies,
    );
    const csrfToken =
      this.stringValue(csrf.body?.data?.csrfToken) ||
      this.stringValue(csrf.body?.csrfToken) ||
      cookies.get("clawchat_web_csrf") ||
      "";
    if (!csrf.ok || !csrfToken) return false;

    const login = await this.fetchJsonWithCookies(
      new URL("auth/web/login", apiBase),
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...this.cookieHeader(cookies),
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ email, password }),
      },
      cookies,
    );
    if (!login.ok) return false;

    const refreshedCsrf =
      this.stringValue(login.body?.data?.csrfToken) ||
      this.stringValue(login.body?.csrfToken) ||
      cookies.get("clawchat_web_csrf") ||
      "";
    const ticket = await this.fetchJsonWithCookies(
      new URL("auth/ws-ticket", apiBase),
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...this.cookieHeader(cookies),
          ...(refreshedCsrf ? { "x-csrf-token": refreshedCsrf } : {}),
        },
        body: JSON.stringify({ workspaceId }),
      },
      cookies,
    );
    const value =
      this.stringValue(ticket.body?.data?.ticket) ||
      this.stringValue(ticket.body?.ticket);
    return ticket.ok && value
      ? this.connectWebsocket(websocketOrigin, webOrigin, value)
      : false;
  }

  private async connectWebsocket(
    websocketOrigin: string,
    webOrigin: string,
    ticket: string,
  ) {
    const url = new URL(websocketOrigin);
    url.searchParams.set("ticket", ticket);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const socket = new WebSocket(url, { headers: { Origin: webOrigin } });
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          // A close race must not turn the bounded monitor into an exception.
        }
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 10_000);
      socket.on("message", (data) => {
        try {
          finish(JSON.parse(String(data))?.type === "authenticated");
        } catch {
          finish(false);
        }
      });
      socket.on("close", () => finish(false));
      socket.on("error", () => finish(false));
    });
  }

  private async fetchOk(url: URL) {
    const response = await this.fetchWithTimeout(url, {
      method: "GET",
      redirect: "manual",
    });
    await response.text();
    return response.ok;
  }

  private async fetchJsonOk(
    url: URL,
    headers: Record<string, string> = {},
  ) {
    const response = await this.fetchWithTimeout(url, {
      method: "GET",
      redirect: "manual",
      headers: { accept: "application/json", ...headers },
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: unknown;
      data?: { ok?: unknown };
    } | null;
    return response.ok && (body?.ok === true || body?.data?.ok === true);
  }

  private async fetchJsonWithCookies(
    url: URL,
    init: RequestInit,
    cookies: CookieJar,
  ) {
    const response = await this.fetchWithTimeout(url, {
      ...init,
      redirect: "manual",
    });
    this.storeCookies(response.headers, cookies);
    const body = (await response.json().catch(() => null)) as any;
    return { ok: response.ok, body };
  }

  private async fetchWithTimeout(url: URL, init: RequestInit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private storeCookies(headers: Headers, cookies: CookieJar) {
    const values =
      typeof (headers as any).getSetCookie === "function"
        ? (headers as any).getSetCookie()
        : this.splitSetCookie(headers.get("set-cookie"));
    for (const value of values as string[]) {
      const pair = value.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator > 0) {
        cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    }
  }

  private splitSetCookie(value: string | null) {
    if (!value) return [];
    return value.split(/,(?=[^;,]+=)/g);
  }

  private cookieHeader(cookies: CookieJar) {
    const value = [...cookies.entries()]
      .map(([name, cookie]) => `${name}=${cookie}`)
      .join("; ");
    return value ? { cookie: value } : {};
  }

  private required(key: string) {
    const value = this.config.get<string>(key)?.trim() || "";
    if (!value) throw new Error("synthetic_monitor_not_configured");
    return value;
  }

  private httpsOrigin(key: string) {
    return this.origin(key, "https:");
  }

  private wssOrigin(key: string) {
    return this.origin(key, "wss:");
  }

  private origin(key: string, protocol: "https:" | "wss:") {
    const url = new URL(this.required(key));
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== protocol ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".localhost")
    ) {
      throw new Error("synthetic_monitor_origin_invalid");
    }
    return url.origin;
  }

  private stringValue(value: unknown) {
    return typeof value === "string" ? value : "";
  }
}
