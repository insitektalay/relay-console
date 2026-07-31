import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";

@Injectable()
export class RuntimeBindingService {
  constructor(
    @InjectRepository(RuntimeBindingEntity)
    private readonly runtimeBindingRepo: Repository<RuntimeBindingEntity>,
  ) {}

  async create(
    data: Partial<RuntimeBindingEntity>,
  ): Promise<RuntimeBindingEntity> {
    return this.runtimeBindingRepo.save(this.runtimeBindingRepo.create(data));
  }

  async upsertByAgentId(
    agentId: string,
    data: Partial<RuntimeBindingEntity>,
  ): Promise<RuntimeBindingEntity> {
    const existing = await this.findByAgentId(agentId);
    const binding = existing ?? this.runtimeBindingRepo.create({ agentId });
    Object.assign(binding, data, { agentId });
    return this.runtimeBindingRepo.save(binding);
  }

  async findById(id: string): Promise<RuntimeBindingEntity | null> {
    return this.runtimeBindingRepo.findOne({ where: { id } });
  }

  async findByAgentId(agentId: string): Promise<RuntimeBindingEntity | null> {
    return this.runtimeBindingRepo.findOne({ where: { agentId } });
  }

  async findEnabledByAgentId(
    agentId: string,
  ): Promise<RuntimeBindingEntity | null> {
    return this.runtimeBindingRepo
      .createQueryBuilder("binding")
      .innerJoin("agents", "agent", 'agent.id = binding."agentId"')
      .where('binding."agentId" = :agentId', { agentId })
      .andWhere('binding."isEnabled" = true')
      .andWhere('agent."lifecycleStatus" = :lifecycleStatus', {
        lifecycleStatus: "active",
      })
      .getOne();
  }

  async findByAgentIds(agentIds: string[]): Promise<RuntimeBindingEntity[]> {
    if (!agentIds.length) return [];
    return this.runtimeBindingRepo.find({
      where: { agentId: In(agentIds) },
    });
  }

  async findEnabledByAgentIds(
    agentIds: string[],
  ): Promise<RuntimeBindingEntity[]> {
    if (!agentIds.length) return [];
    return this.runtimeBindingRepo
      .createQueryBuilder("binding")
      .innerJoin("agents", "agent", 'agent.id = binding."agentId"')
      .where('binding."agentId" IN (:...agentIds)', { agentIds })
      .andWhere('binding."isEnabled" = true')
      .andWhere('agent."lifecycleStatus" = :lifecycleStatus', {
        lifecycleStatus: "active",
      })
      .getMany();
  }

  async listByWorkspace(workspaceId: string): Promise<RuntimeBindingEntity[]> {
    return this.runtimeBindingRepo.find({
      where: { workspaceId },
      order: { createdAt: "ASC" },
    });
  }

  async requireEnabledByAgentId(
    agentId: string,
  ): Promise<RuntimeBindingEntity> {
    const binding = await this.findEnabledByAgentId(agentId);
    if (!binding) {
      throw new NotFoundException(
        `Runtime binding not found or disabled for agent ${agentId}`,
      );
    }
    return binding;
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    await this.runtimeBindingRepo.delete({ agentId });
  }
}
