import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "node:crypto";
import { Repository } from "typeorm";
import { ApprovalEntity } from "../../../entities";
import { AuditLogService } from "../../audit-log/audit-log.service";
import {
  BlueskyOAuthService,
  type BlueskyTokenBundle,
} from "./bluesky-oauth.service";
import { BlueskyOAuthSecurity } from "./bluesky-oauth-security";

const ACTIONS = {
  relay_bluesky_get_profile: "bluesky_profile_get",
  relay_bluesky_list_own_posts: "bluesky_own_posts_list",
  relay_bluesky_draft_text_post: "bluesky_text_post_draft",
  relay_bluesky_publish_text_post: "bluesky_text_post_publish",
} as const;

type BlueskyWrapperName = keyof typeof ACTIONS;

@Injectable()
export class BlueskyActionService {
  constructor(
    private readonly oauth: BlueskyOAuthService,
    private readonly security: BlueskyOAuthSecurity,
    private readonly auditLogService: AuditLogService,
    @InjectRepository(ApprovalEntity)
    private readonly approvalRepo: Repository<ApprovalEntity>,
  ) {}

  async execute(input: {
    workspaceId: string;
    connectionId: string;
    agentId: string;
    userId: string | null;
    toolName: string;
    payload: Record<string, unknown>;
    installMetadata?: Record<string, unknown> | null;
  }) {
    if (!Object.prototype.hasOwnProperty.call(ACTIONS, input.toolName)) {
      throw new BadRequestException("Unsupported Bluesky action");
    }
    const tool = input.toolName as BlueskyWrapperName;
    const session = await this.oauth.executionSession(
      input.workspaceId,
      input.connectionId,
    );
    if (tool === "relay_bluesky_get_profile") {
      this.assertKeys(input.payload, []);
      return this.getProfile(input, session.bundle);
    }
    if (tool === "relay_bluesky_list_own_posts") {
      this.assertKeys(input.payload, ["limit"]);
      return this.listOwnPosts(input, session.bundle);
    }
    if (tool === "relay_bluesky_draft_text_post") {
      this.assertKeys(input.payload, ["text"]);
      const text = this.text(input.payload.text);
      return {
        ok: true,
        data: {
          text,
          graphemeCount: this.graphemeCount(text),
          localOnly: true,
        },
        safeSummary: "Bluesky text post drafted locally.",
      };
    }
    this.assertKeys(input.payload, ["text", "approvalId"]);
    const text = this.text(input.payload.text);
    const approval = await this.requirePublishAuthority(input, text);
    if ("ok" in approval) return approval;
    return this.publish(input, session.bundle, text, approval.approval);
  }

  private async getProfile(
    input: { workspaceId: string; connectionId: string; agentId: string },
    bundle: BlueskyTokenBundle,
  ) {
    const url = new URL(
      "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile",
    );
    url.searchParams.set("actor", bundle.binding.did);
    const result = await this.security.fetchJson(url.toString(), {
      maxRedirects: 0,
    });
    if (result.body.did !== bundle.binding.did) {
      throw new BadRequestException("Bluesky profile DID mismatch");
    }
    const data = {
      did: bundle.binding.did,
      handle: this.string(result.body.handle) || bundle.binding.handle,
      displayName: this.string(result.body.displayName),
      description: this.string(result.body.description),
      avatarUrl: this.httpsUrl(result.body.avatar),
      followersCount: this.number(result.body.followersCount),
      followsCount: this.number(result.body.followsCount),
      postsCount: this.number(result.body.postsCount),
    };
    await this.audit(input, "profile.read", {
      accountHash: this.identityHash(data.did),
    });
    return {
      ok: true,
      data,
      safeSummary: `Read Bluesky profile @${data.handle}.`,
    };
  }

  private async listOwnPosts(
    input: {
      workspaceId: string;
      connectionId: string;
      agentId: string;
      payload: Record<string, unknown>;
    },
    bundle: BlueskyTokenBundle,
  ) {
    const requested =
      input.payload.limit === undefined ? 10 : Number(input.payload.limit);
    if (!Number.isInteger(requested) || requested < 1 || requested > 10) {
      throw new BadRequestException(
        "Bluesky post limit must be an integer from 1 to 10",
      );
    }
    const url = new URL(
      "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed",
    );
    url.searchParams.set("actor", bundle.binding.did);
    url.searchParams.set("limit", String(requested));
    url.searchParams.set("filter", "posts_no_replies");
    const result = await this.security.fetchJson(url.toString(), {
      maxRedirects: 0,
    });
    const feed = Array.isArray(result.body.feed) ? result.body.feed : [];
    const posts = feed
      .map((item) => this.object(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .filter((item) => !item.reason && !this.object(item.reply))
      .map((item) => this.object(item.post))
      .filter((post): post is Record<string, unknown> => Boolean(post))
      .filter((post) => this.object(post.author)?.did === bundle.binding.did)
      .filter((post) => !post.embed)
      .slice(0, requested)
      .map((post) => {
        const record = this.object(post.record) ?? {};
        const uri = this.string(post.uri);
        const cid = this.string(post.cid);
        const text = this.string(record.text);
        const createdAt = this.string(record.createdAt);
        if (!uri || !cid || !text || !createdAt) return null;
        const recordKey = uri.match(
          /^at:\/\/[^/]+\/app\.bsky\.feed\.post\/([^/]+)$/,
        )?.[1];
        return {
          uri,
          cid,
          text,
          createdAt,
          url: recordKey
            ? `https://bsky.app/profile/${encodeURIComponent(bundle.binding.did)}/post/${encodeURIComponent(recordKey)}`
            : null,
          likeCount: this.number(post.likeCount),
          repostCount: this.number(post.repostCount),
          replyCount: this.number(post.replyCount),
          quoteCount: this.number(post.quoteCount),
        };
      })
      .filter((post): post is NonNullable<typeof post> => Boolean(post));
    await this.audit(input, "own_posts.read", {
      accountHash: this.identityHash(bundle.binding.did),
      count: posts.length,
    });
    return {
      ok: true,
      data: { did: bundle.binding.did, posts },
      safeSummary: `Read ${posts.length} original Bluesky posts.`,
    };
  }

  private async requirePublishAuthority(
    input: {
      workspaceId: string;
      connectionId: string;
      agentId: string;
      payload: Record<string, unknown>;
      installMetadata?: Record<string, unknown> | null;
    },
    text: string,
  ): Promise<
    | { approval: ApprovalEntity | null }
    | {
        ok: false;
        data: { approvalId: string };
        safeSummary: string;
        error: { code: "approval_required"; message: string };
      }
  > {
    const direct =
      ["dangerously_skip_permissions", "bluesky_direct_writes"].includes(
        this.string(input.installMetadata?.approvalProfileId),
      ) ||
      ["dangerously_skip_permissions", "bluesky_direct_writes"].includes(
        this.string(input.installMetadata?.permissionPolicyId),
      );
    if (direct) {
      await this.audit(input, "approval.direct_write", {
        payloadHash: this.payloadHash(text),
      });
      return { approval: null };
    }
    const approvalId = this.string(input.payload.approvalId);
    if (!approvalId) {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const approval = await this.approvalRepo.save(
        this.approvalRepo.create({
          title: "Publish Bluesky text post",
          description: text,
          status: "pending",
          requestedByAgentId: input.agentId,
          taskId: null,
          workspaceId: input.workspaceId,
          risk: "medium",
          steps: [{ action: "bluesky_text_post_publish", text }],
          metadata: {
            provider: "bluesky",
            action: "bluesky_text_post_publish",
            connectionId: input.connectionId,
            requestingAgentId: input.agentId,
            exactText: text,
            payloadHash: this.payloadHash(text),
          },
          notes: null,
          resolvedAt: null,
          resolvedByUserId: null,
          expiresAt,
        }),
      );
      await this.audit(input, "approval.requested", {
        approvalId: approval.id,
        payloadHash: this.payloadHash(text),
      });
      return {
        ok: false,
        data: { approvalId: approval.id },
        safeSummary: "Bluesky publish approval created.",
        error: {
          code: "approval_required",
          message:
            "Bluesky publish requires approval of the exact text payload.",
        },
      };
    }
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    const metadata = approval?.metadata ?? {};
    if (
      !approval ||
      approval.status !== "approved" ||
      !approval.resolvedAt ||
      !approval.resolvedByUserId
    ) {
      throw new ForbiddenException(
        "Bluesky publish requires an approved approval",
      );
    }
    if (approval.expiresAt && approval.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException("Bluesky publish approval expired");
    }
    if (
      metadata.provider !== "bluesky" ||
      metadata.action !== "bluesky_text_post_publish" ||
      metadata.connectionId !== input.connectionId ||
      metadata.requestingAgentId !== input.agentId ||
      metadata.exactText !== text ||
      metadata.payloadHash !== this.payloadHash(text) ||
      metadata.executedAt
    ) {
      throw new ForbiddenException("Bluesky publish approval payload mismatch");
    }
    return { approval };
  }

  private async publish(
    input: { workspaceId: string; connectionId: string; agentId: string },
    bundle: BlueskyTokenBundle,
    text: string,
    approval: ApprovalEntity | null,
  ) {
    if (approval) await this.claimApproval(approval);
    const url = `${bundle.binding.pds}/xrpc/com.atproto.repo.createRecord`;
    const record = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: new Date().toISOString(),
    };
    const body = JSON.stringify({
      repo: bundle.binding.did,
      collection: "app.bsky.feed.post",
      record,
    });
    let nonce = bundle.tokenNonce;
    let response: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const proof = this.security.createDpopProof({
        privateJwk: bundle.dpopPrivateJwk,
        publicJwk: bundle.dpopPublicJwk,
        method: "POST",
        url,
        nonce,
        accessToken: bundle.accessToken,
      });
      response = await this.security.request(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `DPoP ${bundle.accessToken}`,
          "Content-Type": "application/json",
          DPoP: proof,
        },
        body,
      });
      const challenge = response.headers.get("dpop-nonce");
      const errorBody = !response.ok
        ? ((await response
            .clone()
            .json()
            .catch(() => ({}))) as Record<string, unknown>)
        : {};
      const nonceChallenge =
        response.status >= 400 &&
        response.status < 500 &&
        ["use_dpop_nonce", "UseDpopNonce"].includes(
          this.string(errorBody.error),
        );
      if (!response.ok && challenge && nonceChallenge && attempt === 0) {
        nonce = challenge;
        continue;
      }
      break;
    }
    if (!response?.ok) {
      if (approval) {
        approval.status = "execution_uncertain";
        approval.metadata = {
          ...approval.metadata,
          executionUncertainAt: new Date().toISOString(),
        };
        await this.approvalRepo.save(approval);
      }
      throw new BadRequestException("Bluesky publish failed without retry");
    }
    const result = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (approval) {
      approval.metadata = {
        ...approval.metadata,
        executedAt: new Date().toISOString(),
      };
      approval.status = "executed";
      await this.approvalRepo.save(approval);
    }
    const data = {
      uri: this.string(result.uri),
      cid: this.string(result.cid),
      text,
      createdAt: record.createdAt,
    };
    await this.audit(input, "text_post.published", {
      approvalId: approval?.id ?? null,
      directWrite: !approval,
      payloadHash: this.payloadHash(text),
      uri: data.uri,
      cid: data.cid,
    });
    return { ok: true, data, safeSummary: "Bluesky text post published." };
  }

  private async claimApproval(approval: ApprovalEntity) {
    const result = await this.approvalRepo
      .createQueryBuilder()
      .update(ApprovalEntity)
      .set({ status: "executing" })
      .where("id = :id", { id: approval.id })
      .andWhere("status = :status", { status: "approved" })
      .andWhere("(expiresAt IS NULL OR expiresAt > :now)", { now: new Date() })
      .execute();
    if (result.affected !== 1) {
      throw new ForbiddenException(
        "Bluesky publish approval was already consumed",
      );
    }
    approval.status = "executing";
  }

  private text(value: unknown) {
    const text = this.string(value).normalize("NFC").trim();
    const count = this.graphemeCount(text);
    if (!text || count > 300) {
      throw new BadRequestException(
        "Bluesky text must contain 1 to 300 grapheme clusters",
      );
    }
    return text;
  }

  private graphemeCount(value: string) {
    const Segmenter = (
      Intl as unknown as {
        Segmenter: new (
          locale: string,
          options: { granularity: "grapheme" },
        ) => { segment(input: string): Iterable<unknown> };
      }
    ).Segmenter;
    return Array.from(
      new Segmenter("en", { granularity: "grapheme" }).segment(value),
    ).length;
  }

  private assertKeys(payload: Record<string, unknown>, allowed: string[]) {
    const set = new Set(allowed);
    const extras = Object.keys(payload).filter((key) => !set.has(key));
    if (extras.length)
      throw new BadRequestException(
        `Unsupported Bluesky payload field: ${extras[0]}`,
      );
  }

  private payloadHash(text: string) {
    return createHash("sha256").update(JSON.stringify({ text })).digest("hex");
  }

  private identityHash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private httpsUrl(value: unknown) {
    const raw = this.string(value);
    if (!raw) return null;
    try {
      const url = new URL(raw);
      return url.protocol === "https:" && !url.username && !url.password
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  private async audit(
    input: { workspaceId: string; connectionId: string; agentId: string },
    event: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditLogService.record({
      actorType: "agent",
      actorId: input.agentId,
      workspaceId: input.workspaceId,
      eventType: `marketplace.bluesky.${event}`,
      resourceType: "marketplace_connection",
      resourceId: input.connectionId,
      metadata,
    });
  }

  private string(value: unknown) {
    return typeof value === "string" ? value : "";
  }

  private number(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}

export { ACTIONS as BLUESKY_WRAPPER_ACTIONS };
