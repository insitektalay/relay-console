import { readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";

const sourceRoot = resolve(__dirname, "../..");

function walk(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = resolve(root, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const productionTypescript = walk(sourceRoot).filter(
  (file) => extname(file) === ".ts" && !file.endsWith(".spec.ts"),
);

describe("account-password bcrypt source boundary", () => {
  it("keeps every raw bcrypt call inside the reviewed password/token authorities", () => {
    const filesWithRawBcrypt = productionTypescript
      .filter((file) => /bcrypt\.(?:hash|compare)\(/.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(`${sourceRoot}/`, ""))
      .sort();

    expect(filesWithRawBcrypt).toEqual([
      "modules/auth/auth.service.ts",
      "modules/auth/password-policy.ts",
    ]);

    const authSource = readFileSync(
      resolve(sourceRoot, "modules/auth/auth.service.ts"),
      "utf8",
    );
    // Two rotating session-token comparisons plus one token-hash operation.
    // The fourth historical call was the retired sid-less user.refreshToken
    // compatibility path and must not return.
    expect(authSource.match(/bcrypt\.(?:hash|compare)\(/g)).toHaveLength(3);
    expect(authSource).not.toMatch(
      /bcrypt\.(?:hash|compare)\((?:dto\.password|newPassword|currentPassword|password)\b/,
    );
    expect(authSource).toMatch(/bcrypt\.compare\(\s*refreshToken/);
    expect(authSource).toMatch(/bcrypt\.hash\(token, 10\)/);
  });

  it("routes every production account-password sink through the shared wrappers", () => {
    const combined = productionTypescript
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(combined.match(/\bhashAccountPassword\(/g)).toHaveLength(7);
    expect(combined.match(/\bcompareAccountPassword\(/g)).toHaveLength(7);
  });

  it("keeps every account-password DTO on the UTF-8 byte decorator", () => {
    const dtoFiles = [
      "modules/auth/dto/register.dto.ts",
      "modules/auth/dto/login.dto.ts",
      "modules/auth/dto/account-lifecycle.dto.ts",
      "modules/auth/dto/change-password.dto.ts",
      "modules/auth/dto/delete-account.dto.ts",
      "modules/auth/dto/email-change.dto.ts",
      "modules/cloud-commercial/cloud-commercial.controller.ts",
    ];
    const decorators = dtoFiles.flatMap((file) =>
      Array.from(
        readFileSync(resolve(sourceRoot, file), "utf8").matchAll(
          /@IsBcryptCompatiblePassword\(\)/g,
        ),
      ),
    );

    expect(decorators).toHaveLength(8);
  });

  it("fails demo seeding before hashing an over-limit configured password", () => {
    const source = readFileSync(
      resolve(sourceRoot, "seeds/seed.ts"),
      "utf8",
    );
    const guard = source.indexOf("isBcryptCompatiblePassword(seedPassword)");
    const hash = source.indexOf("hashAccountPassword(seedPassword");

    expect(guard).toBeGreaterThanOrEqual(0);
    expect(hash).toBeGreaterThan(guard);
  });
});
