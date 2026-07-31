import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LinkedApplicationEntity } from "../../../entities/linked-application.entity";
import {
  CreateLinkedApplicationDto,
  UpdateLinkedApplicationDto,
} from "../dto/agent-documentation.dto";
import { AGENT_DOCS_PACK_PATH } from "../agent-documentation.constants";
import { slugify } from "../agent-documentation.utils";
import { ClaudeCliService } from "../../claude/claude-cli.service";

@Injectable()
export class LinkedApplicationService {
  constructor(
    @InjectRepository(LinkedApplicationEntity)
    private readonly linkedApplicationRepo: Repository<LinkedApplicationEntity>,
    private readonly claudeCliService: ClaudeCliService,
  ) {}

  list(workspaceId: string) {
    return this.linkedApplicationRepo.find({
      where: { workspaceId },
      order: { updatedAt: "DESC" },
    });
  }

  async get(workspaceId: string, id: string) {
    const app = await this.linkedApplicationRepo.findOne({
      where: { id, workspaceId },
    });
    if (!app) throw new NotFoundException("Linked application not found");
    return app;
  }

  async create(workspaceId: string, userId: string, dto: CreateLinkedApplicationDto) {
    const repoPath = dto.repoPath.trim();
    if (!repoPath) throw new BadRequestException("Repo path is required");
    const slug = slugify(dto.slug || dto.name);
    const existing = await this.linkedApplicationRepo.findOne({
      where: { workspaceId, slug },
    });
    if (existing) {
      throw new BadRequestException(
        `A linked application named "${existing.name}" already exists. Use its card actions instead of linking it again.`,
      );
    }
    const app = this.linkedApplicationRepo.create({
      workspaceId,
      createdByUserId: userId,
      name: dto.name.trim(),
      slug,
      repoPath,
      repoKey: dto.repoKey?.trim() || null,
      generatedDocsPath: AGENT_DOCS_PACK_PATH,
      currentGitCommit: null,
      dirtyState: false,
      frameworkMetadata: { detected: false, pendingBridgeScan: true },
      apiStyleMetadata: { pendingBridgeScan: true },
      lastScannedAt: null,
      agentOperableStatus: "pending_scan",
    });
    return this.linkedApplicationRepo.save(app);
  }

  async update(workspaceId: string, id: string, dto: UpdateLinkedApplicationDto) {
    const app = await this.get(workspaceId, id);
    if (dto.name !== undefined) app.name = dto.name.trim();
    if (dto.slug !== undefined) app.slug = slugify(dto.slug);
    if (dto.repoKey !== undefined) app.repoKey = dto.repoKey?.trim() || null;
    if (dto.repoPath !== undefined) {
      app.repoPath = dto.repoPath.trim();
      if (!app.repoPath) throw new BadRequestException("Repo path is required");
    }
    const scan = await this.scanRepo(workspaceId, app.repoKey);
    Object.assign(app, scan);
    return this.linkedApplicationRepo.save(app);
  }

  async delete(workspaceId: string, id: string) {
    const app = await this.get(workspaceId, id);
    await this.linkedApplicationRepo.delete(app.id);
    return { success: true, id };
  }

  async scan(workspaceId: string, id: string) {
    const app = await this.get(workspaceId, id);
    const scan = await this.scanRepo(workspaceId, app.repoKey);
    Object.assign(app, scan);
    return this.linkedApplicationRepo.save(app);
  }

  async scanRepo(workspaceId: string, repoKey?: string | null) {
    const scan = await this.runRepoProbe(workspaceId, repoKey);
    return {
      currentGitCommit: scan.commit,
      dirtyState: scan.dirtyState,
      frameworkMetadata: scan.frameworkMetadata,
      apiStyleMetadata: scan.apiStyleMetadata,
      lastScannedAt: new Date(),
      agentOperableStatus: scan.reachable ? "scan_available" : "unreachable",
    };
  }

  async getRepoState(workspaceId: string, repoKey?: string | null) {
    const scan = await this.runRepoProbe(workspaceId, repoKey);
    return {
      commit: scan.commit,
      status: scan.status,
    };
  }

  private async runRepoProbe(workspaceId: string, repoKey?: string | null) {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["reachable", "commit", "status", "dirtyState", "frameworkMetadata", "apiStyleMetadata"],
      properties: {
        reachable: { type: "boolean" },
        commit: { type: ["string", "null"] },
        status: { type: "string" },
        dirtyState: { type: "boolean" },
        frameworkMetadata: {
          type: "object",
          additionalProperties: false,
          required: ["detected", "next", "nest", "express", "react", "packageManager"],
          properties: {
            detected: { type: "boolean" },
            next: { type: "boolean" },
            nest: { type: "boolean" },
            express: { type: "boolean" },
            react: { type: "boolean" },
            packageManager: { type: ["string", "null"] },
          },
        },
        apiStyleMetadata: {
          type: "object",
          additionalProperties: false,
          required: ["hasPackageJson", "hasOpenApi", "hasAppDirectory", "hasSrcDirectory", "notes"],
          properties: {
            hasPackageJson: { type: "boolean" },
            hasOpenApi: { type: "boolean" },
            hasAppDirectory: { type: "boolean" },
            hasSrcDirectory: { type: "boolean" },
            notes: { type: "string" },
          },
        },
      },
    };
    const prompt = [
      "You are probing a linked application repo for ClawChat.",
      "Return JSON only. Do not modify files.",
      "Inspect the current working directory.",
      "Report whether it is reachable, the current git commit if any, git status --porcelain output, dirtyState, framework metadata from package.json if present, and basic API style metadata from top-level files/folders. Use false/null/empty string for unavailable fields.",
    ].join("\n");
    try {
      const result = await this.claudeCliService.runStructuredPrompt<{
        reachable: boolean;
        commit: string | null;
        status: string;
        dirtyState: boolean;
        frameworkMetadata: Record<string, unknown>;
        apiStyleMetadata: Record<string, unknown>;
      }>({
        workspaceId,
        prompt,
        schema,
        repoKey: repoKey ?? undefined,
        timeoutMs: 120000,
        maxTurns: 3,
      });
      return result.output;
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? `Linked application repo path is not reachable by the bridge: ${error.message}`
          : "Linked application repo path is not reachable by the bridge",
      );
    }
  }
}
