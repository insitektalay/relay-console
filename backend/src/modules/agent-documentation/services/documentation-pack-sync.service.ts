import * as path from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApplicationDocumentationPackEntity } from "../../../entities/application-documentation-pack.entity";
import { DocumentationSyncMappingEntity } from "../../../entities/documentation-sync-mapping.entity";
import { BridgeService } from "../../bridge/bridge.service";
import { ClaudeCliService } from "../../claude/claude-cli.service";
import { LinkedApplicationService } from "./linked-application.service";
import { repoPackPathToLibraryPath, sha256, slugify } from "../agent-documentation.utils";

@Injectable()
export class DocumentationPackSyncService {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly claudeCliService: ClaudeCliService,
    private readonly linkedApplicationService: LinkedApplicationService,
    @InjectRepository(ApplicationDocumentationPackEntity)
    private readonly packRepo: Repository<ApplicationDocumentationPackEntity>,
    @InjectRepository(DocumentationSyncMappingEntity)
    private readonly syncRepo: Repository<DocumentationSyncMappingEntity>,
  ) {}

  async listPacks(workspaceId: string) {
    return this.packRepo.find({ where: { workspaceId }, order: { updatedAt: "DESC" } });
  }

  async getPack(workspaceId: string, packId: string) {
    const pack = await this.packRepo.findOne({ where: { id: packId, workspaceId } });
    if (!pack) throw new NotFoundException("Documentation pack not found");
    return pack;
  }

  async syncToLibrary(workspaceId: string, packId: string, targetFolder?: string) {
    const pack = await this.getPack(workspaceId, packId);
    const app = await this.linkedApplicationService.get(workspaceId, pack.linkedApplicationId);
    const folder = (targetFolder?.trim() || slugify(app.slug || app.name)).replace(/^\/+|\/+$/g, "");
    const files = [];
    const sourcePaths: string[] = [];
    for (const manifestEntry of pack.generatedFileManifest ?? []) {
      const sourcePath = String(manifestEntry.path ?? "");
      const libraryPath = repoPackPathToLibraryPath(sourcePath);
      if (!libraryPath || sourcePath.endsWith("pack_manifest.json")) continue;
      sourcePaths.push(sourcePath);
    }
    const repoFiles =
      this.readEmbeddedMarketplaceFiles(pack, sourcePaths) ??
      (await this.readRepoFiles(workspaceId, app.repoKey, sourcePaths));
    for (const repoFile of repoFiles) {
      const libraryPath = repoPackPathToLibraryPath(repoFile.path);
      if (!libraryPath) continue;
      files.push({ sourcePath: repoFile.path, libraryPath, content: repoFile.content });
    }
    if (!files.length) throw new BadRequestException("No library files are available to sync");
    const filesByFolder = new Map<string, Array<{ filename: string; content: string }>>();
    for (const file of files) {
      const dirname = path.posix.dirname(file.libraryPath);
      const targetFolder =
        dirname === "." ? folder : `${folder}/${dirname}`.replace(/\/+/g, "/");
      const filename = path.posix.basename(file.libraryPath);
      const bucket = filesByFolder.get(targetFolder) ?? [];
      bucket.push({ filename, content: file.content });
      filesByFolder.set(targetFolder, bucket);
    }
    for (const [targetFolder, folderFiles] of filesByFolder.entries()) {
      await this.bridgeService.writeLibraryFiles(workspaceId, targetFolder, folderFiles);
    }
    await this.syncRepo.delete({ workspaceId, packId, targetKind: "library" });
    await this.syncRepo.save(
      files.map((file) =>
        this.syncRepo.create({
          workspaceId,
          packId,
          targetKind: "library",
          sourcePath: file.sourcePath,
          targetPath: `${folder}/${file.libraryPath}`,
          sourceHash: sha256(file.content),
          targetHash: sha256(file.content),
          status: "current",
        }),
      ),
    );
    pack.syncStatus = "synced";
    pack.libraryTargetFolder = folder;
    await this.packRepo.save(pack);
    return { pack, syncedFiles: files.map((file) => `${folder}/${file.libraryPath}`) };
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
