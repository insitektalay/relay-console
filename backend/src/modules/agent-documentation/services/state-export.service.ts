import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AgentDocumentationStateSnapshotEntity } from "../../../entities/agent-documentation-state.entity";
import { ApplicationDocumentationPackEntity } from "../../../entities/application-documentation-pack.entity";
import { BridgeService } from "../../bridge/bridge.service";
import { ExportStateDto } from "../dto/agent-documentation.dto";

@Injectable()
export class StateExportService {
  constructor(
    private readonly bridgeService: BridgeService,
    @InjectRepository(AgentDocumentationStateSnapshotEntity)
    private readonly stateRepo: Repository<AgentDocumentationStateSnapshotEntity>,
    @InjectRepository(ApplicationDocumentationPackEntity)
    private readonly packRepo: Repository<ApplicationDocumentationPackEntity>,
  ) {}

  async export(workspaceId: string, dto: ExportStateDto) {
    const snapshot = await this.stateRepo.save(
      this.stateRepo.create({
        workspaceId,
        packId: dto.packId ?? null,
        agentId: dto.agentId ?? null,
        snapshotKind: dto.snapshotKind?.trim() || "manual",
        state: dto.state ?? {},
        exportStatus: "not_exported",
      }),
    );
    if (dto.exportToLibrary && dto.packId) {
      const pack = await this.packRepo.findOne({ where: { id: dto.packId, workspaceId } });
      if (!pack) throw new NotFoundException("Documentation pack not found");
      if (pack.libraryTargetFolder) {
        const filename = `${snapshot.snapshotKind}-${snapshot.id}.json`;
        await this.bridgeService.writeLibraryFiles(workspaceId, `${pack.libraryTargetFolder}/_state`, [
          { filename, content: JSON.stringify(snapshot.state, null, 2) },
        ]);
        snapshot.exportedLibraryPath = `${pack.libraryTargetFolder}/_state/${filename}`;
        snapshot.exportStatus = "exported";
        await this.stateRepo.save(snapshot);
      }
    }
    return snapshot;
  }
}
