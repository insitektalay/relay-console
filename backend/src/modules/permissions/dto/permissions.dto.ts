import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { PermissionScope } from "../../../entities/permission-policy.entity";

export class PermissionRuleDto {
  @ApiProperty({
    description: "A permission action name or the administrator wildcard",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^(\*|[a-z][a-z0-9_.:-]*)$/)
  action: string;

  @ApiProperty({ enum: ["allow", "deny"] })
  @IsString()
  @IsIn(["allow", "deny"])
  effect: "allow" | "deny";
}

export class PermissionWorkspaceQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workspaceId: string;
}

export class CreatePermissionPolicyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workspaceId: string;

  @ApiProperty({ enum: PermissionScope })
  @IsString()
  @IsIn(Object.values(PermissionScope))
  scope: PermissionScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  scopeId?: string;

  @ApiProperty({ type: [PermissionRuleDto], maxItems: 200 })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PermissionRuleDto)
  permissions: PermissionRuleDto[];
}

export class UpdatePermissionPolicyDto {
  @ApiProperty({ type: [PermissionRuleDto], maxItems: 200 })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PermissionRuleDto)
  permissions: PermissionRuleDto[];
}
