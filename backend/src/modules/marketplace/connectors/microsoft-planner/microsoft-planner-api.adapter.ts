import { Injectable } from "@nestjs/common";

export class MicrosoftPlannerApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const API_ORIGIN = "https://graph.microsoft.com";
const SAFE_ID = /^[A-Za-z0-9._!~-]{1,256}$/;

@Injectable()
export class MicrosoftPlannerApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(accessToken: string) {
    const result = await this.listAssignedTasks(accessToken);
    return { reachable: true, resultCount: result.resultCount };
  }

  async listAssignedTasks(accessToken: string) {
    return this.tasks(await this.get(accessToken, "/v1.0/me/planner/tasks"));
  }

  async getTask(accessToken: string, input: Record<string, unknown>) {
    const taskId = this.id(input.taskId, "taskId");
    return {
      task: this.task(
        this.object(
          await this.get(accessToken, `/v1.0/planner/tasks/${taskId}`),
        ),
      ),
    };
  }

  async getPlan(accessToken: string, input: Record<string, unknown>) {
    const planId = this.id(input.planId, "planId");
    return {
      plan: this.plan(
        this.object(
          await this.get(accessToken, `/v1.0/planner/plans/${planId}`),
        ),
      ),
    };
  }

  async listPlanTasks(accessToken: string, input: Record<string, unknown>) {
    const planId = this.id(input.planId, "planId");
    return this.tasks(
      await this.get(accessToken, `/v1.0/planner/plans/${planId}/tasks`),
    );
  }

  private async get(accessToken: string, path: string) {
    if (!accessToken.trim())
      throw new MicrosoftPlannerApiError(
        "microsoft_planner_token_invalid",
        "Microsoft Planner connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
    if (
      url.origin !== API_ORIGIN ||
      !(
        url.pathname === "/v1.0/me/planner/tasks" ||
        /^\/v1\.0\/planner\/tasks\/[A-Za-z0-9._!~-]{1,256}$/.test(
          url.pathname,
        ) ||
        /^\/v1\.0\/planner\/plans\/[A-Za-z0-9._!~-]{1,256}(?:\/tasks)?$/.test(
          url.pathname,
        )
      ) ||
      /\/(details|buckets|members|users|groups)(\/|$)/i.test(url.pathname)
    )
      throw new MicrosoftPlannerApiError(
        "microsoft_planner_path_blocked",
        "Planner request path is outside the bounded delegated-read V1 allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new MicrosoftPlannerApiError(
        "microsoft_planner_unavailable",
        "Microsoft Graph Planner is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new MicrosoftPlannerApiError(
        "microsoft_planner_response_too_large",
        "Microsoft Graph Planner response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MicrosoftPlannerApiError(
        "microsoft_planner_response_invalid",
        "Microsoft Graph returned an invalid Planner response.",
      );
    }
    if (!response.ok)
      throw new MicrosoftPlannerApiError(
        response.status === 401
          ? "microsoft_planner_token_invalid"
          : response.status === 403
            ? "microsoft_planner_permission_denied"
            : response.status === 404
              ? "microsoft_planner_not_found"
              : response.status === 429
                ? "microsoft_planner_rate_limited"
                : "microsoft_planner_graph_error",
        "Microsoft Graph Planner request failed.",
        response.status,
      );
    return body;
  }

  private tasks(value: unknown) {
    const root = this.object(value);
    const rows = Array.isArray(root.value)
      ? root.value.slice(0, 25).map((row) => this.task(this.object(row)))
      : [];
    return { tasks: rows, resultCount: rows.length, nextPageFollowed: false };
  }
  private task(row: Record<string, unknown>) {
    const assignments = this.object(row.assignments);
    return {
      id: this.scalar(row.id),
      title: this.scalar(row.title),
      planId: this.scalar(row.planId),
      bucketId: this.scalar(row.bucketId),
      percentComplete: this.scalar(row.percentComplete),
      priority: this.scalar(row.priority),
      startDateTime: this.scalar(row.startDateTime),
      dueDateTime: this.scalar(row.dueDateTime),
      createdDateTime: this.scalar(row.createdDateTime),
      completedDateTime: this.scalar(row.completedDateTime),
      conversationThreadId: this.scalar(row.conversationThreadId),
      assignmentCount: Object.keys(assignments).length,
      assignmentIdentitiesExcluded: true,
      detailsExcluded: true,
    };
  }
  private plan(row: Record<string, unknown>) {
    const container = this.object(row.container);
    return {
      id: this.scalar(row.id),
      title: this.scalar(row.title),
      ownerGroupId: this.scalar(row.owner),
      createdDateTime: this.scalar(row.createdDateTime),
      containerType: this.scalar(container.type),
      containerUrl: this.safeWebUrl(container.url),
      groupDirectoryExcluded: true,
    };
  }
  private id(value: unknown, field: string) {
    if (typeof value !== "string" || !SAFE_ID.test(value))
      throw new MicrosoftPlannerApiError(
        "microsoft_planner_input_invalid",
        `A safe explicit ${field} is required.`,
      );
    return value;
  }
  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
  private safeWebUrl(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.toString().slice(0, 2048) : null;
    } catch {
      return null;
    }
  }
}
