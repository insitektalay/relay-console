import { ConfigService } from "@nestjs/config";
import {
  assertManagedCloudLaunchEnabled,
  isManagedCloudLaunchEnabled,
  isManagedCloudLaunchEnabledValue,
} from "./managed-cloud-launch.policy";

describe("managed Cloud launch policy", () => {
  it.each([
    [undefined, false],
    [null, false],
    ["", false],
    ["false", false],
    ["1", false],
    ["TRUE", false],
    [" true ", true],
    ["true", true],
  ])("treats %p as enabled=%p", (value, enabled) => {
    expect(isManagedCloudLaunchEnabledValue(value)).toBe(enabled);
  });

  it("fails closed when configuration is unavailable or the flag is absent", () => {
    expect(() => assertManagedCloudLaunchEnabled(undefined)).toThrow(
      "RELAY_MANAGED_CLOUD_NOT_ENABLED",
    );
    const config = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;
    expect(isManagedCloudLaunchEnabled(config)).toBe(false);
    expect(() => assertManagedCloudLaunchEnabled(config)).toThrow(
      "RELAY_MANAGED_CLOUD_NOT_ENABLED",
    );
  });
});
