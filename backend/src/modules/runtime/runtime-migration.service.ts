import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { Repository } from "typeorm";
import {
  AgentEntity,
  RuntimeHostEntity,
  RuntimeMigrationEntity,
  RuntimeObservationEntity,
} from "../../entities";
import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";
import { RuntimeAuthorityService } from "./runtime-authority.service";

const MIGRATION_TRANSITIONS: Record<string, string> = {
  planned: "snapshot_ready",
  source_paused: "snapshot_ready",
  snapshot_ready: "imported",
  imported: "validated",
  validated: "switched",
  switched: "completed",
};
const FORBIDDEN_MANIFEST_KEY =
  /(^|[_-])(secret|password|token|authorization|api[_-]?key|private[_-]?key|oauth|credential)([_-]|$)/i;
const ALLOWED_MIGRATION_CATEGORIES = new Set([
  "identity",
  "configuration",
  "memory",
  "skills",
  "tasks",
  "history",
  "artifactIndex",
]);
const FORBIDDEN_MACHINE_PATH =
  /(^|[\\/])(?:\.git|\.svn|\.hg|node_modules|vendor|venv|\.venv|__pycache__|cache|caches|logs?|sessions?|tmp|temp)(?:[\\/]|$)|(?:^|[\\/])\.\.(?:[\\/]|$)/i;
const ABSOLUTE_MACHINE_PATH =
  /^(?:[a-zA-Z]:[\\/]|\\\\|\/(?:Users|home|var|etc|opt|private|tmp|Volumes)\/)/;

type EncryptedMigrationManifest = {
  schemaVersion: "relay-runtime-migration-encrypted.v1";
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
};

@Injectable()
export class RuntimeMigrationService {
  constructor(
    @InjectRepository(RuntimeMigrationEntity)
    private readonly migrations: Repository<RuntimeMigrationEntity>,
    @InjectRepository(RuntimeBindingEntity)
    private readonly bindings: Repository<RuntimeBindingEntity>,
    @InjectRepository(AgentEntity)
    private readonly agents: Repository<AgentEntity>,
    @InjectRepository(RuntimeHostEntity)
    private readonly hosts: Repository<RuntimeHostEntity>,
    @InjectRepository(RuntimeObservationEntity)
    private readonly observations: Repository<RuntimeObservationEntity>,
    private readonly authority: RuntimeAuthorityService,
    private readonly config: ConfigService,
  ) {}

  async list(workspaceId: string) {
    return this.migrations.find({
      where: { workspaceId },
      order: { createdAt: "DESC" },
    });
  }

  async create(input: {
    workspaceId: string;
    agentId: string;
    operationKey: string;
    sourceRuntimeHostId: string;
    destinationRuntimeHostId: string;
    runtimeType: "hermes" | "openclaw";
  }) {
    const existing = await this.migrations.findOne({
      where: {
        workspaceId: input.workspaceId,
        operationKey: input.operationKey,
      },
    });
    if (existing) return existing;
    const [agent, binding, sourceHost, destinationHost] = await Promise.all([
      this.agents.findOne({
        where: { id: input.agentId, workspaceId: input.workspaceId },
      }),
      this.bindings.findOne({
        where: { agentId: input.agentId, workspaceId: input.workspaceId },
      }),
      this.hosts.findOne({
        where: {
          id: input.sourceRuntimeHostId,
          workspaceId: input.workspaceId,
        },
      }),
      this.hosts.findOne({
        where: {
          id: input.destinationRuntimeHostId,
          workspaceId: input.workspaceId,
        },
      }),
    ]);
    if (!agent || !binding || !sourceHost || !destinationHost) {
      throw new NotFoundException("MIGRATION_SOURCE_OR_DESTINATION_NOT_FOUND");
    }
    if (
      agent.lifecycleStatus !== "active" ||
      binding.runtimeHostId !== sourceHost.id ||
      binding.runtimeType !== input.runtimeType ||
      !sourceHost.supportedRuntimes.includes(input.runtimeType) ||
      !destinationHost.supportedRuntimes.includes(input.runtimeType)
    ) {
      throw new ConflictException("SAME_HARNESS_MIGRATION_PRECONDITION_FAILED");
    }
    const [sourceObservation, destinationObservation] = await Promise.all([
      this.observations.findOne({
        where: {
          agentId: agent.id,
          runtimeHostId: sourceHost.id,
          runtimeType: input.runtimeType,
          status: "active",
        },
      }),
      this.observations.findOne({
        where: {
          agentId: agent.id,
          runtimeHostId: destinationHost.id,
          runtimeType: input.runtimeType,
        },
      }),
    ]);
    if (!sourceObservation) {
      throw new ConflictException("MIGRATION_SOURCE_OBSERVATION_REQUIRED");
    }
    return this.migrations.save(
      this.migrations.create({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        operationKey: input.operationKey,
        runtimeType: input.runtimeType,
        sourceRuntimeHostId: sourceHost.id,
        destinationRuntimeHostId: destinationHost.id,
        sourceObservationId: sourceObservation.id,
        destinationObservationId: destinationObservation?.id ?? null,
        status: "planned",
        sourceAssignmentEpoch: binding.assignmentEpoch,
        destinationAssignmentEpoch: null,
        manifestHash: null,
        manifest: {},
        credentialsReauthorizationRequired: true,
        validationChecks: [],
        lastError: null,
        sourcePausedAt: null,
        switchedAt: null,
        completedAt: null,
        rolledBackAt: null,
      }),
    );
  }

  async advance(
    workspaceId: string,
    id: string,
    input: {
      expectedStatus: string;
      manifest?: Record<string, unknown>;
      validationChecks?: Array<{
        name: string;
        passed: boolean;
        detail?: string;
      }>;
      credentialsReauthorized?: boolean;
      destinationExternalAgentId?: string;
      adapterKind?: string;
    },
  ) {
    const migration = await this.require(workspaceId, id);
    if (migration.status !== input.expectedStatus) {
      throw new ConflictException("MIGRATION_STATUS_CHANGED");
    }
    const next = MIGRATION_TRANSITIONS[migration.status];
    if (!next) throw new ConflictException("MIGRATION_HAS_NO_NEXT_TRANSITION");

    if (next === "snapshot_ready") {
      if (!input.manifest)
        throw new BadRequestException("MIGRATION_MANIFEST_REQUIRED");
      this.assertSafeManifest(input.manifest);
      const serialized = this.stableSerialize(input.manifest);
      migration.manifest = this.encryptManifest(serialized);
      migration.manifestHash = createHash("sha256")
        .update(serialized)
        .digest("hex");
    }
    if (next === "validated") {
      const checks = input.validationChecks ?? [];
      if (!checks.length || checks.some((check) => check.passed !== true)) {
        throw new ConflictException("MIGRATION_DESTINATION_VALIDATION_FAILED");
      }
      migration.validationChecks = checks;
      if (input.credentialsReauthorized !== true) {
        throw new ConflictException(
          "MIGRATION_CREDENTIAL_REAUTHORIZATION_REQUIRED",
        );
      }
      migration.credentialsReauthorizationRequired = false;
    }
    if (next === "switched") {
      const destination = await this.observations.findOne({
        where: {
          id: migration.destinationObservationId!,
          runtimeHostId: migration.destinationRuntimeHostId,
          runtimeType: migration.runtimeType,
          status: "migration_target",
        },
      });
      if (!destination) {
        throw new ConflictException("MIGRATION_TARGET_OBSERVATION_NOT_READY");
      }
      destination.status = "active";
      destination.agentId = migration.agentId;
      await this.observations.save(destination);
      let assigned;
      try {
        assigned = await this.authority.assignExecutionOwner({
          workspaceId,
          agentId: migration.agentId,
          runtimeHostId: migration.destinationRuntimeHostId,
          runtimeType: migration.runtimeType,
          externalAgentId:
            input.destinationExternalAgentId ?? destination.externalAgentId,
          adapterKind:
            input.adapterKind ??
            (migration.runtimeType === "hermes"
              ? "hermes_bridge"
              : "bridge_ws"),
        });
      } catch (error) {
        // Do not advertise a destination as active unless the canonical
        // ownership transaction also succeeded. This makes a retry safe.
        destination.status = "migration_target";
        destination.agentId = migration.agentId;
        await this.observations.save(destination);
        throw error;
      }
      migration.destinationAssignmentEpoch = assigned.binding.assignmentEpoch;
      migration.switchedAt = new Date();
      if (migration.sourceObservationId) {
        await this.observations.update(
          { id: migration.sourceObservationId },
          { status: "migration_source" },
        );
      }
    }
    migration.status = next;
    if (next === "completed") migration.completedAt = new Date();
    return this.migrations.save(migration);
  }

  async rollback(workspaceId: string, id: string) {
    const migration = await this.require(workspaceId, id);
    if (migration.status === "planned" || migration.completedAt) {
      throw new ConflictException("MIGRATION_ROLLBACK_NOT_AVAILABLE");
    }
    const source = await this.observations.findOne({
      where: { id: migration.sourceObservationId! },
    });
    if (!source) throw new ConflictException("MIGRATION_SOURCE_UNAVAILABLE");
    source.status = "active";
    await this.observations.save(source);
    if (migration.switchedAt || migration.destinationAssignmentEpoch) {
      await this.authority.assignExecutionOwner({
        workspaceId,
        agentId: migration.agentId,
        runtimeHostId: migration.sourceRuntimeHostId,
        runtimeType: migration.runtimeType,
        externalAgentId: source.externalAgentId,
        adapterKind:
          migration.runtimeType === "hermes" ? "hermes_bridge" : "bridge_ws",
      });
    }
    migration.status = "rolled_back";
    migration.rolledBackAt = new Date();
    return this.migrations.save(migration);
  }

  async registerDestinationObservation(
    workspaceId: string,
    id: string,
    input: { externalAgentId: string; manifestHash?: string | null },
  ) {
    const migration = await this.require(workspaceId, id);
    if (["switched", "completed", "rolled_back"].includes(migration.status)) {
      throw new ConflictException("MIGRATION_DESTINATION_REGISTRATION_CLOSED");
    }
    const observed = await this.authority.observeAgent({
      workspaceId,
      runtimeHostId: migration.destinationRuntimeHostId,
      runtimeType: migration.runtimeType,
      externalAgentId: input.externalAgentId.trim(),
      canonicalAgentId: migration.agentId,
      manifestHash: input.manifestHash?.trim() || null,
      desiredStatus: "migration_target",
      observedState: {
        source: "runtime_migration_destination",
        migrationId: migration.id,
      },
    });
    if (observed.suppressed || observed.collision) {
      throw new ConflictException("MIGRATION_DESTINATION_IDENTITY_INELIGIBLE");
    }
    migration.destinationObservationId = observed.observation.id;
    await this.migrations.save(migration);
    return observed.observation;
  }

  async readManifest(workspaceId: string, id: string) {
    const migration = await this.require(workspaceId, id);
    if (
      !migration.manifestHash ||
      !this.isEncryptedManifest(migration.manifest)
    ) {
      throw new ConflictException("MIGRATION_SNAPSHOT_NOT_READY");
    }
    const manifest = JSON.parse(
      this.decryptManifest(migration.manifest),
    ) as Record<string, unknown>;
    this.assertSafeManifest(manifest);
    const actualHash = createHash("sha256")
      .update(this.stableSerialize(manifest))
      .digest("hex");
    if (actualHash !== migration.manifestHash) {
      throw new ConflictException("MIGRATION_MANIFEST_INTEGRITY_FAILED");
    }
    return {
      migrationId: migration.id,
      manifestHash: migration.manifestHash,
      credentialsIncluded: false,
      manifest,
    };
  }

  private assertSafeManifest(manifest: Record<string, unknown>) {
    const serialized = JSON.stringify(manifest);
    if (Buffer.byteLength(serialized, "utf8") > 25 * 1_048_576) {
      throw new BadRequestException("MIGRATION_MANIFEST_TOO_LARGE");
    }
    if (manifest.schemaVersion !== "relay-runtime-migration.v1") {
      throw new BadRequestException("MIGRATION_MANIFEST_SCHEMA_UNSUPPORTED");
    }
    const selectedCategories = manifest.selectedCategories;
    const payload = manifest.payload;
    if (
      !Array.isArray(selectedCategories) ||
      selectedCategories.length === 0 ||
      selectedCategories.some(
        (category) =>
          typeof category !== "string" ||
          !ALLOWED_MIGRATION_CATEGORIES.has(category),
      ) ||
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      throw new BadRequestException("MIGRATION_MANIFEST_SCHEMA_INVALID");
    }
    const selected = new Set(selectedCategories as string[]);
    for (const key of Object.keys(payload as Record<string, unknown>)) {
      if (!selected.has(key) || !ALLOWED_MIGRATION_CATEGORIES.has(key)) {
        throw new BadRequestException(
          "MIGRATION_MANIFEST_CATEGORY_NOT_SELECTED",
        );
      }
    }
    const visit = (value: unknown, keyPath: string[] = []): void => {
      if (typeof value === "string") {
        if (value.length > 1_048_576) {
          throw new BadRequestException("MIGRATION_MANIFEST_VALUE_TOO_LARGE");
        }
        if (
          ABSOLUTE_MACHINE_PATH.test(value) ||
          FORBIDDEN_MACHINE_PATH.test(value)
        ) {
          throw new BadRequestException(
            "MIGRATION_MANIFEST_CONTAINS_MACHINE_PATH",
          );
        }
        return;
      }
      if (Array.isArray(value)) {
        if (value.length > 10_000) {
          throw new BadRequestException(
            "MIGRATION_MANIFEST_COLLECTION_TOO_LARGE",
          );
        }
        value.forEach((entry) => visit(entry, keyPath));
        return;
      }
      if (!value || typeof value !== "object") return;
      for (const [key, nested] of Object.entries(value)) {
        if (FORBIDDEN_MANIFEST_KEY.test(key)) {
          throw new BadRequestException("MIGRATION_MANIFEST_CONTAINS_SECRET");
        }
        if (
          keyPath[0] === "payload" &&
          keyPath[1] === "artifactIndex" &&
          /^(content|data|bytes|body|blob)$/i.test(key)
        ) {
          throw new BadRequestException("MIGRATION_ARTIFACT_BYTES_FORBIDDEN");
        }
        visit(nested, [...keyPath, key]);
      }
    };
    visit(manifest, []);
  }

  private stableSerialize(value: unknown): string {
    const normalize = (entry: unknown): unknown => {
      if (Array.isArray(entry)) return entry.map(normalize);
      if (!entry || typeof entry !== "object") return entry;
      return Object.fromEntries(
        Object.entries(entry as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, normalize(nested)]),
      );
    };
    return JSON.stringify(normalize(value));
  }

  private encryptManifest(serialized: string): EncryptedMigrationManifest {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(serialized, "utf8"),
      cipher.final(),
    ]);
    return {
      schemaVersion: "relay-runtime-migration-encrypted.v1",
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64url"),
      authTag: cipher.getAuthTag().toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
    };
  }

  private decryptManifest(manifest: EncryptedMigrationManifest): string {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey(),
        Buffer.from(manifest.iv, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(manifest.authTag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(manifest.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new ConflictException("MIGRATION_MANIFEST_DECRYPTION_FAILED");
    }
  }

  private encryptionKey() {
    const secret =
      this.config.get<string>("RUNTIME_MIGRATION_ENCRYPTION_KEY")?.trim() ||
      this.config.get<string>("MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY")?.trim();
    if (!secret || secret.length < 32) {
      throw new ConflictException("RUNTIME_MIGRATION_ENCRYPTION_KEY_REQUIRED");
    }
    return createHash("sha256")
      .update(`relay-runtime-migration:v1:${secret}`)
      .digest();
  }

  private isEncryptedManifest(
    manifest: Record<string, unknown>,
  ): manifest is EncryptedMigrationManifest {
    return (
      manifest.schemaVersion === "relay-runtime-migration-encrypted.v1" &&
      manifest.algorithm === "aes-256-gcm" &&
      typeof manifest.iv === "string" &&
      typeof manifest.authTag === "string" &&
      typeof manifest.ciphertext === "string"
    );
  }

  private async require(workspaceId: string, id: string) {
    const migration = await this.migrations.findOne({
      where: { id, workspaceId },
    });
    if (!migration) throw new NotFoundException("RUNTIME_MIGRATION_NOT_FOUND");
    return migration;
  }
}
