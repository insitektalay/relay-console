import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ManagedAgentHostConfig, RuntimeConfig } from "./config";
import {
  BoundedOutputCapture,
  MAX_ERROR_DETAIL_BYTES,
  boundedRedactedText,
} from "./output-security";
import {
  assertManagedExistingDirectory,
  assertManagedPath,
  assertSafeRuntimeId,
} from "./path-policy";

type Payload = Record<string, unknown>;

export class HostOperations {
  constructor(private readonly config: RuntimeConfig) {}

  async handle(eventType: string, payload: Payload): Promise<Payload> {
    switch (eventType) {
      case "clawchat.host.agent_workspace.purge":
        return this.purgeAgentWorkspace(this.agent(payload));
      case "clawchat.host.scheduler.maintain":
        return this.maintainScheduler(this.agent(payload), payload);
      case "clawchat.host.cron.list":
        return this.listCronJobs(this.agent(payload), payload);
      default:
        throw new Error(`Unsupported paired-host operation ${eventType}`);
    }
  }

  private agent(payload: Payload) {
    const externalAgentId = this.text(
      payload.externalAgentId,
      "externalAgentId",
    );
    const agent = this.config.managedAgentHosts?.find(
      (entry) => entry.externalAgentId === externalAgentId,
    );
    if (!agent) {
      throw new Error(`Agent ${externalAgentId} is not locally authorised`);
    }
    return agent;
  }

  private async purgeAgentWorkspace(agent: ManagedAgentHostConfig) {
    if (!agent.workspacePath)
      throw new Error("Agent workspace purge is not configured");
    if (agent.allowWorkspaceQuarantine !== true) {
      throw new Error(
        "Agent workspace quarantine requires explicit local configuration",
      );
    }
    const workspacePath = await assertManagedPath(
      this.config.managedRoot,
      agent.workspacePath,
      "agent workspace",
      false,
    );
    if (!(await this.exists(agent.workspacePath))) {
      return { acknowledged: true, purged: true, alreadyAbsent: true };
    }
    await assertManagedExistingDirectory(
      this.config.managedRoot,
      workspacePath,
      "agent workspace",
    );
    const quarantineRoot = path.join(
      path.resolve(this.config.managedRoot),
      ".clawchat-quarantine",
    );
    await fs.mkdir(quarantineRoot, { recursive: false, mode: 0o700 }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      },
    );
    await fs.chmod(quarantineRoot, 0o700);
    await assertManagedExistingDirectory(
      this.config.managedRoot,
      quarantineRoot,
      "quarantine root",
    );
    const quarantineId = `${assertSafeRuntimeId(
      agent.externalAgentId,
      "externalAgentId",
    )}-${randomUUID()}`;
    const quarantine = path.join(quarantineRoot, quarantineId);
    await assertManagedPath(
      this.config.managedRoot,
      quarantine,
      "quarantine target",
      false,
    );
    await fs.rename(workspacePath, quarantine);
    return {
      acknowledged: true,
      purged: true,
      quarantined: true,
      quarantineId,
      alreadyAbsent: false,
    };
  }

  private async maintainScheduler(
    agent: ManagedAgentHostConfig,
    payload: Payload,
  ) {
    const command = agent.schedulerCommand;
    if (!command?.length)
      throw new Error("Scheduler maintenance is not configured");
    const jobId = this.text(payload.jobId, "jobId");
    const action = payload.action === "activate" ? "activate" : "recover";
    const result = await this.run(command, {
      CLAWCHAT_AGENT_EXTERNAL_ID: agent.externalAgentId,
      CLAWCHAT_CRON_JOB_ID: jobId,
      CLAWCHAT_SCHEDULER_ACTION: action,
    });
    return {
      acknowledged: true,
      activated: true,
      recovered: action === "recover",
      jobId,
      action,
      output: result,
    };
  }

  private async listCronJobs(agent: ManagedAgentHostConfig, payload: Payload) {
    const runtimeType = this.text(payload.runtimeType, "runtimeType");
    const hosts =
      payload.scope === "workspace"
        ? (this.config.managedAgentHosts ?? []).filter(
            (entry) => entry.cronCommand?.length,
          )
        : [agent];
    if (!hosts.length)
      throw new Error("Native cron management is not configured");
    const jobs: unknown[] = [];
    for (const host of hosts) {
      const hostRuntimeType = host.runtimeType ?? runtimeType;
      const hostJobs = await this.listAgentCronJobs(host, hostRuntimeType);
      jobs.push(
        ...hostJobs.map((job) => ({
          ...(job && typeof job === "object" ? job : { value: job }),
          runtimeType: hostRuntimeType,
          agentId: host.externalAgentId,
        })),
      );
    }
    return {
      acknowledged: true,
      runtimeType: payload.scope === "workspace" ? "mixed" : runtimeType,
      jobs,
      scheduler: { available: true, running: true },
    };
  }

  private async listAgentCronJobs(
    agent: ManagedAgentHostConfig,
    runtimeType: string,
  ): Promise<unknown[]> {
    const command = agent.cronCommand!;
    const args =
      runtimeType === "openclaw"
        ? ["list", "--agent", agent.externalAgentId, "--json"]
        : ["list", "--json"];
    const output = await this.run([...command, ...args], {
      CLAWCHAT_AGENT_EXTERNAL_ID: agent.externalAgentId,
      CLAWCHAT_CRON_OPERATION: "list",
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch {
      throw new Error("Native cron command returned invalid JSON");
    }
    return Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as Payload).jobs)
        ? ((parsed as Payload).jobs as unknown[])
        : [];
  }

  private async run(command: string[], extraEnv: Record<string, string>) {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...extraEnv },
      });
      const capture = new BoundedOutputCapture();
      const append = (chunk: Buffer) => {
        if (!capture.append(chunk)) {
          child.kill("SIGTERM");
        }
      };
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      const timeout = setTimeout(() => child.kill("SIGTERM"), 55_000);
      child.once("error", reject);
      child.once("close", (code) => {
        clearTimeout(timeout);
        const output = boundedRedactedText(
          capture.text().trim(),
          MAX_ERROR_DETAIL_BYTES,
        );
        if (capture.didExceedLimit()) {
          reject(new Error("Host command exceeded the output limit"));
        } else if (code === 0) resolve(output);
        else
          reject(
            new Error(
              `Scheduler command failed with exit code ${code}: ${output.trim()}`,
            ),
          );
      });
    });
  }

  private text(value: unknown, label: string) {
    if (typeof value !== "string" || !value.trim())
      throw new Error(`${label} is required`);
    return assertSafeRuntimeId(value.trim(), label);
  }

  private async exists(value: string) {
    try {
      await fs.access(value);
      return true;
    } catch {
      return false;
    }
  }

}
