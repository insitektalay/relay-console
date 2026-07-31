import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ScheduleEntity } from "../../entities/schedule.entity";
import { ShiftRuleEntity } from "../../entities/shift-rule.entity";
import { AvailabilityStateEntity } from "../../entities/availability-state.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { ResourceAccessService } from "../resource-access/resource-access.service";

@Injectable()
export class SchedulingService {
  constructor(
    @InjectRepository(ScheduleEntity)
    private readonly scheduleRepo: Repository<ScheduleEntity>,

    @InjectRepository(ShiftRuleEntity)
    private readonly shiftRuleRepo: Repository<ShiftRuleEntity>,

    @InjectRepository(AvailabilityStateEntity)
    private readonly availabilityRepo: Repository<AvailabilityStateEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async findAll(workspaceId: string, userId: string) {
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId);
    const agents = await this.agentRepo.find({
      where: { workspaceId, lifecycleStatus: "active" },
      select: ["id"],
    });
    const agentIds = agents.map((a) => a.id);
    if (!agentIds.length) return [];

    const schedules = await this.scheduleRepo
      .createQueryBuilder("s")
      .where('s."agentId" IN (:...agentIds)', { agentIds })
      .leftJoinAndSelect("s.shiftRules", "shifts")
      .getMany();

    return schedules;
  }

  async findScheduleByAgent(
    agentId: string,
    userId: string,
  ): Promise<ScheduleEntity | null> {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId);
    return this.scheduleRepo.findOne({
      where: { agentId },
      relations: ["shiftRules"],
    });
  }

  async findScheduleByTeam(teamId: string): Promise<ScheduleEntity | null> {
    return this.scheduleRepo.findOne({
      where: { teamId },
      relations: ["shiftRules"],
    });
  }

  async createOrUpdate(
    agentId: string,
    mode: string,
    shifts: any[],
    timezone?: string,
    userId?: string,
  ) {
    if (userId) {
      await this.resourceAccessService.ensureAgentAdminAccess(agentId, userId);
    }
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (
      !agent ||
      (agent.lifecycleStatus && agent.lifecycleStatus !== "active")
    ) {
      throw new ConflictException("AGENT_LIFECYCLE_INELIGIBLE");
    }
    let schedule = await this.scheduleRepo.findOne({ where: { agentId } });

    if (!schedule) {
      schedule = this.scheduleRepo.create({
        agentId,
        mode,
        timezone: timezone || "UTC",
      });
    } else {
      schedule.mode = mode;
      if (timezone) schedule.timezone = timezone;
    }

    const saved = await this.scheduleRepo.save(schedule);
    await this.shiftRuleRepo.delete({ scheduleId: saved.id });

    if (shifts?.length) {
      const rules = shifts.map((s) =>
        this.shiftRuleRepo.create({
          scheduleId: saved.id,
          dayOfWeek: s.day ?? s.dayOfWeek,
          startTime:
            s.startTime ||
            `${String(s.startHour ?? 0).padStart(2, "0")}:${String(s.startMinute ?? 0).padStart(2, "0")}`,
          endTime:
            s.endTime ||
            `${String(s.endHour ?? 0).padStart(2, "0")}:${String(s.endMinute ?? 0).padStart(2, "0")}`,
        }),
      );
      await this.shiftRuleRepo.save(rules);
    }

    return this.scheduleRepo.findOne({
      where: { agentId },
      relations: ["shiftRules"],
    });
  }

  async createSchedule(data: Partial<ScheduleEntity>): Promise<ScheduleEntity> {
    const schedule = this.scheduleRepo.create(data);
    return this.scheduleRepo.save(schedule);
  }

  async updateSchedule(
    id: string,
    data: Partial<ScheduleEntity>,
  ): Promise<ScheduleEntity> {
    await this.scheduleRepo.update(id, data);
    const schedule = await this.scheduleRepo.findOne({
      where: { id },
      relations: ["shiftRules"],
    });
    if (!schedule) throw new NotFoundException(`Schedule ${id} not found`);
    return schedule;
  }

  async addShiftRule(
    scheduleId: string,
    data: Partial<ShiftRuleEntity>,
  ): Promise<ShiftRuleEntity> {
    const rule = this.shiftRuleRepo.create({ ...data, scheduleId });
    return this.shiftRuleRepo.save(rule);
  }

  async removeShiftRule(ruleId: string): Promise<void> {
    await this.shiftRuleRepo.delete(ruleId);
  }

  async isAgentOnDuty(agentId: string): Promise<boolean> {
    const schedule = await this.scheduleRepo.findOne({
      where: { agentId },
      relations: ["shiftRules"],
    });
    if (!schedule) return false;
    if (schedule.mode === "always_on") return true;
    if (schedule.mode === "on_demand") return false;

    const now = new Date();
    const currentDay = now.getDay(); // 0=Sun, 6=Sat
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return (schedule.shiftRules || []).some(
      (r) =>
        r.dayOfWeek === currentDay &&
        r.isActive &&
        r.startTime <= currentTime &&
        r.endTime > currentTime,
    );
  }

  async getAvailabilityState(
    agentId: string,
    userId: string,
  ): Promise<AvailabilityStateEntity | null> {
    await this.resourceAccessService.ensureAgentAccess(agentId, userId);
    return this.availabilityRepo.findOne({
      where: { agentId },
      order: { createdAt: "DESC" },
    });
  }

  async setAvailabilityState(
    agentId: string,
    data: Partial<AvailabilityStateEntity>,
  ): Promise<AvailabilityStateEntity> {
    const state = this.availabilityRepo.create({
      ...data,
      agentId,
      since: new Date(),
    });
    return this.availabilityRepo.save(state);
  }
}
