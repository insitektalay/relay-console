import { BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import {
  BCRYPT_PASSWORD_MAX_BYTES,
  PASSWORD_UTF8_BYTE_LENGTH_INVALID,
  assertBcryptCompatiblePassword,
  isBcryptCompatiblePassword,
  passwordUtf8ByteLength,
} from "./password-policy";

describe("bcrypt account-password byte policy", () => {
  it("accepts exactly 72 ASCII bytes and rejects byte 73", () => {
    const boundary = "a".repeat(BCRYPT_PASSWORD_MAX_BYTES);

    expect(passwordUtf8ByteLength(boundary)).toBe(72);
    expect(isBcryptCompatiblePassword(boundary)).toBe(true);
    expect(isBcryptCompatiblePassword(`${boundary}b`)).toBe(false);
  });

  it("measures three-byte and four-byte Unicode by UTF-8 bytes", () => {
    const threeByteBoundary = "€".repeat(24);
    const fourByteBoundary = "😀".repeat(18);

    expect(passwordUtf8ByteLength(threeByteBoundary)).toBe(72);
    expect(passwordUtf8ByteLength(fourByteBoundary)).toBe(72);
    expect(isBcryptCompatiblePassword(threeByteBoundary)).toBe(true);
    expect(isBcryptCompatiblePassword(fourByteBoundary)).toBe(true);
    expect(isBcryptCompatiblePassword(`${threeByteBoundary}a`)).toBe(false);
    expect(isBcryptCompatiblePassword(`${fourByteBoundary}a`)).toBe(false);
  });

  it("closes bcrypt's shared-prefix collision at the policy boundary", async () => {
    const sharedPrefix = "p".repeat(72);
    const first = `${sharedPrefix}A`;
    const second = `${sharedPrefix}B`;
    const hash = await bcrypt.hash(first, 4);

    expect(await bcrypt.compare(second, hash)).toBe(true);
    expect(isBcryptCompatiblePassword(first)).toBe(false);
    expect(isBcryptCompatiblePassword(second)).toBe(false);
  });

  it("throws one stable validation code for invalid types and over-limit values", () => {
    for (const value of [null, 42, "x".repeat(73)]) {
      expect(() => assertBcryptCompatiblePassword(value)).toThrow(
        new BadRequestException(PASSWORD_UTF8_BYTE_LENGTH_INVALID),
      );
    }
  });
});
