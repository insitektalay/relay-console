import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import {
  CreateIncidentDto,
  UpdateIncidentDto,
} from "./dto/incident.dto";
import { CreateWorkLogDto } from "../worklogs/dto/worklogs.dto";

const strictPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

function bodyMetadata(metatype: ArgumentMetadata["metatype"]): ArgumentMetadata {
  return { type: "body", metatype, data: undefined };
}

describe("strict tenant mutation DTOs", () => {
  it.each(["id", "status", "createdAt", "resolvedAt", "resolutionNotes"])(
    "rejects server-owned incident create field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          {
            workspaceId: "workspace-a",
            title: "Database alarm",
            description: "Elevated failures",
            severity: "high",
            [field]: "attacker-controlled",
          },
          bodyMetadata(CreateIncidentDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it.each(["id", "workspaceId", "status", "createdAt", "resolvedAt"])(
    "rejects immutable incident update field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          { title: "Updated incident", [field]: "attacker-controlled" },
          bodyMetadata(UpdateIncidentDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it.each(["id", "timestamp", "workspaceId"])(
    "rejects server-owned work-log field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          {
            agentId: "agent-a",
            action: "worked",
            details: "Completed a task",
            [field]: "attacker-controlled",
          },
          bodyMetadata(CreateWorkLogDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
});
