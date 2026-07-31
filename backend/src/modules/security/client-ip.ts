import { isIP } from "net";

type HeaderValue = string | string[] | undefined;

type ClientIpRequest = {
  headers?: Record<string, HeaderValue>;
  ip?: string | null;
  socket?: {
    remoteAddress?: string | null;
  };
};

function singleHeaderValue(value: HeaderValue) {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = raw?.trim();

  if (!normalized || normalized.includes(",")) {
    return undefined;
  }

  return normalized;
}

function normalizedIp(value?: string | null) {
  const normalized = value?.trim();
  return normalized && isIP(normalized) ? normalized : undefined;
}

function isTrustedProxyPeer(value?: string | null) {
  const normalized = normalizedIp(value);
  if (!normalized) return false;
  const ip = normalized.toLowerCase().replace(/^::ffff:/, "");
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("fe80:")) return true;
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
    return false;
  }
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
  );
}

export function getTrustedClientIp(req: ClientIpRequest) {
  const headers = req.headers ?? {};
  const directPeer =
    normalizedIp(req.socket?.remoteAddress) ?? normalizedIp(req.ip) ?? null;
  const railwayClientIp = isTrustedProxyPeer(directPeer)
    ? normalizedIp(singleHeaderValue(headers["x-real-ip"]))
    : undefined;

  return railwayClientIp ?? directPeer;
}

export function getRateLimitTracker(req: ClientIpRequest) {
  return getTrustedClientIp(req) ?? "unknown";
}
