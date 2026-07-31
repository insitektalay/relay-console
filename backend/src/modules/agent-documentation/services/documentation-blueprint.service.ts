import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { DocumentationBlueprintEntity } from "../../../entities/documentation-blueprint.entity";
import { SYSTEM_BLUEPRINT_ASSETS } from "../system-blueprints/manifest";
import {
  ForkBlueprintDto,
  UpdateBlueprintDto,
} from "../dto/agent-documentation.dto";

@Injectable()
export class DocumentationBlueprintService implements OnModuleInit {
  constructor(
    @InjectRepository(DocumentationBlueprintEntity)
    private readonly blueprintRepo: Repository<DocumentationBlueprintEntity>,
  ) {}

  async onModuleInit() {
    await this.upsertSystemBlueprints();
  }

  async upsertSystemBlueprints() {
    for (const asset of SYSTEM_BLUEPRINT_ASSETS) {
      const existing = await this.blueprintRepo.findOne({
        where: {
          workspaceId: IsNull(),
          systemKey: asset.systemKey,
          version: asset.version,
        },
      });
      const blueprint =
        existing ??
        this.blueprintRepo.create({
          workspaceId: null,
          createdByUserId: null,
          forkedFromBlueprintId: null,
          systemKey: asset.systemKey,
          version: asset.version,
          isSystem: true,
          protected: true,
          status: "published",
        });
      blueprint.name = asset.name;
      blueprint.compilerPromptVersion = asset.compilerPromptVersion;
      blueprint.content = asset.content;
      blueprint.changelog = asset.changelog;
      blueprint.metadata = { bundled: true };
      await this.blueprintRepo.save(blueprint);
    }
  }

  list(workspaceId: string) {
    return this.blueprintRepo.find({
      where: [{ workspaceId: IsNull() }, { workspaceId }],
      order: { isSystem: "DESC", systemKey: "ASC", version: "DESC" },
    });
  }

  async getVisible(workspaceId: string, id: string) {
    const blueprint = await this.blueprintRepo.findOne({ where: { id } });
    if (!blueprint || (blueprint.workspaceId && blueprint.workspaceId !== workspaceId)) {
      throw new NotFoundException("Documentation blueprint not found");
    }
    return blueprint;
  }

  async getPublishedDefaults() {
    return this.blueprintRepo.find({
      where: { workspaceId: IsNull(), isSystem: true, status: "published" },
      order: { systemKey: "ASC" },
    });
  }

  async fork(workspaceId: string, userId: string, id: string, dto: ForkBlueprintDto) {
    const source = await this.getVisible(workspaceId, id);
    const fork = this.blueprintRepo.create({
      workspaceId,
      createdByUserId: userId,
      forkedFromBlueprintId: source.id,
      systemKey: `${source.systemKey}-fork`,
      name: dto.name?.trim() || `${source.name} Fork`,
      version: "1.0.0",
      status: "draft",
      isSystem: false,
      protected: false,
      compilerPromptVersion: source.compilerPromptVersion,
      content: source.content,
      changelog: `Forked from ${source.name} ${source.version}`,
      metadata: { forkedFromSystemKey: source.systemKey },
    });
    return this.blueprintRepo.save(fork);
  }

  async update(workspaceId: string, id: string, dto: UpdateBlueprintDto) {
    const blueprint = await this.getVisible(workspaceId, id);
    if (blueprint.protected || blueprint.isSystem) {
      throw new BadRequestException("System blueprints are protected. Fork before editing.");
    }
    if (dto.name !== undefined) blueprint.name = dto.name.trim();
    if (dto.content !== undefined) blueprint.content = dto.content;
    if (dto.changelog !== undefined) blueprint.changelog = dto.changelog;
    return this.blueprintRepo.save(blueprint);
  }

  async setStatus(workspaceId: string, id: string, status: "published" | "retired") {
    const blueprint = await this.getVisible(workspaceId, id);
    if (blueprint.protected && status !== "published") {
      throw new BadRequestException("System blueprints cannot be retired from a workspace");
    }
    blueprint.status = status;
    return this.blueprintRepo.save(blueprint);
  }
}
