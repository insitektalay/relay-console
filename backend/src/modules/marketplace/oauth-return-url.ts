import type { ConfigService } from "@nestjs/config";

type ConfigReader = Pick<ConfigService, "get">;

const FRONTEND_ORIGIN_KEYS = [
  "CLAWCHAT_WEB_ORIGIN",
  "PUBLIC_WEB_ORIGIN",
  "FRONTEND_ORIGIN",
] as const;
const DEFAULT_FRONTEND_ORIGIN = "https://relayconsole.work";
const IOS_CALLBACK_SCHEME = "relayconsole:";
const IOS_CALLBACK_HOST = "marketplace";
const IOS_CALLBACK_PATH = "/oauth";
const IOS_RETURN_QUERY_KEYS = new Set(["workspace_id", "marketplace_app"]);

function configString(configService: ConfigReader, key: string) {
  const value = configService.get<string>(key);
  return typeof value === "string" ? value.trim() : "";
}

function originFromValue(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function configuredFrontendOrigins(configService: ConfigReader) {
  const values = FRONTEND_ORIGIN_KEYS.map((key) =>
    configString(configService, key),
  );
  values.push(...configString(configService, "CORS_ORIGINS").split(","));

  const origins = values
    .map((value) => originFromValue(value.trim().replace(/\/+$/, "")))
    .filter((origin): origin is string => Boolean(origin));

  return Array.from(new Set(origins));
}

export function getPrimaryOAuthFrontendOrigin(configService: ConfigReader) {
  return configuredFrontendOrigins(configService)[0] ?? DEFAULT_FRONTEND_ORIGIN;
}

export function getOAuthFrontendUrl(path: string, configService: ConfigReader) {
  return new URL(path, getPrimaryOAuthFrontendOrigin(configService)).toString();
}

export function normalizeOAuthReturnTo(
  value: string | null | undefined,
  configService: ConfigReader,
) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return null;

  if (trimmed.toLowerCase().startsWith(IOS_CALLBACK_SCHEME)) {
    try {
      const mobileUrl = new URL(trimmed);
      if (
        mobileUrl.hostname !== IOS_CALLBACK_HOST ||
        mobileUrl.pathname !== IOS_CALLBACK_PATH ||
        mobileUrl.username ||
        mobileUrl.password ||
        mobileUrl.port ||
        mobileUrl.hash
      ) {
        return null;
      }

      const queryItems = Array.from(mobileUrl.searchParams.entries());
      if (
        queryItems.length !== IOS_RETURN_QUERY_KEYS.size ||
        queryItems.some(([key]) => !IOS_RETURN_QUERY_KEYS.has(key)) ||
        new Set(queryItems.map(([key]) => key)).size !== queryItems.length
      ) {
        return null;
      }

      const workspaceId = mobileUrl.searchParams.get("workspace_id") ?? "";
      const appSlug = mobileUrl.searchParams.get("marketplace_app") ?? "";
      if (
        !/^[A-Za-z0-9_-]{1,128}$/.test(workspaceId) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(appSlug)
      ) {
        return null;
      }
      return mobileUrl.toString();
    } catch {
      return null;
    }
  }

  const allowedOrigins = new Set([
    ...configuredFrontendOrigins(configService),
    DEFAULT_FRONTEND_ORIGIN,
  ]);

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.includes("\\")) return null;
    const url = new URL(trimmed, getPrimaryOAuthFrontendOrigin(configService));
    return allowedOrigins.has(url.origin) ? url.toString() : null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!allowedOrigins.has(url.origin)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
