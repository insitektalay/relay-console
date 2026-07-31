import { readFileSync } from "node:fs";
import { join } from "node:path";

const sourceRoot = join(__dirname, "..", "..");

function source(relativePath: string) {
  return readFileSync(join(sourceRoot, relativePath), "utf8");
}

describe("H-02 tenant mutation boundary", () => {
  it("rejects unknown DTO fields globally", () => {
    const main = source("main.ts");
    expect(main).toMatch(/forbidNonWhitelisted:\s*true/);
    expect(main).not.toMatch(/forbidNonWhitelisted:\s*false/);
  });

  it.each([
    "modules/incident/incident.controller.ts",
    "modules/worklogs/worklogs.controller.ts",
    "modules/performance/performance.controller.ts",
    "modules/permissions/permissions.controller.ts",
    "modules/team/team.controller.ts",
  ])("%s has no any-typed body or query boundary", (relativePath) => {
    const controller = source(relativePath);
    expect(controller).not.toMatch(/@(Body|Query)\([^)]*\)[^,\n]*:\s*any\b/);
  });

  it.each([
    "modules/incident/incident.service.ts",
    "modules/worklogs/worklogs.service.ts",
    "modules/performance/performance.service.ts",
    "modules/permissions/permissions.service.ts",
    "modules/team/team.service.ts",
  ])("%s does not spread request data into persistence", (relativePath) => {
    const service = source(relativePath);
    expect(service).not.toMatch(
      /\.(create|update|save|insert)\(\s*\{\s*\.\.\.(dto|data|body)\b/,
    );
    expect(service).not.toMatch(/Object\.assign\([^,]+,\s*(dto|data|body)\b/);
  });
});
