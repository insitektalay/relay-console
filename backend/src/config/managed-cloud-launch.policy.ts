import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const MANAGED_CLOUD_LAUNCH_FLAG = "RELAY_MANAGED_CLOUD_ENABLED";
export const MANAGED_CLOUD_DISABLED_CODE = "RELAY_MANAGED_CLOUD_NOT_ENABLED";

export function isManagedCloudLaunchEnabledValue(
  value: string | undefined | null,
) {
  return value?.trim() === "true";
}

export function isManagedCloudLaunchEnabled(config: ConfigService | undefined) {
  return isManagedCloudLaunchEnabledValue(
    config?.get<string>(MANAGED_CLOUD_LAUNCH_FLAG),
  );
}

export function assertManagedCloudLaunchEnabled(
  config: ConfigService | undefined,
) {
  if (!isManagedCloudLaunchEnabled(config)) {
    throw new ServiceUnavailableException(MANAGED_CLOUD_DISABLED_CODE);
  }
}
