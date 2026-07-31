import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { DocumentationGenerationProposalEntity } from "../../../entities/documentation-generation-proposal.entity";
import { DocumentationProposalFileEntity } from "../../../entities/documentation-proposal-file.entity";
import { sha256 } from "../agent-documentation.utils";

export type ProposalFileInput = {
  relativePath: string;
  previousContent: string | null;
  updatedContent: string;
  classification: string;
  refreshPolicy: string;
  conflictStatus?: string;
  requiresManualReview?: boolean;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class DocumentationProposalService {
  private readonly staleGeneratingAfterMs = 12 * 60 * 1000;

  constructor(
    @InjectRepository(DocumentationGenerationProposalEntity)
    private readonly proposalRepo: Repository<DocumentationGenerationProposalEntity>,
    @InjectRepository(DocumentationProposalFileEntity)
    private readonly proposalFileRepo: Repository<DocumentationProposalFileEntity>,
  ) {}

  async list(workspaceId: string) {
    await this.markStaleGenerating(workspaceId);
    return this.proposalRepo.find({
      where: { workspaceId },
      order: { updatedAt: "DESC" },
    });
  }

  async get(workspaceId: string, id: string) {
    await this.markStaleGenerating(workspaceId);
    const proposal = await this.proposalRepo.findOne({ where: { id, workspaceId } });
    if (!proposal) throw new NotFoundException("Documentation proposal not found");
    const files = await this.proposalFileRepo.find({
      where: { proposalId: proposal.id, workspaceId },
      order: { relativePath: "ASC" },
    });
    return { ...proposal, files };
  }

  async getEntity(workspaceId: string, id: string) {
    const proposal = await this.proposalRepo.findOne({ where: { id, workspaceId } });
    if (!proposal) throw new NotFoundException("Documentation proposal not found");
    return proposal;
  }

  async create(input: {
    workspaceId: string;
    linkedApplicationId: string;
    packId?: string | null;
    mode: string;
    userId?: string | null;
    summaries?: Array<Record<string, unknown>>;
    conflicts?: Array<Record<string, unknown>>;
    reviewNotes?: Array<Record<string, unknown>>;
    suggestedApplyActions?: Array<Record<string, unknown>>;
    compilerInputMetadata?: Record<string, unknown>;
    compilerOutputMetadata?: Record<string, unknown>;
    files: ProposalFileInput[];
  }) {
    const proposal = await this.proposalRepo.save(
      this.proposalRepo.create({
        workspaceId: input.workspaceId,
        linkedApplicationId: input.linkedApplicationId,
        packId: input.packId ?? null,
        mode: input.mode,
        status: "pending_review",
        summaries: input.summaries ?? [],
        conflicts: input.conflicts ?? [],
        reviewNotes: input.reviewNotes ?? [],
        suggestedApplyActions: input.suggestedApplyActions ?? [],
        compilerInputMetadata: input.compilerInputMetadata ?? {},
        compilerOutputMetadata: input.compilerOutputMetadata ?? {},
        createdByUserId: input.userId ?? null,
      }),
    );
    const files = await this.proposalFileRepo.save(
      input.files.map((file) =>
        this.proposalFileRepo.create({
          workspaceId: input.workspaceId,
          proposalId: proposal.id,
          relativePath: file.relativePath,
          previousContent: file.previousContent,
          updatedContent: file.updatedContent,
          previousHash:
            file.previousContent === null ? null : sha256(file.previousContent),
          updatedHash: sha256(file.updatedContent),
          classification: file.classification,
          refreshPolicy: file.refreshPolicy,
          conflictStatus: file.conflictStatus ?? "none",
          requiresManualReview: file.requiresManualReview ?? false,
          metadata: file.metadata ?? {},
        }),
      ),
    );
    return { ...proposal, files };
  }

  async createGenerating(input: {
    workspaceId: string;
    linkedApplicationId: string;
    packId?: string | null;
    mode: string;
    userId?: string | null;
    compilerInputMetadata?: Record<string, unknown>;
  }) {
    const queuedAt = new Date();
    const timeoutAt = new Date(queuedAt.getTime() + this.staleGeneratingAfterMs);
    const proposal = await this.proposalRepo.save(
      this.proposalRepo.create({
        workspaceId: input.workspaceId,
        linkedApplicationId: input.linkedApplicationId,
        packId: input.packId ?? null,
        mode: input.mode,
        status: "generating",
        summaries: [],
        conflicts: [],
        reviewNotes: [],
        suggestedApplyActions: [],
        compilerInputMetadata: {
          ...(input.compilerInputMetadata ?? {}),
          queuedAt: queuedAt.toISOString(),
          timeoutAt: timeoutAt.toISOString(),
          timeoutMs: this.staleGeneratingAfterMs,
        },
        compilerOutputMetadata: {},
        createdByUserId: input.userId ?? null,
      }),
    );
    return { ...proposal, files: [] };
  }

  async completeGeneration(
    proposalId: string,
    input: {
      summaries?: Array<Record<string, unknown>>;
      conflicts?: Array<Record<string, unknown>>;
      reviewNotes?: Array<Record<string, unknown>>;
      suggestedApplyActions?: Array<Record<string, unknown>>;
      compilerInputMetadata?: Record<string, unknown>;
      compilerOutputMetadata?: Record<string, unknown>;
      files: ProposalFileInput[];
    },
  ) {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException("Documentation proposal not found");
    if (proposal.status !== "generating") {
      return this.get(proposal.workspaceId, proposal.id);
    }
    proposal.status = "pending_review";
    proposal.summaries = input.summaries ?? [];
    proposal.conflicts = input.conflicts ?? [];
    proposal.reviewNotes = input.reviewNotes ?? [];
    proposal.suggestedApplyActions = input.suggestedApplyActions ?? [];
    proposal.compilerInputMetadata = input.compilerInputMetadata ?? proposal.compilerInputMetadata;
    proposal.compilerOutputMetadata = input.compilerOutputMetadata ?? {};
    await this.proposalRepo.save(proposal);
    await this.proposalFileRepo.delete({ proposalId });
    const files = await this.proposalFileRepo.save(
      input.files.map((file) =>
        this.proposalFileRepo.create({
          workspaceId: proposal.workspaceId,
          proposalId,
          relativePath: file.relativePath,
          previousContent: file.previousContent,
          updatedContent: file.updatedContent,
          previousHash:
            file.previousContent === null ? null : sha256(file.previousContent),
          updatedHash: sha256(file.updatedContent),
          classification: file.classification,
          refreshPolicy: file.refreshPolicy,
          conflictStatus: file.conflictStatus ?? "none",
          requiresManualReview: file.requiresManualReview ?? false,
          metadata: file.metadata ?? {},
        }),
      ),
    );
    return { ...proposal, files };
  }

  async failGeneration(proposalId: string, error: unknown) {
    const message =
      error instanceof Error ? error.message : "Documentation proposal generation failed";
    await this.proposalRepo.update({ id: proposalId, status: "generating" }, {
      status: "failed",
      compilerOutputMetadata: {
        status: "failed",
        error: message,
      },
      reviewNotes: [{ path: null, message }],
    });
  }

  async markStaleGenerating(workspaceId: string) {
    const generating = await this.proposalRepo.find({
      where: {
        workspaceId,
        status: "generating",
      },
    });
    const now = Date.now();
    const staleIds = generating
      .filter((proposal) => {
        const timeoutAt = this.readTimestamp(proposal.compilerInputMetadata?.timeoutAt);
        if (timeoutAt !== null) return timeoutAt <= now;
        const queuedAt =
          this.readTimestamp(proposal.compilerInputMetadata?.queuedAt) ??
          proposal.createdAt.getTime();
        return queuedAt + this.staleGeneratingAfterMs <= now;
      })
      .map((proposal) => proposal.id);
    if (!staleIds.length) return;
    await this.proposalRepo.update(
      { id: In(staleIds), workspaceId, status: "generating" },
      {
        status: "failed",
        compilerOutputMetadata: {
          status: "failed",
          error:
            "Proposal generation timed out or was interrupted before completion. No files were written; start a new proposal generation.",
        },
        reviewNotes: [
          {
            path: null,
            message:
              "Proposal generation timed out or was interrupted before completion. No files were written; start a new proposal generation.",
          },
        ],
      },
    );
  }

  private readTimestamp(value: unknown) {
    if (typeof value !== "string") return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  async getFilesByIds(workspaceId: string, proposalId: string, fileIds: string[]) {
    if (!fileIds.length) return [];
    return this.proposalFileRepo.find({
      where: { workspaceId, proposalId, id: In(fileIds) },
      order: { relativePath: "ASC" },
    });
  }

  async markFilesApplied(fileIds: string[]) {
    if (!fileIds.length) return;
    await this.proposalFileRepo.update({ id: In(fileIds) }, { applyStatus: "applied" });
  }

  async markProposalApplied(id: string) {
    await this.proposalRepo.update(id, { status: "applied" });
  }
}
