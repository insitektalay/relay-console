import { Logger } from "./logger";
import {
  RuntimeConfig,
  ensureRuntimeDirs,
  loadRuntimeConfig,
  saveRuntimeConfig,
} from "./config";
import { Journal } from "./journal";
import { RailwayClient } from "./railway-client";
import { verifyClaudeCliSupport } from "./claude-cli";
import { DispatchRunner } from "./dispatch-runner";
import { WsClient } from "./ws-client";
import { ControlRunner, controlCapabilities } from "./control-runner";
import { publishArtifactCatalogue } from "./artifact-catalogue";
import { DeviceCredentialStore } from "./credential-store";

const logger = new Logger("main");

async function enroll(code: string, deviceLabel: string) {
  const config = await loadRuntimeConfig();
  const railway = new RailwayClient(config.apiBaseUrl, config.workspaceId);
  const enrolled = await railway.enroll(code, deviceLabel);
  await new DeviceCredentialStore().save(
    enrolled.credentials.devicePublicId,
    enrolled.credentials.deviceToken,
  );
  const nextConfig: RuntimeConfig = {
    ...config,
    device: { devicePublicId: enrolled.credentials.devicePublicId },
  };
  await saveRuntimeConfig(nextConfig);
  logger.info("device enrolled successfully");
}

async function start() {
  const config = await loadRuntimeConfig();
  const version = verifyClaudeCliSupport(config);
  logger.info(`using ${version}`);

  const paths = await ensureRuntimeDirs();
  if (!config.device?.devicePublicId) {
    throw new Error(
      "config.json must contain an enrolled devicePublicId. Run enroll first.",
    );
  }

  const credentialStore = new DeviceCredentialStore();
  const deviceToken = await credentialStore.read(
    config.device.devicePublicId,
  );
  const railway = new RailwayClient(
    config.apiBaseUrl,
    config.workspaceId,
    {
      devicePublicId: config.device.devicePublicId,
      deviceToken,
    },
    (devicePublicId, nextDeviceToken) =>
      credentialStore.save(devicePublicId, nextDeviceToken),
  );
  await railway.authenticateDevice();

  const journal = new Journal();
  await journal.load();

  const runner = new DispatchRunner(config, railway, journal, paths.logsDir);
  const controlRunner = new ControlRunner(config);
  await runner.reconcileStartup();

  const ws = new WsClient(
    config.wsUrl,
    () => railway.ensureWebSocketToken(),
    config.workspaceId,
    Array.from(
      new Set([
        ...config.agents.map((entry) => entry.externalAgentId),
        ...(config.managedAgentHosts ?? []).map(
          (entry) => entry.externalAgentId,
        ),
      ]),
    ),
    async (payload) => runner.handleDispatch(payload),
    async (eventType, payload, reply) =>
      controlRunner.handleEvent(eventType, payload, reply),
    controlCapabilities(config),
  );
  await ws.connect();

  const publishCatalogue = async () => {
    try {
      const result = await publishArtifactCatalogue(config, railway);
      logger.info(
        `published ${result.synchronized} artifact metadata record(s) for ${result.sourceMachineId}`,
      );
    } catch (error) {
      logger.error(
        `artifact catalogue publish failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  await publishCatalogue();

  const heartbeatInterval = setInterval(async () => {
    try {
      await railway.heartbeat({
        deviceLabel: config.runtimeLabel ?? "claude-runtime",
        activeDispatchCount: journal.listActive().length,
        registeredExternalAgentIds: config.agents.map(
          (entry) => entry.externalAgentId,
        ),
      });
    } catch (error) {
      logger.error(
        `heartbeat failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, (config.heartbeatIntervalSeconds ?? 30) * 1000);

  const catalogueInterval = setInterval(
    () => void publishCatalogue(),
    Math.max((config.heartbeatIntervalSeconds ?? 30) * 4, 120) * 1000,
  );

  const shutdown = async (signal: string) => {
    clearInterval(heartbeatInterval);
    clearInterval(catalogueInterval);
    logger.warn(`shutting down on ${signal}`);
    for (const active of journal.listActive()) {
      await railway.postDispatchFailed(active.dispatchId, {
        errorCode: "runtime_shutdown",
        errorMessage: "Claude runtime shut down before completing the dispatch.",
        notifyThread: true,
      });
      await journal.remove(active.dispatchId);
    }
    await ws.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

async function main() {
  const [, , command, ...args] = process.argv;
  if (command === "enroll") {
    const codeIndex = args.indexOf("--code");
    const labelIndex = args.indexOf("--label");
    const code = codeIndex >= 0 ? args[codeIndex + 1] : "";
    const label = labelIndex >= 0 ? args[labelIndex + 1] : "Claude Runtime";
    if (!code) {
      throw new Error("Missing --code <enrollment-code>");
    }
    await enroll(code, label);
    return;
  }

  await start();
}

void main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
