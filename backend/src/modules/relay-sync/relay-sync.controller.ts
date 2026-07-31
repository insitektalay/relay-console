import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsInt, IsObject, IsString, Max, Min } from "class-validator";
import { Request, Response } from "express";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { UserEntity } from "../../entities";
import {
  AttachmentUploadDto,
  ChangeFeedQueryDto,
  CreateImportDto,
  CreateSyncLinkDto,
  ImportBatchDto,
  MutationBatchDto,
  RegisterClientInstallationDto,
} from "./dto/relay-sync.dto";
import { RELAY_ATTACHMENT_MAX_BYTES } from "./attachment-upload-policy";
import { RelaySyncService } from "./relay-sync.service";

class ReconcileDto {
  @IsString() cursor: string;
  @IsObject() counts: Record<string, number>;
}
class OwnerLeaseDto {
  @IsString() workspaceId: string;
  @IsString() agentId: string;
  @IsString() bridgeDeviceId: string;
  @IsString() ownerKind: string;
  @IsInt() @Min(30) @Max(300) ttlSeconds: number;
}

@ApiTags("relay-sync")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller()
export class RelaySyncController {
  constructor(private readonly sync: RelaySyncService) {}

  @Public()
  @Get("deployment/capabilities")
  capabilities() {
    return this.sync.capabilities();
  }

  @Post("client-installations")
  registerInstallation(
    @CurrentUser() user: UserEntity,
    @Body() dto: RegisterClientInstallationDto,
  ) {
    return this.sync.registerInstallation(user.id, dto);
  }

  @Delete("client-installations/:id")
  revokeInstallation(@CurrentUser() user: UserEntity, @Param("id") id: string) {
    return this.sync.revokeInstallation(user.id, id);
  }

  @Post("workspace-sync-links")
  createLink(@CurrentUser() user: UserEntity, @Body() dto: CreateSyncLinkDto) {
    return this.sync.createLink(user.id, dto);
  }

  @Post("workspace-sync-links/:id/:action")
  setLinkState(
    @CurrentUser() user: UserEntity,
    @Param("id") id: string,
    @Param("action") action: string,
  ) {
    if (!(["pause", "resume", "unlink"] as string[]).includes(action))
      throw new BadRequestException("INVALID_SYNC_LINK_ACTION");
    return this.sync.setLinkState(
      user.id,
      id,
      action as "pause" | "resume" | "unlink",
    );
  }

  @Delete("workspace-sync-links/:id/cloud-workspace")
  deleteCloudWorkspace(
    @CurrentUser() user: UserEntity,
    @Param("id") id: string,
  ) {
    return this.sync.deleteCloudWorkspace(user.id, id);
  }

  @Post("workspace-imports")
  createImport(@CurrentUser() user: UserEntity, @Body() dto: CreateImportDto) {
    return this.sync.createImport(user.id, dto);
  }

  @Get("workspace-imports/:id")
  importStatus(@CurrentUser() user: UserEntity, @Param("id") id: string) {
    return this.sync.importStatus(user.id, id);
  }

  @Post("workspace-imports/:id/batches")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  importBatch(
    @CurrentUser() user: UserEntity,
    @Param("id") id: string,
    @Body() dto: ImportBatchDto,
  ) {
    return this.sync.importBatch(
      user.id,
      id,
      dto.batchKey,
      dto.records as never,
      dto.finalBatch,
    );
  }

  @Post("workspace-imports/:id/:action")
  setImportState(
    @CurrentUser() user: UserEntity,
    @Param("id") id: string,
    @Param("action") action: string,
  ) {
    if (!(["cancel", "resume", "repair"] as string[]).includes(action))
      throw new BadRequestException("INVALID_IMPORT_ACTION");
    return this.sync.setImportState(
      user.id,
      id,
      action as "cancel" | "resume" | "repair",
    );
  }

  @Post("workspaces/:workspaceId/mutations")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  mutations(
    @CurrentUser() user: UserEntity,
    @Param("workspaceId") workspaceId: string,
    @Body() dto: MutationBatchDto,
  ) {
    return this.sync.mutate(
      user.id,
      workspaceId,
      dto.installationId,
      dto.mutations as never,
    );
  }

  @Get("workspaces/:workspaceId/changes")
  changes(
    @CurrentUser() user: UserEntity,
    @Param("workspaceId") workspaceId: string,
    @Query() query: ChangeFeedQueryDto,
  ) {
    return this.sync.changeFeed(
      user.id,
      workspaceId,
      query.after ?? "0",
      query.limit ?? 200,
    );
  }

  @Post("workspaces/:workspaceId/reconcile")
  reconcile(
    @CurrentUser() user: UserEntity,
    @Param("workspaceId") workspaceId: string,
    @Body() dto: ReconcileDto,
  ) {
    return this.sync.reconcile(user.id, workspaceId, dto.cursor, dto.counts);
  }

  @Post("attachments/uploads")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  negotiateAttachment(
    @CurrentUser() user: UserEntity,
    @Body() dto: AttachmentUploadDto,
  ) {
    return this.sync.negotiateAttachment(user.id, dto);
  }

  @Public()
  @Post("attachments/uploads/:id/content")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  uploadAttachment(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined,
    @Headers("content-length") contentLengthHeader: string | undefined,
    @Headers("content-type") contentType: string | undefined,
    @Headers("content-encoding") contentEncoding: string | undefined,
    @Headers("transfer-encoding") transferEncoding: string | undefined,
    @Req() request: Request,
  ) {
    const match = authorization?.match(
      /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/,
    );
    if (!match || match[1].length > 4096)
      throw new ForbiddenException("ATTACHMENT_UPLOAD_TOKEN_INVALID");
    if (
      !contentLengthHeader ||
      !/^[1-9][0-9]{0,8}$/.test(contentLengthHeader) ||
      Number(contentLengthHeader) > RELAY_ATTACHMENT_MAX_BYTES
    )
      throw new BadRequestException("ATTACHMENT_CONTENT_LENGTH_REQUIRED");
    if (!contentType || contentType !== contentType.trim().toLowerCase())
      throw new BadRequestException("ATTACHMENT_CONTENT_TYPE_INVALID");
    if (
      (contentEncoding && contentEncoding.toLowerCase() !== "identity") ||
      transferEncoding
    )
      throw new BadRequestException("ATTACHMENT_CONTENT_ENCODING_DENIED");
    return this.sync.uploadAttachmentContent(id, match[1], request, {
      contentLength: Number(contentLengthHeader),
      contentType,
    });
  }

  @Get("workspaces/:workspaceId/attachments/:attachmentId")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async downloadAttachment(
    @CurrentUser() user: UserEntity,
    @Param("workspaceId") workspaceId: string,
    @Param("attachmentId") attachmentId: string,
    @Res() response: Response,
  ) {
    const download = await this.sync.downloadAttachment(
      user.id,
      workspaceId,
      attachmentId,
    );
    response.status(200);
    response.setHeader("Content-Type", download.metadata.contentType);
    response.setHeader("Content-Length", String(download.metadata.byteSize));
    response.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(
        Buffer.from(download.metadata.fileName, "utf8").toString("utf8"),
      )}`,
    );
    response.setHeader(
      "Digest",
      `sha-256=${Buffer.from(download.metadata.sha256, "hex").toString("base64")}`,
    );
    response.setHeader("Cache-Control", "private, no-store, no-transform");
    response.setHeader("X-Content-Type-Options", "nosniff");
    await pipeline(Readable.from(download.chunks), response);
  }

  @Delete("workspaces/:workspaceId/attachments/:attachmentId")
  deleteAttachment(
    @CurrentUser() user: UserEntity,
    @Param("workspaceId") workspaceId: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    return this.sync.deleteAttachment(user.id, workspaceId, attachmentId);
  }

  @Post("runtime-devices/execution-owner-leases")
  ownerLease(@CurrentUser() user: UserEntity, @Body() dto: OwnerLeaseDto) {
    return this.sync.acquireOwnerLease(user.id, dto);
  }
}
