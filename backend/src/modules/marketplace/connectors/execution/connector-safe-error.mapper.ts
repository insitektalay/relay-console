import { mapKnownConnectorErrorChunk1 } from "./error-mappers/connector-safe-error.mapper-1";
import { mapKnownConnectorErrorChunk2 } from "./error-mappers/connector-safe-error.mapper-2";
import { mapKnownConnectorErrorChunk3 } from "./error-mappers/connector-safe-error.mapper-3";
import { mapKnownConnectorErrorChunk4 } from "./error-mappers/connector-safe-error.mapper-4";
import type { MarketplaceConnectorExecutorResult } from "../types";

const MAPPERS = [
  mapKnownConnectorErrorChunk1,
  mapKnownConnectorErrorChunk2,
  mapKnownConnectorErrorChunk3,
  mapKnownConnectorErrorChunk4,
] as const;

export function mapKnownConnectorError(
  error: unknown,
): MarketplaceConnectorExecutorResult | null {
  for (const mapper of MAPPERS) {
    const result = mapper(error);
    if (result) return result;
  }
  return null;
}
