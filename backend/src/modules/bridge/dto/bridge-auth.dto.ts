import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class BridgeCompatibilityMetadataDto {
  @IsOptional()
  @IsString()
  @Matches(/^relayhost_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  hostInstallationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pluginVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  openCoreVersion?: string;

  @IsOptional()
  @IsIn(["claude_code", "hermes", "openclaw"])
  runtimeType?: string;

  @IsOptional()
  @IsIn(["macos-launchd", "linux-systemd"])
  hostType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  apiContractVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  websocketContractVersion?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  capabilities?: string[];
}

export class RedeemBridgeEnrollmentDto extends BridgeCompatibilityMetadataDto {
  @IsString()
  @Matches(/^[A-Fa-f0-9]{12}$/)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceLabel?: string;
}

export class CheckBridgeCompatibilityDto extends BridgeCompatibilityMetadataDto {}

export class BridgeDeviceCredentialDto extends BridgeCompatibilityMetadataDto {
  @IsString()
  @Matches(
    /^bdev_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
  devicePublicId: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  deviceToken: string;
}

export class CreateBridgeEnrollmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceLabel?: string;

  @IsOptional()
  @IsString()
  @Matches(/^relayhost_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  hostInstallationId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInMinutes?: number;
}
