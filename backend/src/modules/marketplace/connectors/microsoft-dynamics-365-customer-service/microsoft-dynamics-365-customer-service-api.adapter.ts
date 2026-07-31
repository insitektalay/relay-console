import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  MicrosoftDynamics365SalesApiAdapter,
  MicrosoftDynamics365SalesApiError,
} from "../microsoft-dynamics-365-sales/microsoft-dynamics-365-sales-api.adapter";

export const MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_OPERATIONS = [
  "identity.get",
] as const;

export class MicrosoftDynamics365CustomerServiceApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class MicrosoftDynamics365CustomerServiceApiAdapter {
  private readonly dataverse = new MicrosoftDynamics365SalesApiAdapter();

  health(accessToken: string, environmentOrigin: string) {
    return this.read(accessToken, environmentOrigin, "identity.get");
  }

  async read(
    accessToken: string,
    environmentOrigin: string,
    operation: string,
  ) {
    if (
      !MICROSOFT_DYNAMICS_365_CUSTOMER_SERVICE_OPERATIONS.includes(
        operation as never,
      )
    )
      throw new MicrosoftDynamics365CustomerServiceApiError(
        "policy_blocked",
        "Microsoft Dynamics 365 Customer Service operation is outside Relay's pinned connection-summary contract.",
        403,
      );
    try {
      return await this.dataverse.read(
        accessToken,
        environmentOrigin,
        "identity.get",
      );
    } catch (error) {
      if (error instanceof MicrosoftDynamics365SalesApiError)
        throw new MicrosoftDynamics365CustomerServiceApiError(
          error.code,
          error.message.replaceAll(
            "Microsoft Dynamics 365 Sales",
            "Microsoft Dynamics 365 Customer Service",
          ),
          error.statusCode,
        );
      throw error;
    }
  }

  normalizeEnvironment(value: string) {
    try {
      return this.dataverse.normalizeEnvironment(value);
    } catch (error) {
      if (error instanceof MicrosoftDynamics365SalesApiError)
        throw new MicrosoftDynamics365CustomerServiceApiError(
          error.code,
          error.message.replaceAll(
            "Dynamics 365 Sales",
            "Dynamics 365 Customer Service",
          ),
          error.statusCode,
        );
      throw error;
    }
  }
}
