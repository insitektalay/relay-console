import type { MarketplaceConnectorSafeErrorCode } from "../types";

export class ConnectorExecutionError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
