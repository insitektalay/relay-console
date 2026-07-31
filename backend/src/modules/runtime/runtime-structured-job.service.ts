import { randomUUID } from "node:crypto";
import {
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  AgentEntity,
  RuntimeBindingEntity,
  RuntimeStructuredJobEntity,
} from "../../entities";
import { EventsGateway } from "../../gateways/events.gateway";

export const RUNTIME_STRUCTURED_JOB_CAPABILITY =
  "clawchat.runtime.structured_jobs";
export const RUNTIME_STRUCTURED_OUTPUT_CAPABILITY =
  "clawchat.runtime.structured_output";
export const RUNTIME_STRUCTURED_JOB_PROVIDER = "runtime_structured_job";

export type RuntimeStructuredJobType =
  | "thread_wrap_up_report"
  | "condensed_team_chat_message"
  | "cron_inventory";

export interface RuntimeStructuredJobResult<T extends Record<string, unknown>> {
  output: T;
  model: string | null;
  job: RuntimeStructuredJobEntity;
  runtimeType: "openclaw" | "hermes";
  agentId: string;
  externalAgentId: string;
}

type PendingStructuredJob = {
  resolve: (result: {
    output: Record<string, unknown>;
    model: string | null;
    metadata?: Record<string, unknown> | null;
  }) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type RuntimeCandidate = {
  agent: AgentEntity;
  binding: RuntimeBindingEntity;
  externalAgentId: string;
  runtimeType: "openclaw" | "hermes";
};

@Injectable()
export class RuntimeStructuredJobService {
  private readonly pendingJobs = new Map<string, PendingStructuredJob>();

  constructor(
    @InjectRepository(RuntimeStructuredJobEntity)
    private readonly jobRepo: Repository<RuntimeStructuredJobEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(RuntimeBindingEntity)
    private readonly runtimeBindingRepo: Repository<RuntimeBindingEntity>,
    private readonly configService: ConfigService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async latestForAgent(input: {
    agentId: string;
    jobType: RuntimeStructuredJobType;
  }): Promise<{
    running: RuntimeStructuredJobEntity | null;
    completed: RuntimeStructuredJobEntity | null;
    latest: RuntimeStructuredJobEntity | null;
  }> {
    const where = { agentId: input.agentId, jobType: input.jobType };
    const [running, completed, latest] = await Promise.all([
      this.jobRepo.findOne({
        where: { ...where, status: "running" },
        order: { createdAt: "DESC" },
      }),
      this.jobRepo.findOne({
        where: { ...where, status: "completed" },
        order: { createdAt: "DESC" },
      }),
      this.jobRepo.findOne({
        where,
        order: { createdAt: "DESC" },
      }),
    ]);
    return { running, completed, latest };
  }

  async runStructuredJob<T extends Record<string, unknown>>(input: {
    workspaceId: string;
    jobType: RuntimeStructuredJobType;
    prompt: string;
    schema: Record<string, unknown>;
    schemaName: string;
    model?: string | null;
    timeoutMs?: number | null;
    preferredAgentIds?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<RuntimeStructuredJobResult<T>> {
    const timeoutMs = this.resolveTimeoutMs(input.timeoutMs);
    const candidate = await this.selectCandidate({
      workspaceId: input.workspaceId,
      preferredAgentIds: input.preferredAgentIds ?? [],
    });
    if (!candidate) {
      throw new ServiceUnavailableException(
        "No connected OpenClaw or Hermes runtime agent with structured-job support is available for this workspace",
      );
    }

    const job = await this.jobRepo.save(
      this.jobRepo.create({
        workspaceId: input.workspaceId,
        jobType: input.jobType,
        runtimeType: candidate.runtimeType,
        agentId: candidate.agent.id,
        externalAgentId: candidate.externalAgentId,
        runtimeBindingId: candidate.binding.id,
        status: "running",
        schemaName: input.schemaName,
        model: input.model?.trim() || null,
        correlationId: randomUUID(),
        inputMetadata: input.metadata ?? {},
        startedAt: new Date(),
      }),
    );

    const result = await this.dispatchAndWait({
      job,
      candidate,
      prompt: input.prompt,
      schema: input.schema,
      model: input.model?.trim() || null,
      timeoutMs,
      metadata: input.metadata ?? {},
    });

    const validationErrors = validateAgainstSchema(input.schema, result.output);
    if (validationErrors.length) {
      const errorMessage = `Structured job output failed schema validation: ${validationErrors.join("; ")}`;
      await this.failJobRecord(job.id, {
        code: "schema_validation_failed",
        message: errorMessage,
        retryable: true,
      });
      throw new Error(errorMessage);
    }

    const completed = await this.jobRepo.save({
      ...job,
      status: "completed",
      output: result.output,
      model: result.model ?? job.model,
      completedAt: new Date(),
      errorCode: null,
      errorMessage: null,
      retryable: false,
    });

    return {
      output: result.output as T,
      model: result.model ?? job.model,
      job: completed,
      runtimeType: candidate.runtimeType,
      agentId: candidate.agent.id,
      externalAgentId: candidate.externalAgentId,
    };
  }

  async completeJob(input: {
    jobId: string;
    workspaceId: string;
    output: unknown;
    model?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const job = await this.jobRepo.findOne({ where: { id: input.jobId } });
    if (!job || job.workspaceId !== input.workspaceId) {
      return false;
    }

    const pending = this.pendingJobs.get(input.jobId);
    if (!pending) {
      return false;
    }

    const output = normalizeStructuredOutput(input.output);
    if (!output) {
      clearTimeout(pending.timeout);
      this.pendingJobs.delete(input.jobId);
      await this.failJobRecord(input.jobId, {
        code: "malformed_output",
        message: "Structured job returned non-object output",
        retryable: true,
      });
      pending.reject(new Error("Structured job returned non-object output"));
      return true;
    }

    clearTimeout(pending.timeout);
    this.pendingJobs.delete(input.jobId);
    pending.resolve({
      output,
      model: input.model?.trim() || null,
      metadata: input.metadata ?? null,
    });
    return true;
  }

  async failJob(input: {
    jobId: string;
    workspaceId: string;
    code: string;
    message: string;
    retryable?: boolean;
    metadata?: Record<string, unknown> | null;
  }) {
    const job = await this.jobRepo.findOne({ where: { id: input.jobId } });
    if (!job || job.workspaceId !== input.workspaceId) {
      return false;
    }

    const pending = this.pendingJobs.get(input.jobId);
    await this.failJobRecord(job.id, {
      code: input.code,
      message: input.message,
      retryable: input.retryable ?? false,
    });

    if (!pending) {
      return false;
    }

    clearTimeout(pending.timeout);
    this.pendingJobs.delete(input.jobId);
    const error = new Error(input.message);
    (error as Error & { code?: string; retryable?: boolean }).code = input.code;
    (error as Error & { code?: string; retryable?: boolean }).retryable =
      input.retryable ?? false;
    pending.reject(error);
    return true;
  }

  private async dispatchAndWait(input: {
    job: RuntimeStructuredJobEntity;
    candidate: RuntimeCandidate;
    prompt: string;
    schema: Record<string, unknown>;
    model: string | null;
    timeoutMs: number;
    metadata: Record<string, unknown>;
  }): Promise<{
    output: Record<string, unknown>;
    model: string | null;
    metadata?: Record<string, unknown> | null;
  }> {
    const payload = {
      jobId: input.job.id,
      workspaceId: input.job.workspaceId,
      jobType: input.job.jobType,
      agentId: input.candidate.agent.id,
      externalAgentId: input.candidate.externalAgentId,
      runtimeType: input.candidate.runtimeType,
      prompt: input.prompt,
      schema: input.schema,
      input: input.metadata,
      model: input.model,
      timeoutMs: input.timeoutMs,
      correlationId: input.job.correlationId,
      metadata: input.metadata,
    };

    const resultPromise = new Promise<{
      output: Record<string, unknown>;
      model: string | null;
      metadata?: Record<string, unknown> | null;
    }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingJobs.delete(input.job.id);
        void this.failJobRecord(input.job.id, {
          code: "timeout",
          message: "Timed out waiting for runtime structured job result",
          retryable: true,
        });
        reject(
          new GatewayTimeoutException(
            "Timed out waiting for runtime structured job result",
          ),
        );
      }, input.timeoutMs + 5_000);
      this.pendingJobs.set(input.job.id, { resolve, reject, timeout });
    });

    if (input.candidate.runtimeType === "openclaw") {
      this.eventsGateway.emitToBridgeAgents(
        input.job.workspaceId,
        [input.candidate.externalAgentId],
        "agent.structured_job",
        payload,
      );
    } else {
      this.eventsGateway.emitToHermesBridgeWorkspace(
        input.job.workspaceId,
        "hermes.structured_job.dispatch",
        payload,
        RUNTIME_STRUCTURED_JOB_CAPABILITY,
      );
    }

    return resultPromise;
  }

  private async selectCandidate(input: {
    workspaceId: string;
    preferredAgentIds: string[];
  }): Promise<RuntimeCandidate | null> {
    const preferredIds = input.preferredAgentIds.filter(Boolean);
    const bindings = await this.runtimeBindingRepo.find({
      where: {
        workspaceId: input.workspaceId,
        isEnabled: true,
        runtimeType: In(["openclaw", "hermes"]),
      },
      order: { createdAt: "ASC" },
    });
    if (!bindings.length) return null;

    const agents = await this.agentRepo.find({
      where: { id: In(bindings.map((binding) => binding.agentId)) },
    });
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const liveOpenClaw = new Set(
      this.eventsGateway.getWorkspaceBridgeRuntime(input.workspaceId)
        .liveRegisteredExternalAgentIds,
    );
    const liveHermes = new Set(
      this.eventsGateway.getWorkspaceHermesBridgeRuntime(input.workspaceId)
        .liveRegisteredExternalAgentIds,
    );

    const candidates = bindings
      .map((binding) => {
        const agent = agentById.get(binding.agentId);
        const runtimeType =
          binding.runtimeType === "openclaw" || binding.runtimeType === "hermes"
            ? binding.runtimeType
            : null;
        const externalAgentId = agent?.externalId?.trim();
        if (!agent || !runtimeType || !externalAgentId) return null;
        if (!this.bindingSupportsStructuredJobs(binding)) return null;
        if (runtimeType === "openclaw" && !liveOpenClaw.has(externalAgentId)) {
          return null;
        }
        if (runtimeType === "hermes" && !liveHermes.has(externalAgentId)) {
          return null;
        }
        return { agent, binding, externalAgentId, runtimeType };
      })
      .filter((candidate): candidate is RuntimeCandidate => Boolean(candidate));

    if (!candidates.length) return null;
    return (
      candidates.find((candidate) =>
        preferredIds.includes(candidate.agent.id),
      ) ?? candidates[0]
    );
  }

  private bindingSupportsStructuredJobs(binding: RuntimeBindingEntity) {
    return (
      binding.capabilities?.structuredJobs === true ||
      binding.capabilities?.structuredOutput === true ||
      binding.capabilities?.[RUNTIME_STRUCTURED_JOB_CAPABILITY] === true ||
      binding.capabilities?.[RUNTIME_STRUCTURED_OUTPUT_CAPABILITY] === true
    );
  }

  private resolveTimeoutMs(timeoutMs?: number | null) {
    if (typeof timeoutMs === "number" && timeoutMs > 0) {
      return timeoutMs;
    }
    return Number(
      this.configService.get<string>("STRUCTURED_JOBS_TIMEOUT_MS") ?? "180000",
    );
  }

  private async failJobRecord(
    jobId: string,
    input: { code: string; message: string; retryable: boolean },
  ) {
    await this.jobRepo.update(jobId, {
      status: input.code === "timeout" ? "timed_out" : "failed",
      errorCode: input.code,
      errorMessage: input.message,
      retryable: input.retryable,
      completedAt: new Date(),
    });
  }
}

function normalizeStructuredOutput(
  value: unknown,
): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return normalizeStructuredOutput(parsed);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function validateAgainstSchema(
  schema: Record<string, unknown>,
  value: unknown,
  path = "$",
): string[] {
  const errors: string[] = [];
  const type = schema.type;
  if (type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [`${path} must be an object`];
    }
    const record = value as Record<string, unknown>;
    const required = Array.isArray(schema.required)
      ? schema.required.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];
    for (const key of required) {
      if (!(key in record)) {
        errors.push(`${path}.${key} is required`);
      }
    }
    const properties =
      schema.properties &&
      typeof schema.properties === "object" &&
      !Array.isArray(schema.properties)
        ? (schema.properties as Record<string, Record<string, unknown>>)
        : {};
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in record) {
        errors.push(
          ...validateAgainstSchema(
            propertySchema,
            record[key],
            `${path}.${key}`,
          ),
        );
      }
    }
    return errors;
  }
  if (type === "array") {
    if (!Array.isArray(value)) {
      return [`${path} must be an array`];
    }
    const itemSchema =
      schema.items &&
      typeof schema.items === "object" &&
      !Array.isArray(schema.items)
        ? (schema.items as Record<string, unknown>)
        : null;
    if (itemSchema) {
      value.forEach((entry, index) => {
        errors.push(
          ...validateAgainstSchema(itemSchema, entry, `${path}[${index}]`),
        );
      });
    }
    return errors;
  }
  if (type === "string" && typeof value !== "string") {
    return [`${path} must be a string`];
  }
  if (type === "integer" && !Number.isInteger(value)) {
    return [`${path} must be an integer`];
  }
  if (type === "number" && typeof value !== "number") {
    return [`${path} must be a number`];
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return [`${path} must be one of ${schema.enum.join(", ")}`];
  }
  return errors;
}
