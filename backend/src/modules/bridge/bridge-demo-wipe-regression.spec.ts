import { readFileSync } from "fs";
import { resolve } from "path";

const repoRoot = resolve(__dirname, "../../../..");
const forbiddenRoute = ["wipe", "demo", "data"].join("-");
const forbiddenOperation = ["BridgeController", "wipeDemoData"].join("_");
const forbiddenMethod = ["wipe", "Demo", "Data"].join("");

function read(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("bridge demo wipe regression guard", () => {
  it("keeps the global agent deletion endpoint out of backend and API contracts", () => {
    const targets = [
      "backend/src/modules/bridge/bridge.controller.ts",
      "backend/src/modules/bridge/bridge.service.ts",
      "packages/contracts/openapi.snapshot.json",
      "packages/contracts/src/generated.ts",
    ];

    const matches = targets.flatMap((target) => {
      const content = read(target);
      return [
        [forbiddenRoute, "route"],
        [forbiddenOperation, "operation"],
        [forbiddenMethod, "method"],
        ["DELETE FROM agents", "global agent delete query"],
      ]
        .filter(([needle]) => content.includes(needle))
        .map(([, label]) => `${target}: ${label}`);
    });

    expect(matches).toEqual([]);
  });
});
