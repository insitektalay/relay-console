import { NestFactory } from "@nestjs/core";
import { readFile } from "fs/promises";
import { AppModule } from "../app.module";
import {
  RelayRemediationManifest,
  RelayRemediationService,
} from "../modules/runtime/relay-remediation.service";

async function main() {
  const [command, workspaceId, operationKey, filePath] = process.argv.slice(2);
  if (!command || !workspaceId || !operationKey) {
    throw new Error(
      "Usage: relay-remediation <inventory|dry-run|apply|status> <workspace-id> <operation-key> [request.json]",
    );
  }
  const request = filePath
    ? (JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>)
    : {};
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const service = app.get(RelayRemediationService);
    let result: unknown;
    if (command === "inventory") {
      result = await service.inventory({
        workspaceId,
        operationKey,
        backupReference: request.backupReference as string | undefined,
        swiftInventory:
          request.swiftInventory as RelayRemediationManifest["swiftInventory"],
      });
    } else if (command === "dry-run") {
      result = await service.dryRun({
        workspaceId,
        operationKey,
        manifest: request.manifest as RelayRemediationManifest,
        expectedInventoryChecksum: String(
          request.expectedInventoryChecksum ?? "",
        ),
        expectedCounts: (request.expectedCounts ?? {}) as Record<
          string,
          number
        >,
      });
    } else if (command === "apply") {
      if (process.env.RELAY_REMEDIATION_APPLY !== "CONFIRMED") {
        throw new Error("Set RELAY_REMEDIATION_APPLY=CONFIRMED for apply");
      }
      result = await service.apply({
        workspaceId,
        operationKey,
        expectedInventoryChecksum: String(
          request.expectedInventoryChecksum ?? "",
        ),
        expectedDryRunChecksum: String(request.expectedDryRunChecksum ?? ""),
        backupReference: String(request.backupReference ?? ""),
      });
    } else if (command === "status") {
      result = await service.get(workspaceId, operationKey);
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
