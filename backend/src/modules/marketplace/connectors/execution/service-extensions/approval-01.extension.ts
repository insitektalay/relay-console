import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import {
  ApprovalEntity,
  MarketplaceConnectionEntity,
} from "../../../../../entities";
import { type MarketplaceConnectorExecutorRequest } from "../../types";
import { ConnectorExecutionApprovalService } from "../connector-execution-approval.service";
import { ConnectorExecutionError } from "../connector-execution.error";

export const ApprovalExtension1 = {
  getExecutionApprovalService(this: MarketplaceConnectorExecutionService) {
    this.executionApprovals ??= new ConnectorExecutionApprovalService(
      this.approvalRepo,
      this.getExecutionAuditService(),
    );
    return this.executionApprovals;
  },

  async requireDropboxApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    targetInput: unknown,
  ) {
    const targetId = this.requiredString(targetInput, "targetId");
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "dropbox");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    }))
      if (metadata[field] !== undefined && metadata[field] !== actual)
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Dropbox write.`,
        );
  },

  requiredAdobeAcrobatSignApiOrigin(
    this: MarketplaceConnectorExecutionService,
    metadata: Record<string, unknown> | null | undefined,
  ) {
    const apiOrigin = this.stringOrNull(metadata?.adobeAcrobatSignApiOrigin);
    if (!apiOrigin)
      throw new ConnectorExecutionError(
        "connection_not_ready",
        "Adobe Acrobat Sign API shard binding is missing.",
      );
    return apiOrigin;
  },

  requiredMapsApiKey(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
  ) {
    const apiKey = this.stringOrNull(stored?.GOOGLE_MAPS_PLATFORM_API_KEY);
    if (!apiKey)
      throw new ConnectorExecutionError(
        "credential_missing",
        "Google Maps Platform API key is missing.",
      );
    return apiKey;
  },

  async requireBoxApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    targetInput: unknown,
  ) {
    const targetId = this.requiredString(targetInput, "targetId");
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "box");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    }))
      if (metadata[field] !== undefined && metadata[field] !== actual)
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Box write.`,
        );
  },

  async requireMiroApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
  ) {
    const targetId = this.requiredString(
      input.input.itemId ?? input.input.boardId,
      "targetId",
    );
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "miro");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    })) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Miro write.`,
        );
      }
    }
  },

  async requireCanvaApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
  ) {
    const targetId = this.requiredString(
      input.input.designId ?? input.input.title ?? "new-design",
      "targetId",
    );
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "canva");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    })) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Canva design creation.`,
        );
      }
    }
  },

  async requireWordPressComApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
  ) {
    const targetId = this.requiredString(
      input.input.postId === undefined
        ? `site:${String(input.input.siteId ?? "")}:new-draft`
        : String(input.input.postId),
      "targetId",
    );
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "wordpress-com",
    );
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    })) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the WordPress.com post write.`,
        );
      }
    }
  },

  async requireContentfulApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
  ) {
    const targetId = this.requiredString(
      input.input.entryId ??
        `${String(input.input.spaceId ?? "")}:${String(input.input.environmentId ?? "")}:new-draft`,
      "targetId",
    );
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "contentful",
    );
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    })) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Contentful entry write.`,
        );
      }
    }
  },

  async requireWooCommerceApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
  ) {
    const targetId = this.requiredString(
      input.input.productId ?? "new-draft-product",
      "targetId",
    );
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "woocommerce",
    );
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    })) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the WooCommerce product write.`,
        );
      }
    }
  },

  async requireShopifyApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
  ) {
    const targetId = this.requiredString(
      input.input.productId ?? "new-draft-product",
      "targetId",
    );
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "shopify");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    })) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Shopify product write.`,
        );
      }
    }
  },

  async requireStrapiCloudApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
  ) {
    const targetId = this.requiredString(
      input.input.documentId ??
        `${String(input.input.pluralApiId ?? "")}:new-draft`,
      "targetId",
    );
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "strapi-cloud",
    );
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    })) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Strapi Cloud document write.`,
        );
      }
    }
  },

  async requireSanityApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
  ) {
    const targetId = this.requiredString(input.input.documentId, "targetId");
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "sanity");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    })) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Sanity document write.`,
        );
      }
    }
  },

  async requireGhostApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
  ) {
    const targetId = this.requiredString(
      input.input.postId ?? "new-draft",
      "targetId",
    );
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "ghost");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    })) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Ghost post write.`,
        );
      }
    }
  },

  async requireWebflowApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
  ) {
    const targetId = this.requiredString(
      input.input.itemId ?? input.input.collectionId,
      "targetId",
    );
    const idempotencyKey = this.requiredString(
      input.input.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = input.input;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "webflow");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    })) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Webflow CMS write.`,
        );
      }
    }
  },

  async requireNextdoorPublishApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    text: string,
  ) {
    if (
      this.shouldSkipConnectorApproval(input) ||
      input.installMetadata?.approvalProfileId === "nextdoor_direct_writes"
    ) {
      await this.recordApprovalSkipped(
        input,
        connection,
        "nextdoor",
        "nextdoor_text_post_publish",
      );
      return null;
    }
    const approvalId = this.stringOrNull(input.input.approvalId);
    if (!approvalId) {
      throw new ConnectorExecutionError(
        "approval_required",
        "Nextdoor publishing requires approval of the exact text payload.",
      );
    }
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    if (
      !approval ||
      approval.status !== "approved" ||
      !approval.resolvedAt ||
      !approval.resolvedByUserId
    ) {
      throw new ConnectorExecutionError(
        "approval_required",
        "Nextdoor publishing requires an approved approval.",
      );
    }
    if (approval.expiresAt && approval.expiresAt.getTime() <= Date.now()) {
      throw new ConnectorExecutionError(
        "approval_required",
        "Nextdoor publish approval expired.",
      );
    }
    const metadata = approval.metadata ?? {};
    if (
      metadata.provider !== "nextdoor" ||
      metadata.action !== "nextdoor_text_post_publish" ||
      metadata.connectionId !== connection.id ||
      metadata.requestingAgentId !== input.agentId ||
      metadata.exactText !== text ||
      metadata.textHash !== this.hash(text) ||
      metadata.executedAt
    ) {
      throw new ConnectorExecutionError(
        "approval_mismatch",
        "Nextdoor publish approval payload does not match.",
      );
    }
    const claim = await this.approvalRepo
      .createQueryBuilder()
      .update(ApprovalEntity)
      .set({ status: "executing" })
      .where("id = :id", { id: approval.id })
      .andWhere("status = :status", { status: "approved" })
      .andWhere("(expiresAt IS NULL OR expiresAt > :now)", {
        now: new Date(),
      })
      .execute();
    if (claim.affected !== 1) {
      throw new ConnectorExecutionError(
        "approval_mismatch",
        "Nextdoor publish approval was already consumed.",
      );
    }
    approval.status = "executing";
    return approval;
  },

  async requireMastodonPublishApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
  ) {
    await this.requireConnectorApproval(
      input,
      connection,
      "mastodon_text_status_publish",
      "mastodon",
    );
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId);
    const approval = approvalId
      ? await this.approvalRepo.findOne({
          where: { id: approvalId, workspaceId: input.workspaceId },
        })
      : null;
    const text = this.stringOrNull(input.input.text) ?? "";
    const visibility = this.stringOrNull(input.input.visibility) ?? "";
    const language = this.stringOrNull(input.input.language) ?? "";
    if (
      (approval?.metadata?.textHash !== undefined &&
        approval.metadata.textHash !== this.hash(text)) ||
      (approval?.metadata?.visibility !== undefined &&
        approval.metadata.visibility !== visibility) ||
      (approval?.metadata?.language !== undefined &&
        approval.metadata.language !== language)
    )
      throw new ConnectorExecutionError(
        "approval_mismatch",
        "Approval payload does not match the Mastodon status.",
      );
  },

  async requireThreadsPublishApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
  ) {
    await this.requireConnectorApproval(
      input,
      connection,
      "threads_text_post_publish",
      "threads",
    );
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId);
    const approval = approvalId
      ? await this.approvalRepo.findOne({
          where: { id: approvalId, workspaceId: input.workspaceId },
        })
      : null;
    const text = this.stringOrNull(input.input.text);
    if (
      approval?.metadata?.textHash !== undefined &&
      approval.metadata.textHash !== this.hash(text ?? "")
    )
      throw new ConnectorExecutionError(
        "approval_mismatch",
        "Approval text does not match the Threads post.",
      );
  },

  async requireGitHubApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    comment: {
      action: string;
      owner: string;
      repo: string;
      number: number;
      body: string;
      idempotencyKey: string;
    },
  ) {
    await this.requireConnectorApproval(
      input,
      connection,
      comment.action,
      "github",
    );
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    const expected: Record<string, string | number> = {
      requestingAgentId: input.agentId,
      owner: comment.owner,
      repo: comment.repo,
      number: comment.number,
      idempotencyKey: comment.idempotencyKey,
      bodyHash: this.hash(comment.body),
    };
    for (const [field, actual] of Object.entries(expected)) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the GitHub comment.`,
        );
      }
    }
  },

  async requireGitLabApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    comment: {
      action: string;
      projectPath: string;
      iid: number;
      body: string;
      idempotencyKey: string;
    },
  ) {
    await this.requireConnectorApproval(
      input,
      connection,
      comment.action,
      "gitlab",
    );
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    const expected: Record<string, string | number> = {
      requestingAgentId: input.agentId,
      projectPath: comment.projectPath,
      iid: comment.iid,
      idempotencyKey: comment.idempotencyKey,
      bodyHash: this.hash(comment.body),
    };
    for (const [field, actual] of Object.entries(expected)) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the GitLab comment.`,
        );
      }
    }
  },

  async requireBitbucketApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    comment: {
      action: string;
      repositoryPath: string;
      id: number;
      body: string;
      idempotencyKey: string;
    },
  ) {
    await this.requireConnectorApproval(
      input,
      connection,
      comment.action,
      "bitbucket",
    );
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    const expected: Record<string, string | number> = {
      requestingAgentId: input.agentId,
      repositoryPath: comment.repositoryPath,
      id: comment.id,
      idempotencyKey: comment.idempotencyKey,
      bodyHash: this.hash(comment.body),
    };
    for (const [field, actual] of Object.entries(expected)) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Bitbucket comment.`,
        );
      }
    }
  },

  async requireAirtableApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    targetIdInput: unknown,
    bodyInput: Record<string, unknown>,
  ) {
    const targetId = this.requiredString(targetIdInput, "targetId"),
      idempotencyKey = this.requiredString(
        bodyInput.idempotencyKey,
        "idempotencyKey",
      );
    const { approvalId: _approvalId, ...body } = bodyInput;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "airtable");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    }))
      if (metadata[field] !== undefined && metadata[field] !== actual)
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Airtable write.`,
        );
  },

  async requireMondayApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    targetIdInput: unknown,
    bodyInput: Record<string, unknown>,
  ) {
    const targetId = this.requiredString(targetIdInput, "targetId");
    const idempotencyKey = this.requiredString(
      bodyInput.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = bodyInput;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(
      input,
      connection,
      action,
      "monday-com",
    );
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    for (const [field, actual] of Object.entries({
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    }))
      if (metadata[field] !== undefined && metadata[field] !== actual)
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Monday.com item write.`,
        );
  },

  async requireClickUpApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    targetIdInput: unknown,
    bodyInput: Record<string, unknown>,
  ) {
    const targetId = this.requiredString(targetIdInput, "targetId");
    const idempotencyKey = this.requiredString(
      bodyInput.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = bodyInput;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "clickup");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    const expected = {
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    };
    for (const [field, actual] of Object.entries(expected))
      if (metadata[field] !== undefined && metadata[field] !== actual)
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the ClickUp task write.`,
        );
  },

  async requireTrelloApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    targetIdInput: unknown,
    bodyInput: Record<string, unknown>,
  ) {
    const targetId = this.requiredString(targetIdInput, "targetId");
    const idempotencyKey = this.requiredString(
      bodyInput.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = bodyInput;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "trello");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    const expected = {
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    };
    for (const [field, actual] of Object.entries(expected))
      if (metadata[field] !== undefined && metadata[field] !== actual)
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Trello card write.`,
        );
  },

  async requireAsanaApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    targetGidInput: unknown,
    bodyInput: Record<string, unknown>,
  ) {
    const targetGid = this.requiredString(targetGidInput, "targetGid");
    const idempotencyKey = this.requiredString(
      bodyInput.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = bodyInput;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "asana");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    const expected = {
      requestingAgentId: input.agentId,
      targetGid,
      idempotencyKey,
      bodyHash,
    };
    for (const [field, actual] of Object.entries(expected))
      if (metadata[field] !== undefined && metadata[field] !== actual)
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Asana task write.`,
        );
  },

  async requireLinearApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    targetIdInput: unknown,
    bodyInput: Record<string, unknown>,
  ) {
    const targetId = this.requiredString(targetIdInput, "targetId");
    const idempotencyKey = this.requiredString(
      bodyInput.idempotencyKey,
      "idempotencyKey",
    );
    const { approvalId: _approvalId, ...body } = bodyInput;
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "linear");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    const expected = {
      requestingAgentId: input.agentId,
      targetId,
      idempotencyKey,
      bodyHash,
    };
    for (const [field, actual] of Object.entries(expected))
      if (metadata[field] !== undefined && metadata[field] !== actual)
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Linear write.`,
        );
  },

  async requireNotionApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    parentIdInput: unknown,
    body: unknown,
    idempotencyKeyInput: unknown,
  ) {
    const parentId = this.requiredString(parentIdInput, "parentId");
    const idempotencyKey = this.requiredString(
      idempotencyKeyInput,
      "idempotencyKey",
    );
    const bodyHash = this.hash(JSON.stringify(body));
    await this.requireConnectorApproval(input, connection, action, "notion");
    if (this.shouldSkipConnectorApproval(input)) return;
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    const expected = {
      requestingAgentId: input.agentId,
      parentId,
      idempotencyKey,
      bodyHash,
    };
    for (const [field, actual] of Object.entries(expected))
      if (metadata[field] !== undefined && metadata[field] !== actual)
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Notion write.`,
        );
  },

  async requireSlackApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    message: {
      channelId: string;
      text: string;
      threadTs: string | null;
      idempotencyKey: string;
    },
  ) {
    await this.requireConnectorApproval(
      input,
      connection,
      "slack_message_send",
      "slack",
    );
    if (
      this.shouldSkipConnectorApproval(input) ||
      input.installMetadata?.approvalProfileId === "slack_direct_writes"
    ) {
      return;
    }
    const approvalId = this.stringOrNull(input.input.approvalId)!;
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    const expected: Record<string, string | null> = {
      requestingAgentId: input.agentId,
      channelId: message.channelId,
      threadTs: message.threadTs,
      idempotencyKey: message.idempotencyKey,
      textHash: this.hash(message.text),
      text: message.text,
    };
    for (const [field, actual] of Object.entries(expected)) {
      if (metadata[field] !== undefined && metadata[field] !== actual) {
        throw new ConnectorExecutionError(
          "approval_mismatch",
          `Approval ${field} does not match the Slack message.`,
        );
      }
    }
  },

  async requireConnectorApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    provider: string,
  ) {
    await this.getExecutionApprovalService().require(
      input,
      connection,
      action,
      provider,
    );
  },

  shouldSkipConnectorApproval(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    return this.getExecutionApprovalService().shouldSkip(input);
  },

  async recordApprovalSkipped(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    provider: string,
    action: string,
  ) {
    await this.getExecutionApprovalService().recordSkipped(
      input,
      connection,
      provider,
      action,
    );
  },

  dataForSeoRequiresApproval(
    this: MarketplaceConnectorExecutionService,
    input: Record<string, unknown>,
    toolName: string,
  ) {
    if (Number(input.depth ?? 0) > 50) return true;
    if (Number(input.limit ?? 0) > 50) return true;
    if (
      toolName === "dataforseo.inspectPage" &&
      (input.enableJavascript === true || input.loadResources === true)
    ) {
      return true;
    }
    return false;
  },

  requiredString(
    this: MarketplaceConnectorExecutionService,
    value: unknown,
    field: string,
  ) {
    const stringValue = this.stringOrNull(value);
    if (!stringValue)
      throw new ConnectorExecutionError(
        "provider_validation_error",
        `${field} is required`,
      );
    return stringValue;
  },

  requiredCredential(
    this: MarketplaceConnectorExecutionService,
    stored: Record<string, unknown> | null | undefined,
    field: string,
  ) {
    const stringValue = this.stringOrNull(stored?.[field]);
    if (!stringValue)
      throw new ConnectorExecutionError(
        "credential_missing",
        `${field} is required`,
      );
    return stringValue;
  },
};
