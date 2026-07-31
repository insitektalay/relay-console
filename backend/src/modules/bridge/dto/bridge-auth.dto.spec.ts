import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  BridgeDeviceCredentialDto,
  CreateBridgeEnrollmentDto,
  RedeemBridgeEnrollmentDto,
} from "./bridge-auth.dto";

describe("bridge authentication DTOs", () => {
  it("accepts only canonical bounded device credentials and metadata", async () => {
    const valid = plainToInstance(BridgeDeviceCredentialDto, {
      devicePublicId: "bdev_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      deviceToken: "A".repeat(43),
      runtimeType: "hermes",
      hostType: "macos-launchd",
      capabilities: ["clawchat.runtime.hermes"],
    });
    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(
      validate(
        plainToInstance(BridgeDeviceCredentialDto, {
          devicePublicId: "bdev_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          deviceToken: "A".repeat(43),
          runtimeType: "claude_code",
          hostType: "macos-launchd",
        }),
      ),
    ).resolves.toHaveLength(0);

    for (const input of [
      {
        devicePublicId: "../device",
        deviceToken: "A".repeat(43),
      },
      {
        devicePublicId: "bdev_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        deviceToken: "not-an-opaque-credential",
      },
      {
        devicePublicId: "bdev_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        deviceToken: "A".repeat(43),
        runtimeType: "arbitrary-runtime",
      },
      {
        devicePublicId: "bdev_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        deviceToken: "A".repeat(43),
        capabilities: Array.from({ length: 65 }, (_, index) => `cap-${index}`),
      },
    ]) {
      const errors = await validate(
        plainToInstance(BridgeDeviceCredentialDto, input),
      );
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it("bounds enrollment codes, labels, and expiry", async () => {
    await expect(
      validate(
        plainToInstance(RedeemBridgeEnrollmentDto, {
          code: "A1B2C3D4E5F6",
          deviceLabel: "Office runtime",
        }),
      ),
    ).resolves.toHaveLength(0);
    await expect(
      validate(
        plainToInstance(RedeemBridgeEnrollmentDto, {
          code: "PAIRME",
          deviceLabel: "x".repeat(129),
        }),
      ),
    ).resolves.not.toHaveLength(0);
    await expect(
      validate(
        plainToInstance(CreateBridgeEnrollmentDto, {
          expiresInMinutes: 31,
        }),
      ),
    ).resolves.not.toHaveLength(0);
  });
});
