import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DocumentationBlueprintEntity } from "../../../entities/documentation-blueprint.entity";
import { ApplicationDocumentationPackEntity } from "../../../entities/application-documentation-pack.entity";
import { ClaudeCliService } from "../../claude/claude-cli.service";
import {
  AGENT_DOCS_COMPILER_VERSION,
  AGENT_DOCS_PACK_PATH,
} from "../agent-documentation.constants";
import {
  assertSafeRelativePath,
  isAllowedRepoPackPath,
  isMutablePath,
  isWorkspaceRouterPath,
  normalizeRelativePath,
} from "../agent-documentation.utils";
import { GenerateDocumentationProposalDto } from "../dto/agent-documentation.dto";
import { DocumentationBlueprintService } from "./documentation-blueprint.service";
import { LinkedApplicationService } from "./linked-application.service";
import { DocumentationProposalService, ProposalFileInput } from "./documentation-proposal.service";

const PROPOSAL_GENERATION_TIMEOUT_MS = 12 * 60 * 1000;
const COMPILER_PROMPT_TIMEOUT_MS = 10 * 60 * 1000;

type CompilerFile = {
  relativePath: string;
  previousContent?: string | null;
  updatedContent: string;
  classification?: string;
  refreshPolicy?: string;
  summary?: string;
  requiresManualReview?: boolean;
  conflictStatus?: string;
};

@Injectable()
export class DocumentationCompilerService {
  constructor(
    private readonly claudeCliService: ClaudeCliService,
    private readonly linkedApplicationService: LinkedApplicationService,
    private readonly blueprintService: DocumentationBlueprintService,
    private readonly proposalService: DocumentationProposalService,
    @InjectRepository(ApplicationDocumentationPackEntity)
    private readonly packRepo: Repository<ApplicationDocumentationPackEntity>,
  ) {}

  async queueProposalGeneration(
    workspaceId: string,
    userId: string,
    dto: GenerateDocumentationProposalDto,
  ) {
    const app = await this.linkedApplicationService.get(workspaceId, dto.linkedApplicationId);
    const proposal = await this.proposalService.createGenerating({
      workspaceId,
      linkedApplicationId: app.id,
      packId: dto.packId ?? null,
      mode: dto.mode,
      userId,
      compilerInputMetadata: {
        linkedApplicationId: app.id,
        queuedAt: new Date().toISOString(),
      },
    });
    void this.withTimeout(
      this.generateProposalIntoExisting(proposal.id, workspaceId, userId, dto),
      PROPOSAL_GENERATION_TIMEOUT_MS,
      "Documentation proposal generation timed out before completion. No files were written.",
    ).catch((error) => this.proposalService.failGeneration(proposal.id, error));
    return proposal;
  }

  async generateProposalIntoExisting(
    proposalId: string,
    workspaceId: string,
    _userId: string,
    dto: GenerateDocumentationProposalDto,
  ) {
    const app = await this.linkedApplicationService.get(workspaceId, dto.linkedApplicationId);
    const allBlueprints = dto.blueprintIds?.length
      ? await Promise.all(dto.blueprintIds.map((id) => this.blueprintService.getVisible(workspaceId, id)))
      : await this.blueprintService.getPublishedDefaults();
    if (!allBlueprints.length) {
      throw new BadRequestException("At least one documentation blueprint is required");
    }
    const blueprints = this.selectCompilerBlueprints(dto.mode, allBlueprints);

    const pack =
      dto.packId
        ? await this.packRepo.findOne({ where: { id: dto.packId, workspaceId } })
        : null;
    const beforeState = await this.runStage("pre-generation repo probe", () =>
      this.linkedApplicationService.getRepoState(workspaceId, app.repoKey),
    );
    const existingDocs: Array<{ path: string; hash: string; content: string }> = [];
    const prompt = this.buildPrompt({
      mode: dto.mode,
      app,
      pack,
      blueprints,
      existingDocs,
      metadata: dto.metadata ?? {},
    });
    const result = await this.runStage("documentation compiler", () =>
      this.runCompilerPrompt(workspaceId, app.repoKey ?? undefined, prompt),
    );
    const afterState = await this.runStage("post-generation repo probe", () =>
      this.linkedApplicationService.getRepoState(workspaceId, app.repoKey),
    );
    const unexpectedDirectWrites =
      beforeState.status !== afterState.status ||
      beforeState.commit !== afterState.commit;
    if (unexpectedDirectWrites) {
      throw new BadRequestException(
        "Documentation compiler changed the linked repo directly. No proposal was stored; review the repo state before retrying.",
      );
    }
    const files = this.normalizeCompilerFiles(result.output.changedFiles ?? []);
    return this.proposalService.completeGeneration(proposalId, {
      summaries: result.output.summaries ?? [],
      conflicts: result.output.conflicts ?? [],
      reviewNotes: result.output.reviewNotes ?? [],
      suggestedApplyActions: result.output.suggestedApplyActions ?? [],
      compilerInputMetadata: {
        blueprintIds: allBlueprints.map((blueprint) => blueprint.id),
        blueprintVersions: allBlueprints.map((blueprint) => ({
          systemKey: blueprint.systemKey,
          version: blueprint.version,
        })),
        compilerBlueprintIds: blueprints.map((blueprint) => blueprint.id),
        repoState: beforeState,
      },
      compilerOutputMetadata: {
        status: result.output.status,
        model: result.model,
        filesRequiringManualReview: result.output.filesRequiringManualReview ?? [],
      },
      files,
    });
  }

  private buildPrompt(input: {
    mode: string;
    app: { name: string; slug: string; generatedDocsPath: string };
    pack: ApplicationDocumentationPackEntity | null;
    blueprints: DocumentationBlueprintEntity[];
    existingDocs: Array<{ path: string; hash: string; content: string }>;
    metadata: Record<string, unknown>;
  }) {
    return [
      "You are the ClawChat agent documentation compiler.",
      "Return structured JSON only. Do not write files. Do not modify the repository.",
      "Your structured response must contain exactly one field named payload. payload must be a JSON string, not markdown.",
      "The payload string must parse to an object with status, changedFiles, summaries, conflicts, reviewNotes, filesRequiringManualReview, and suggestedApplyActions.",
      "Keep this generation bounded. Produce a useful first-pass proposal, not exhaustive documentation.",
      "Generated repo pack root: .clawchat/agent-docs/.",
      "Allowed output paths are pack_manifest.json, library/**, and workspace_files/manager|worker|auditor/AGENTS.md or WORKFLOW.md under that root.",
      "relativePath may be either pack-internal, like library/workflow.md, or repo-relative, like .clawchat/agent-docs/library/workflow.md.",
      "Never generate mutable state: _state/**, MEMORY.md, memory/**, task lists, history logs, approvals, current-state, or manager current packet files.",
      "Do not put uppercase workspace files in library/**. Do not put lowercase library docs in workspace_files/**.",
      "For generate_initial_pack, generate only these files: pack_manifest.json, library/workflow.md, library/api/overview.md, library/runbooks/stop-and-escalate-rules.md, library/manager_workflow/workflow.md, workspace_files/manager/AGENTS.md, workspace_files/manager/WORKFLOW.md, workspace_files/worker/AGENTS.md, workspace_files/worker/WORKFLOW.md, workspace_files/auditor/AGENTS.md, workspace_files/auditor/WORKFLOW.md.",
      "Use concise markdown. Each markdown file should usually be 20 to 80 lines.",
      "If repo details are unclear, write honest placeholders and add reviewNotes instead of expanding the scope.",
      `Mode: ${input.mode}`,
      `Application: ${input.app.name} (${input.app.slug})`,
      `Compiler version: ${AGENT_DOCS_COMPILER_VERSION}`,
      `Metadata: ${JSON.stringify(input.metadata)}`,
      "Blueprint summaries:",
      ...input.blueprints.map((blueprint) => `\n--- ${blueprint.systemKey} ${blueprint.version} ---\n${this.compactBlueprint(blueprint.content)}`),
      "Required payload shape:",
      JSON.stringify({
        status: "pending_review",
        changedFiles: [
          {
            relativePath: "library/workflow.md",
            previousContent: null,
            updatedContent: "# ...",
            classification: "generated_app_capability_docs",
            refreshPolicy: "regenerate_allowed",
            summary: "short summary",
            requiresManualReview: false,
            conflictStatus: "none",
          },
        ],
        summaries: [{ path: null, message: "short summary" }],
        conflicts: [],
        reviewNotes: [],
        filesRequiringManualReview: [],
        suggestedApplyActions: [],
      }),
    ].join("\n\n");
  }

  private async runCompilerPrompt(
    workspaceId: string,
    repoKey: string | undefined,
    prompt: string,
  ): Promise<{
    output: {
      status: string;
      changedFiles: CompilerFile[];
      summaries?: Array<Record<string, unknown>>;
      conflicts?: Array<Record<string, unknown>>;
      reviewNotes?: Array<Record<string, unknown>>;
      filesRequiringManualReview?: string[];
      suggestedApplyActions?: Array<Record<string, unknown>>;
    };
    model: string | null;
  }> {
    const result = await this.claudeCliService.runStructuredPrompt<{ payload: string }>({
      workspaceId,
      prompt,
      schema: this.compilerEnvelopeSchema(),
      repoKey,
      timeoutMs: COMPILER_PROMPT_TIMEOUT_MS,
      maxTurns: 8,
    });
    let output: unknown;
    try {
      output = JSON.parse(result.output.payload);
    } catch (error) {
      throw new BadRequestException(
        `Documentation compiler returned invalid JSON payload: ${
          error instanceof Error ? error.message : "parse failed"
        }`,
      );
    }
    return { output: this.validateCompilerPayload(output), model: result.model };
  }

  private compilerEnvelopeSchema() {
    return {
      type: "object",
      additionalProperties: false,
      required: ["payload"],
      properties: {
        payload: { type: "string" },
      },
    };
  }

  private validateCompilerPayload(output: unknown) {
    if (!output || typeof output !== "object" || Array.isArray(output)) {
      throw new BadRequestException("Documentation compiler payload must be an object");
    }
    const record = output as Record<string, unknown>;
    if (typeof record.status !== "string") {
      throw new BadRequestException("Documentation compiler payload is missing status");
    }
    if (!Array.isArray(record.changedFiles)) {
      throw new BadRequestException("Documentation compiler payload is missing changedFiles");
    }
    return {
      status: record.status,
      changedFiles: record.changedFiles as CompilerFile[],
      summaries: Array.isArray(record.summaries)
        ? (record.summaries as Array<Record<string, unknown>>)
        : [],
      conflicts: Array.isArray(record.conflicts)
        ? (record.conflicts as Array<Record<string, unknown>>)
        : [],
      reviewNotes: Array.isArray(record.reviewNotes)
        ? (record.reviewNotes as Array<Record<string, unknown>>)
        : [],
      filesRequiringManualReview: Array.isArray(record.filesRequiringManualReview)
        ? (record.filesRequiringManualReview as string[])
        : [],
      suggestedApplyActions: Array.isArray(record.suggestedApplyActions)
        ? (record.suggestedApplyActions as Array<Record<string, unknown>>)
        : [],
    };
  }

  private normalizeCompilerFiles(files: CompilerFile[]): ProposalFileInput[] {
    const normalized: ProposalFileInput[] = [];
    for (const file of files) {
      const relativePath = this.toRepoPackPath(
        assertSafeRelativePath(normalizeRelativePath(file.relativePath)),
      );
      if (!isAllowedRepoPackPath(relativePath)) {
        throw new BadRequestException(`Compiler returned a path outside the generated pack: ${relativePath}`);
      }
      if (isMutablePath(relativePath)) {
        normalized.push({
          relativePath,
          previousContent: null,
          updatedContent: file.updatedContent,
          classification: "mutable_state",
          refreshPolicy: "never_generate",
          conflictStatus: "protected_mutable_state",
          requiresManualReview: true,
          metadata: { rejectedByPolicy: true },
        });
        continue;
      }
      const previousContent = file.previousContent ?? null;
      normalized.push({
        relativePath,
        previousContent,
        updatedContent: file.updatedContent,
        classification:
          file.classification ??
          (isWorkspaceRouterPath(relativePath)
            ? "generated_workspace_router"
            : relativePath.includes("/manager_workflow/")
              ? "generated_doctrine"
              : "generated_app_capability_docs"),
        refreshPolicy:
          file.refreshPolicy ??
          (isWorkspaceRouterPath(relativePath) ? "install_only" : "regenerate_allowed"),
        conflictStatus: file.conflictStatus ?? "none",
        requiresManualReview: file.requiresManualReview ?? false,
        metadata: { summary: file.summary ?? null },
      });
    }
    return normalized;
  }

  private selectCompilerBlueprints(mode: string, blueprints: DocumentationBlueprintEntity[]) {
    if (mode !== "generate_initial_pack") return blueprints;
    const preferred = new Set([
      "openclaw-workspace-baseline",
      "application-documentation-pack-standard",
      "api-integration-runbook-standard",
      "manager-worker-operating-protocol",
      "safety-gates-citation-standard",
    ]);
    return blueprints.filter((blueprint) => preferred.has(blueprint.systemKey));
  }

  private toRepoPackPath(relativePath: string) {
    const safe = normalizeRelativePath(relativePath);
    if (safe === AGENT_DOCS_PACK_PATH || safe.startsWith(`${AGENT_DOCS_PACK_PATH}/`)) {
      return safe;
    }
    return `${AGENT_DOCS_PACK_PATH}/${safe}`;
  }

  private compactBlueprint(content: string) {
    return content
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed.startsWith("#") || trimmed.startsWith("- ") || trimmed.length > 0;
      })
      .slice(0, 80)
      .join("\n")
      .slice(0, 4000);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
  }

  private async runStage<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new BadRequestException(
        `${stage} failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}
