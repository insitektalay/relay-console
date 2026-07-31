import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { PermissionScope } from "../../entities/permission-policy.entity";
import {
  CreatePermissionPolicyDto,
  UpdatePermissionPolicyDto,
} from "./dto/permissions.dto";

const strictPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

function bodyMetadata(metatype: ArgumentMetadata["metatype"]): ArgumentMetadata {
  return { type: "body", metatype, data: undefined };
}

describe("permission policy DTOs", () => {
  const createPolicy = {
    name: "Team policy",
    workspaceId: "workspace-a",
    scope: PermissionScope.TEAM,
    scopeId: "team-a",
    permissions: [{ action: "read:tasks", effect: "allow" }],
  };

  it.each(["id", "createdAt", "updatedAt"])(
    "rejects server-owned create field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          { ...createPolicy, [field]: "attacker-controlled" },
          bodyMetadata(CreatePermissionPolicyDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it("rejects unknown nested permission fields", async () => {
    await expect(
      strictPipe.transform(
        {
          ...createPolicy,
          permissions: [
            { action: "*", effect: "allow", bypassApproval: true },
          ],
        },
        bodyMetadata(CreatePermissionPolicyDto),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each(["id", "workspaceId", "scope", "scopeId", "name"])(
    "rejects immutable update field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          {
            permissions: [{ action: "read:tasks", effect: "allow" }],
            [field]: "attacker-controlled",
          },
          bodyMetadata(UpdatePermissionPolicyDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
});
