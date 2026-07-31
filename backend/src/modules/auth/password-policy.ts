import { BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import {
  buildMessage,
  ValidateBy,
  type ValidationOptions,
} from "class-validator";

export const BCRYPT_PASSWORD_MAX_BYTES = 72;
export const PASSWORD_UTF8_BYTE_LENGTH_INVALID =
  "PASSWORD_UTF8_BYTE_LENGTH_INVALID";

export function passwordUtf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function isBcryptCompatiblePassword(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    passwordUtf8ByteLength(value) <= BCRYPT_PASSWORD_MAX_BYTES
  );
}

export function assertBcryptCompatiblePassword(
  value: unknown,
): asserts value is string {
  if (!isBcryptCompatiblePassword(value)) {
    throw new BadRequestException(PASSWORD_UTF8_BYTE_LENGTH_INVALID);
  }
}

export async function hashAccountPassword(
  value: string,
  rounds: number,
): Promise<string> {
  assertBcryptCompatiblePassword(value);
  return bcrypt.hash(value, rounds);
}

export async function compareAccountPassword(
  value: unknown,
  hash: string,
): Promise<boolean> {
  if (!isBcryptCompatiblePassword(value)) return false;
  return bcrypt.compare(value, hash);
}

export function IsBcryptCompatiblePassword(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: "isBcryptCompatiblePassword",
      validator: {
        validate: isBcryptCompatiblePassword,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be at most ${BCRYPT_PASSWORD_MAX_BYTES} UTF-8 bytes`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
