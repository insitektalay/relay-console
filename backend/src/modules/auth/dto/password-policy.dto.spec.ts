import { plainToInstance } from "class-transformer";
import type { ClassConstructor } from "class-transformer";
import { validate } from "class-validator";
import { OwnerBootstrapDto } from "../../cloud-commercial/cloud-commercial.controller";
import { CompletePasswordResetDto } from "./account-lifecycle.dto";
import { ChangePasswordDto } from "./change-password.dto";
import { DeleteAccountDto } from "./delete-account.dto";
import { RequestEmailChangeDto } from "./email-change.dto";
import { LoginDto } from "./login.dto";
import { RegisterDto } from "./register.dto";

const strictValidate = (instance: object) =>
  validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const boundaryPassword = "€".repeat(24);
const overLimitPassword = `${boundaryPassword}a`;

const dtoCases: Array<{
  name: string;
  type: ClassConstructor<object>;
  valid: Record<string, unknown>;
  field: string;
}> = [
  {
    name: "registration",
    type: RegisterDto,
    valid: {
      email: "person@example.test",
      name: "Person",
      password: boundaryPassword,
    },
    field: "password",
  },
  {
    name: "login",
    type: LoginDto,
    valid: {
      email: "person@example.test",
      password: boundaryPassword,
    },
    field: "password",
  },
  {
    name: "password reset",
    type: CompletePasswordResetDto,
    valid: {
      token: "t".repeat(32),
      newPassword: boundaryPassword,
    },
    field: "newPassword",
  },
  {
    name: "password change current credential",
    type: ChangePasswordDto,
    valid: {
      currentPassword: boundaryPassword,
      newPassword: "ReplacementPassword2026!",
    },
    field: "currentPassword",
  },
  {
    name: "password change replacement credential",
    type: ChangePasswordDto,
    valid: {
      currentPassword: "CurrentPassword2026!",
      newPassword: boundaryPassword,
    },
    field: "newPassword",
  },
  {
    name: "account deletion",
    type: DeleteAccountDto,
    valid: {
      currentPassword: boundaryPassword,
      confirmation: "DELETE",
    },
    field: "currentPassword",
  },
  {
    name: "email change reauthentication",
    type: RequestEmailChangeDto,
    valid: {
      newEmail: "new@example.test",
      currentPassword: boundaryPassword,
    },
    field: "currentPassword",
  },
  {
    name: "owner bootstrap",
    type: OwnerBootstrapDto,
    valid: {
      token: "t".repeat(32),
      email: "owner@example.test",
      name: "Owner",
      password: boundaryPassword,
    },
    field: "password",
  },
];

describe.each(dtoCases)("$name password DTO", ({ type, valid, field }) => {
  it("accepts exactly 72 UTF-8 bytes", async () => {
    await expect(
      strictValidate(plainToInstance(type, valid)),
    ).resolves.toEqual([]);
  });

  it("rejects a multibyte password over 72 UTF-8 bytes", async () => {
    const errors = await strictValidate(
      plainToInstance(type, {
        ...valid,
        [field]: overLimitPassword,
      }),
    );

    expect(JSON.stringify(errors)).toContain(field);
    expect(JSON.stringify(errors)).toContain("72 UTF-8 bytes");
  });
});
