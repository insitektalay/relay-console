export const RELAY_MINIMUM_CLIENTS = Object.freeze({
  relayConsoleSwift: "0.1.0",
  ios: "1.0.0",
  web: "0.0.1",
});

const CLIENT_KIND_TO_MANIFEST_KEY = Object.freeze({
  relayConsoleSwift: "relayConsoleSwift",
  relay_console_swift: "relayConsoleSwift",
  ios: "ios",
  web: "web",
} as const);

export type RelayClientKind = keyof typeof CLIENT_KIND_TO_MANIFEST_KEY;

export type RelayClientVersionResult = {
  compatible: boolean;
  blockWrites: true | false;
  code:
    | "UNSUPPORTED_CLIENT_KIND"
    | "CLIENT_VERSION_INVALID"
    | "CLIENT_UPGRADE_REQUIRED"
    | null;
  minimumVersion?: string;
};

function parseNumericVersion(value: string): number[] | null {
  const normalized = value.trim().replace(/^v(?=\d)/i, "");
  if (!/^\d+(?:\.\d+){0,3}$/.test(normalized)) return null;
  return normalized.split(".").map((part) => Number(part));
}

export function minimumRelayClientVersion(clientKind: string): string | null {
  const key = CLIENT_KIND_TO_MANIFEST_KEY[clientKind as RelayClientKind];
  return key ? RELAY_MINIMUM_CLIENTS[key] : null;
}

export function evaluateRelayClientVersion(
  clientKind: string,
  version: string,
): RelayClientVersionResult {
  const minimumVersion = minimumRelayClientVersion(clientKind);
  if (!minimumVersion) {
    return {
      compatible: false,
      blockWrites: true,
      code: "UNSUPPORTED_CLIENT_KIND",
    };
  }
  const current = parseNumericVersion(version);
  const minimum = parseNumericVersion(minimumVersion);
  if (!current || !minimum) {
    return {
      compatible: false,
      blockWrites: true,
      code: "CLIENT_VERSION_INVALID",
      minimumVersion,
    };
  }
  for (
    let index = 0;
    index < Math.max(current.length, minimum.length);
    index += 1
  ) {
    const delta = (current[index] ?? 0) - (minimum[index] ?? 0);
    if (delta < 0) {
      return {
        compatible: false,
        blockWrites: true,
        code: "CLIENT_UPGRADE_REQUIRED",
        minimumVersion,
      };
    }
    if (delta > 0) break;
  }
  return {
    compatible: true,
    blockWrites: false,
    code: null,
    minimumVersion,
  };
}
