import * as path from "node:path";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AgentDocumentationInstallEntity } from "../../../entities/agent-documentation-install.entity";
import { ApplicationDocumentationPackEntity } from "../../../entities/application-documentation-pack.entity";
import { DocumentationSyncMappingEntity } from "../../../entities/documentation-sync-mapping.entity";
import { LinkedApplicationService } from "./linked-application.service";
import { BridgeService } from "../../bridge/bridge.service";
import { ClaudeCliService } from "../../claude/claude-cli.service";
import { repoPackPathToLibraryPath, sha256 } from "../agent-documentation.utils";

@Injectable()
export class DocumentationDriftService {
  constructor(
    private readonly linkedApplicationService: LinkedApplicationService,
    private readonly bridgeService: BridgeService,
    private readonly claudeCliService: ClaudeCliService,
    @InjectRepository(ApplicationDocumentationPackEntity)
    private readonly packRepo: Repository<ApplicationDocumentationPackEntity>,
    @InjectRepository(DocumentationSyncMappingEntity)
    private readonly syncRepo: Repository<DocumentationSyncMappingEntity>,
    @InjectRepository(AgentDocumentationInstallEntity)
    private readonly installRepo: Repository<AgentDocumentationInstallEntity>,
  ) {}

  async dashboard(workspaceId: string) {
    const packs = await this.packRepo.find({ where: { workspaceId }, order: { updatedAt: "DESC" } });
    const installs = await this.installRepo.find({ where: { workspaceId }, order: { updatedAt: "DESC" } });
    const results = [];
    for (const pack of packs) {
      const app = await this.linkedApplicationService.get(workspaceId, pack.linkedApplicationId).catch(() => null);
      if (!app) {
        results.push({ kind: "app_repo", packId: pack.id, status: "app_repo_not_reachable" });
        continue;
      }
      const repoState = await this.linkedApplicationService.getRepoState(
        workspaceId,
        app.repoKey,
      );
      const repoStale = repoState.commit !== pack.repoCommit || Boolean(repoState.status) !== pack.repoDirtyState;
      const generatedFiles = await this.checkGeneratedFiles(
        workspaceId,
        app.repoKey,
        pack,
      );
      const library = await this.checkLibrary(workspaceId, pack);
      results.push({
        kind: "pack",
        packId: pack.id,
        linkedApplicationId: app.id,
        status: repoStale || generatedFiles.some((item) => item.status !== "current") ? "stale" : "current",
        repoStale,
        generatedFiles,
        library,
      });
    }
    return { packs: results, installs };
  }

  private async checkGeneratedFiles(
    workspaceId: string,
    repoKey: string | null,
    pack: ApplicationDocumentationPackEntity,
  ) {
    const manifest = pack.generatedFileManifest ?? [];
    const relativePaths = manifest.map((entry) => String(entry.path ?? "")).filter(Boolean);
    const hashes = await this.readRepoHashes(workspaceId, repoKey, relativePaths);
    return manifest.map((entry) => {
      const relativePath = String(entry.path ?? "");
      const expectedHash = String(entry.hash ?? "");
      const actualHash = hashes.get(relativePath) ?? null;
      return {
        path: relativePath,
        status:
          actualHash === null
            ? "missing_expected_file"
            : actualHash === expectedHash
              ? "current"
              : "generated_file_manually_edited",
      };
    });
  }

  private async checkLibrary(workspaceId: string, pack: ApplicationDocumentationPackEntity) {
    if (!pack.libraryTargetFolder) return { status: "not_synced" };
    const mappings = await this.syncRepo.find({ where: { workspaceId, packId: pack.id, targetKind: "library" } });
    const checks = [];
    for (const mapping of mappings) {
      const libraryRelative = repoPackPathToLibraryPath(mapping.sourcePath);
      if (!libraryRelative) continue;
      const folder = path.posix.dirname(`${pack.libraryTargetFolder}/${libraryRelative}`);
      const filename = path.posix.basename(libraryRelative);
      const read = await this.bridgeService.readLibraryFile(workspaceId, folder, filename).catch(() => null);
      checks.push({
        path: mapping.targetPath,
        status: !read ? "broken_sync_library_path" : sha256(read.content) === mapping.targetHash ? "current" : "library_out_of_sync",
      });
    }
    return { status: checks.some((item) => item.status !== "current") ? "stale" : "current", files: checks };
  }

  private async readRepoHashes(
    workspaceId: string,
    repoKey: string | null,
    relativePaths: string[],
  ) {
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
            required: ["path", "hash"],
            properties: {
              path: { type: "string" },
              hash: { type: ["string", "null"] },
            },
          },
        },
      },
    };
    const result = await this.claudeCliService.runStructuredPrompt<{
      files: Array<{ path: string; hash: string | null }>;
    }>({
      workspaceId,
      repoKey: repoKey ?? undefined,
      schema,
      timeoutMs: 180000,
      maxTurns: 3,
      prompt: [
        "For each requested relative path in the current repo, return the sha256 hash of its UTF-8 content, or null if missing.",
        "Do not modify files. Return JSON only.",
        JSON.stringify({ relativePaths }),
      ].join("\n\n"),
    });
    return new Map((result.output.files ?? []).map((file) => [file.path, file.hash] as const));
  }
}
