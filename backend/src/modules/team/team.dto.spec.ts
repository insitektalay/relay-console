import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { TeamMemoryItemType } from "../../entities/team-memory-item.entity";
import {
  CreateTeamDto,
  CreateTeamMemoryItemDto,
  UpdateTeamDto,
  UpdateTeamMemoryItemDto,
} from "./dto/team.dto";

const strictPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

function bodyMetadata(metatype: ArgumentMetadata["metatype"]): ArgumentMetadata {
  return { type: "body", metatype, data: undefined };
}

describe("team and memory mutation DTOs", () => {
  it.each(["id", "createdAt", "updatedAt"])(
    "rejects server-owned team create field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          {
            name: "Escalations",
            departmentId: "department-1",
            [field]: "attacker-controlled",
          },
          bodyMetadata(CreateTeamDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it.each(["id", "departmentId", "createdAt", "updatedAt"])(
    "rejects immutable team update field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          { name: "Escalations", [field]: "attacker-controlled" },
          bodyMetadata(UpdateTeamDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it.each(["id", "teamId", "createdById", "createdAt", "updatedAt"])(
    "rejects server-owned memory create field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          {
            title: "Runbook",
            content: "Escalate failures",
            type: TeamMemoryItemType.SOP,
            [field]: "attacker-controlled",
          },
          bodyMetadata(CreateTeamMemoryItemDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it.each(["id", "teamId", "createdById", "createdAt", "updatedAt"])(
    "rejects immutable memory update field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          { content: "Updated runbook", [field]: "attacker-controlled" },
          bodyMetadata(UpdateTeamMemoryItemDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
});
