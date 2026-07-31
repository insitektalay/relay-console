import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApplicationDocumentationPackEntity } from "../../../entities/application-documentation-pack.entity";
import { DocumentationProposalFileEntity } from "../../../entities/documentation-proposal-file.entity";
import { LinkedApplicationService } from "./linked-application.service";
import { DocumentationProposalService } from "./documentation-proposal.service";
import {
  assertSafeRelativePath,
  isAllowedRepoPackPath,
  isMutablePath,
  sha256,
} from "../agent-documentation.utils";
import { AGENT_DOCS_COMPILER_VERSION, AGENT_DOCS_PACK_PATH } from "../agent-documentation.constants";
import { ClaudeCliService } from "../../claude/claude-cli.service";

@Injectable()
export class DocumentationApplyService {
  constructor(
    private readonly linkedApplicationService: LinkedApplicationService,
    private readonly proposalService: DocumentationProposalService,
    private readonly claudeCliService: ClaudeCliService,
    @InjectRepository(ApplicationDocumentationPackEntity)
    private readonly packRepo: Repository<ApplicationDocumentationPackEntity>,
  ) {}

  async applySelected(workspaceId: string, proposalId: string, fileIds: string[]) {
    const proposal = await this.proposalService.getEntity(workspaceId, proposalId);
    const app = await this.linkedApplicationService.get(workspaceId, proposal.linkedApplicationId);
    const files = await this.proposalService.getFilesByIds(workspaceId, proposalId, fileIds);
    if (files.length !== fileIds.length) {
      throw new BadRequestException("One or more selected proposal files were not found");
    }
    for (const file of files) this.assertApplyAllowed(file);
    await this.applyFilesOnBridgeRepo(workspaceId, app.repoKey, files);
    await this.proposalService.markFilesApplied(files.map((file) => file.id));
    await this.proposalService.markProposalApplied(proposal.id);
    const scan = await this.linkedApplicationService.scanRepo(
      workspaceId,
      app.repoKey,
    );
    const manifest = files.map((file) => ({
      path: file.relativePath,
      hash: file.updatedHash,
      classification: file.classification,
      refreshPolicy: file.refreshPolicy,
    }));
    const pack = await this.packRepo.save(
      this.packRepo.create({
        workspaceId,
        linkedApplicationId: app.id,
        packPath: AGENT_DOCS_PACK_PATH,
        blueprintVersionSet:
          (proposal.compilerInputMetadata?.blueprintVersions as Array<Record<string, unknown>>) ?? [],
        compilerVersion: AGENT_DOCS_COMPILER_VERSION,
        repoCommit: scan.currentGitCommit,
        repoDirtyState: scan.dirtyState,
        packHash: sha256(JSON.stringify(manifest)),
        generatedFileManifest: manifest,
        reviewStatus: "applied",
        syncStatus: "not_synced",
        metadata: { proposalId: proposal.id },
      }),
    );
    return { proposalId, pack, appliedFiles: files.map((file) => file.relativePath) };
  }

  private async applyFilesOnBridgeRepo(
    workspaceId: string,
    repoKey: string | null,
    files: DocumentationProposalFileEntity[],
  ) {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["status", "writtenFiles", "conflicts"],
      properties: {
        status: { type: "string" },
        writtenFiles: { type: "array", items: { type: "string" } },
        conflicts: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["path", "message"],
            properties: {
              path: { type: ["string", "null"] },
              message: { type: "string" },
            },
          },
        },
      },
    };
    const prompt = [
      "You are applying already-approved ClawChat documentation proposal files.",
      "Write only the exact files listed in the JSON payload. Do not modify any other files.",
      "Before writing each file, compute the current sha256 hash of its existing content. If the file is missing, current hash is null.",
      "If the current hash does not equal expectedPreviousHash, do not write that file and return a conflict.",
      "Create parent directories as needed. Return JSON only.",
      JSON.stringify({
        files: files.map((file) => ({
          relativePath: file.relativePath,
          expectedPreviousHash: file.previousHash,
          updatedContent: file.updatedContent,
        })),
      }),
    ].join("\n\n");
    const result = await this.claudeCliService.runStructuredPrompt<{
      status: string;
      writtenFiles: string[];
      conflicts: Array<Record<string, unknown>>;
    }>({
      workspaceId,
      prompt,
      schema,
      repoKey: repoKey ?? undefined,
      timeoutMs: 180000,
      maxTurns: 4,
    });
    if (result.output.conflicts?.length || result.output.status !== "applied") {
      throw new BadRequestException(
        `Documentation apply failed: ${JSON.stringify(result.output.conflicts ?? [])}`,
      );
    }
  }

  private assertApplyAllowed(file: DocumentationProposalFileEntity) {
    const relativePath = assertSafeRelativePath(file.relativePath);
    if (!isAllowedRepoPackPath(relativePath)) {
      throw new BadRequestException(`Cannot apply path outside generated pack: ${relativePath}`);
    }
    if (isMutablePath(relativePath) || file.classification === "mutable_state") {
      throw new BadRequestException(`Cannot apply mutable operational state through docs refresh: ${relativePath}`);
    }
    if (file.refreshPolicy === "never_generate" || file.refreshPolicy === "protected_user_override") {
      throw new BadRequestException(`Cannot apply protected generated path: ${relativePath}`);
    }
  }
}
