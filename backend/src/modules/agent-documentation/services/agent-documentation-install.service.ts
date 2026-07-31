import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AgentDocumentationInstallEntity } from "../../../entities/agent-documentation-install.entity";
import { ApplicationDocumentationPackEntity } from "../../../entities/application-documentation-pack.entity";
import { DocumentationSyncMappingEntity } from "../../../entities/documentation-sync-mapping.entity";
import { AgentEntity } from "../../../entities/agent.entity";
import { BridgeService } from "../../bridge/bridge.service";
import { ClaudeCliService } from "../../claude/claude-cli.service";
import { type MarketplaceInstallRole } from "../../marketplace/marketplace-install-role";
import { LinkedApplicationService } from "./linked-application.service";
import { repoPackPathToWorkspaceFilename, sha256 } from "../agent-documentation.utils";

@Injectable()
export class AgentDocumentationInstallService {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly claudeCliService: ClaudeCliService,
    private readonly linkedApplicationService: LinkedApplicationService,
    @InjectRepository(AgentDocumentationInstallEntity)
    private readonly installRepo: Repository<AgentDocumentationInstallEntity>,
    @InjectRepository(ApplicationDocumentationPackEntity)
    private readonly packRepo: Repository<ApplicationDocumentationPackEntity>,
    @InjectRepository(DocumentationSyncMappingEntity)
    private readonly syncRepo: Repository<DocumentationSyncMappingEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
  ) {}

  list(workspaceId: string) {
    return this.installRepo.find({ where: { workspaceId }, order: { updatedAt: "DESC" } });
  }

  async install(workspaceId: string, input: { packId: string; agentId: string; role: MarketplaceInstallRole }) {
    const pack = await this.packRepo.findOne({ where: { id: input.packId, workspaceId } });
    if (!pack) throw new NotFoundException("Documentation pack not found");
    const agent = await this.agentRepo.findOne({ where: { id: input.agentId, workspaceId } });
    if (!agent) throw new NotFoundException("Agent not found");
    const app = await this.linkedApplicationService.get(workspaceId, pack.linkedApplicationId);
    const files = [];
    const sourcePaths: string[] = [];
    for (const manifestEntry of pack.generatedFileManifest ?? []) {
      const sourcePath = String(manifestEntry.path ?? "");
      const filename = repoPackPathToWorkspaceFilename(sourcePath, input.role);
      if (!filename) continue;
      sourcePaths.push(sourcePath);
    }
    const repoFiles =
      this.readEmbeddedMarketplaceFiles(pack, sourcePaths) ??
      (await this.readRepoFiles(workspaceId, app.repoKey, sourcePaths));
    for (const repoFile of repoFiles) {
      const filename = repoPackPathToWorkspaceFilename(repoFile.path, input.role);
      if (filename) files.push({ sourcePath: repoFile.path, filename, content: repoFile.content });
    }
    if (!files.length) {
      throw new BadRequestException(`No ${input.role} workspace router files are available`);
    }
    await this.bridgeService.writeAgentWorkspaceFiles(
      workspaceId,
      input.agentId,
      "",
      files.map((file) => ({ filename: file.filename, content: file.content })),
    );
    const manifest = files.map((file) => ({
      filename: file.filename,
      sourcePath: file.sourcePath,
      hash: sha256(file.content),
    }));
    const install =
      (await this.installRepo.findOne({
        where: { workspaceId, agentId: input.agentId, packId: input.packId, role: input.role },
      })) ??
      this.installRepo.create({
        workspaceId,
        agentId: input.agentId,
        packId: input.packId,
      });
    install.role = input.role;
    install.installedBlueprintVersions = pack.blueprintVersionSet;
    install.workspaceFileManifest = manifest;
    install.installStatus = "installed";
    install.driftStatus = "current";
    install.lastInstalledAt = new Date();
    await this.installRepo.save(install);
    await this.syncRepo.save(
      files.map((file) =>
        this.syncRepo.create({
          workspaceId,
          packId: input.packId,
          targetKind: "workspace",
          sourcePath: file.sourcePath,
          targetPath: `${input.agentId}/${file.filename}`,
          sourceHash: sha256(file.content),
          targetHash: sha256(file.content),
          status: "current",
        }),
      ),
    );
    return { install, installedFiles: files.map((file) => file.filename) };
  }

  private async readRepoFiles(
    workspaceId: string,
    repoKey: string | null,
    relativePaths: string[],
  ) {
    if (!relativePaths.length) return [];
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["files"],
      properties: {
        files: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["path", "content"],
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
    };
    const result = await this.claudeCliService.runStructuredPrompt<{
      files: Array<{ path: string; content: string }>;
    }>({
      workspaceId,
      repoKey: repoKey ?? undefined,
      schema,
      timeoutMs: 180000,
      maxTurns: 3,
      prompt: [
        "Read the exact relative files requested from the current repo and return their UTF-8 content as JSON.",
        "Do not modify files. Skip missing files.",
        JSON.stringify({ relativePaths }),
      ].join("\n\n"),
    });
    return result.output.files ?? [];
  }

  private readEmbeddedMarketplaceFiles(
    pack: ApplicationDocumentationPackEntity,
    relativePaths: string[],
  ): Array<{ path: string; content: string }> | null {
    if (!Array.isArray(pack.metadata?.marketplaceFiles)) return null;
    const embedded = Array.isArray(pack.metadata.marketplaceFiles)
      ? (pack.metadata.marketplaceFiles as Array<Record<string, unknown>>)
      : [];
    const byPath = new Map(
      embedded
        .map((file) => [String(file.path ?? ""), String(file.content ?? "")] as const)
        .filter(([path]) => path),
    );
    return relativePaths
      .map((path) => {
        const content = byPath.get(path);
        return content === undefined ? null : { path, content };
      })
      .filter((file): file is { path: string; content: string } => Boolean(file));
  }
}
