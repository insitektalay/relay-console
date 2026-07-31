import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;

export class GoogleClassroomApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleClassroomApiAdapter {
  private readonly origin = "https://classroom.googleapis.com";
  health(token: string) {
    this.token(token);
    return {
      readOnlyV1: true,
      requestingUserOnly: true,
      writesEnabled: false,
      providerRequestCount: 0,
    };
  }

  async listMyCourses(token: string, input: JsonObject) {
    const maximum = this.maxResults(input.maxResults);
    const value = await this.request(token, "/v1/courses", {
      pageSize: String(maximum),
    });
    const all = this.array(value.courses);
    return {
      semanticReadContract: "google-classroom-requesting-user-courses-v1",
      courses: all.slice(0, maximum).map((item) => this.course(item)),
      resultCount: Math.min(all.length, maximum),
      truncated: Boolean(value.nextPageToken) || all.length > maximum,
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }
  async getCourse(token: string, input: JsonObject) {
    const courseId = this.courseId(input.courseId);
    const value = await this.request(token, `/v1/courses/${courseId}`, {});
    return {
      semanticReadContract: "google-classroom-explicit-course-v1",
      course: this.course(value),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }
  async listCoursework(token: string, input: JsonObject) {
    const courseId = this.courseId(input.courseId),
      maximum = this.maxResults(input.maxResults);
    const value = await this.request(
      token,
      `/v1/courses/${courseId}/courseWork`,
      { pageSize: String(maximum), orderBy: "updateTime desc" },
    );
    const all = this.array(value.courseWork);
    return {
      semanticReadContract: "google-classroom-coursework-v1",
      courseId,
      courseWork: all.slice(0, maximum).map((item) => this.courseWork(item)),
      resultCount: Math.min(all.length, maximum),
      truncated: Boolean(value.nextPageToken) || all.length > maximum,
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }
  async listMaterials(token: string, input: JsonObject) {
    const courseId = this.courseId(input.courseId),
      maximum = this.maxResults(input.maxResults);
    const value = await this.request(
      token,
      `/v1/courses/${courseId}/courseWorkMaterials`,
      { pageSize: String(maximum), orderBy: "updateTime desc" },
    );
    const all = this.array(value.courseWorkMaterial);
    return {
      semanticReadContract: "google-classroom-material-posts-v1",
      courseId,
      courseWorkMaterials: all
        .slice(0, maximum)
        .map((item) => this.materialPost(item)),
      resultCount: Math.min(all.length, maximum),
      truncated: Boolean(value.nextPageToken) || all.length > maximum,
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async request(
    token: string,
    path: string,
    query: Record<string, string>,
  ) {
    this.token(token);
    const url = new URL(path, this.origin);
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    if (!this.safeUrl(url))
      throw new GoogleClassroomApiError(
        "provider_validation_error",
        "Classroom URL or query is outside Relay's stable-v1 allowlist.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new GoogleClassroomApiError(
        "provider_unavailable",
        "Classroom API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new GoogleClassroomApiError(
        "provider_validation_error",
        "Classroom response exceeded Relay's 1 MB bound.",
      );
    if (!response.ok)
      throw new GoogleClassroomApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Classroom rejected the bounded read request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleClassroomApiError(
        "provider_validation_error",
        "Classroom returned invalid JSON.",
      );
    }
  }
  private safeUrl(url: URL) {
    if (
      url.protocol !== "https:" ||
      url.hostname !== "classroom.googleapis.com" ||
      url.hash ||
      url.username ||
      url.password
    )
      return false;
    const values = Object.fromEntries(url.searchParams.entries()),
      keys = [...url.searchParams.keys()].sort().join(",");
    if (url.pathname === "/v1/courses")
      return keys === "pageSize" && this.validMaximum(values.pageSize);
    if (/^\/v1\/courses\/[A-Za-z0-9_-]{1,128}$/.test(url.pathname))
      return keys === "";
    if (
      /^\/v1\/courses\/[A-Za-z0-9_-]{1,128}\/(?:courseWork|courseWorkMaterials)$/.test(
        url.pathname,
      )
    )
      return (
        keys === "orderBy,pageSize" &&
        values.orderBy === "updateTime desc" &&
        this.validMaximum(values.pageSize)
      );
    return false;
  }
  private course(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(item.id, 128),
      name: this.scalar(item.name, 750),
      section: this.scalar(item.section, 512),
      subject: this.scalar(item.subject, 512),
      levels: this.scalar(item.levels, 512),
      descriptionHeading: this.scalar(item.descriptionHeading, 512),
      description: this.scalar(item.description, 4_000),
      room: this.scalar(item.room, 512),
      courseState: this.scalar(item.courseState, 32),
      alternateLink: this.safeUrlString(item.alternateLink),
      creationTime: this.scalar(item.creationTime, 64),
      updateTime: this.scalar(item.updateTime, 64),
      sensitiveFieldsExcluded: true,
      enrollmentCodeReturned: false,
      ownerIdentityReturned: false,
      groupEmailsReturned: false,
      teacherFolderReturned: false,
      gradebookReturned: false,
      redactionStatus: "private-state-excluded",
    };
  }
  private courseWork(value: unknown) {
    const item = this.object(value);
    return {
      courseId: this.scalar(item.courseId, 128),
      id: this.scalar(item.id, 128),
      title: this.scalar(item.title, 1_000),
      description: this.scalar(item.description, 4_000),
      workType: this.scalar(item.workType, 64),
      state: this.scalar(item.state, 32),
      creationTime: this.scalar(item.creationTime, 64),
      updateTime: this.scalar(item.updateTime, 64),
      scheduledTime: this.scalar(item.scheduledTime, 64),
      dueDate: this.date(item.dueDate),
      dueTime: this.time(item.dueTime),
      maxPoints: this.number(item.maxPoints),
      alternateLink: this.safeUrlString(item.alternateLink),
      topicId: this.scalar(item.topicId, 128),
      assigneeMode: this.scalar(item.assigneeMode, 32),
      materials: this.materials(item.materials),
      individualStudentIdsExcluded: true,
      creatorIdentityReturned: false,
      submissionsGradesReturned: false,
      redactionStatus: "private-state-excluded",
    };
  }
  private materialPost(value: unknown) {
    const item = this.object(value);
    return {
      courseId: this.scalar(item.courseId, 128),
      id: this.scalar(item.id, 128),
      title: this.scalar(item.title, 1_000),
      description: this.scalar(item.description, 4_000),
      state: this.scalar(item.state, 32),
      creationTime: this.scalar(item.creationTime, 64),
      updateTime: this.scalar(item.updateTime, 64),
      scheduledTime: this.scalar(item.scheduledTime, 64),
      alternateLink: this.safeUrlString(item.alternateLink),
      topicId: this.scalar(item.topicId, 128),
      assigneeMode: this.scalar(item.assigneeMode, 32),
      materials: this.materials(item.materials),
      individualStudentIdsExcluded: true,
      creatorIdentityReturned: false,
      redactionStatus: "private-state-excluded",
    };
  }
  private materials(value: unknown) {
    return this.array(value)
      .slice(0, 20)
      .map((entry) => {
        const item = this.object(entry);
        if (item.link) {
          const link = this.object(item.link);
          return {
            type: "link",
            title: this.scalar(link.title, 512),
            url: this.safeUrlString(link.url),
          };
        }
        if (item.youtubeVideo) {
          const video = this.object(item.youtubeVideo);
          return {
            type: "youtubeVideo",
            title: this.scalar(video.title, 512),
            alternateLink: this.safeUrlString(video.alternateLink),
          };
        }
        if (item.form) {
          const form = this.object(item.form);
          return {
            type: "form",
            title: this.scalar(form.title, 512),
            formUrl: this.safeUrlString(form.formUrl),
            responseUrlReturned: false,
          };
        }
        if (item.driveFile) {
          const drive = this.object(this.object(item.driveFile).driveFile);
          return {
            type: "driveFile",
            title: this.scalar(drive.title, 512),
            alternateLink: this.safeUrlString(drive.alternateLink),
            driveIdReturned: false,
          };
        }
        return { type: "unsupported-redacted" };
      });
  }
  private boundary() {
    return {
      readOnlyV1: true,
      requestingUserOnly: true,
      maxResults: 25,
      rostersEnabled: false,
      profilesEnabled: false,
      studentSubmissionsGradesEnabled: false,
      guardiansInvitationsEnabled: false,
      writesEnabled: false,
      domainDelegationEnabled: false,
      adminImpersonationEnabled: false,
      previewEnabled: false,
      automaticPagination: false,
      rawProviderToolExposure: false,
      redactionStatus:
        "people-submissions-grades-guardians-writes-delegation-preview-pagination-raw-excluded",
    };
  }
  private maxResults(value: unknown) {
    if (value === undefined || value === null) return 25;
    if (
      !Number.isInteger(value) ||
      (value as number) < 1 ||
      (value as number) > 25
    )
      throw new GoogleClassroomApiError(
        "provider_validation_error",
        "maxResults must be an integer from 1 through 25.",
      );
    return value as number;
  }
  private validMaximum(value: string | undefined) {
    return Boolean(value && /^(?:[1-9]|1[0-9]|2[0-5])$/.test(value));
  }
  private courseId(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
      throw new GoogleClassroomApiError(
        "provider_validation_error",
        "courseId must be an explicit safe Classroom course ID.",
      );
    return value;
  }
  private token(value: string) {
    if (!value || value.length > 8_000)
      throw new GoogleClassroomApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private scalar(value: unknown, maximum: number): string | null {
    return typeof value === "string" ? value.slice(0, maximum) : null;
  }
  private number(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private date(value: unknown) {
    const item = this.object(value);
    return {
      year: this.number(item.year),
      month: this.number(item.month),
      day: this.number(item.day),
    };
  }
  private time(value: unknown) {
    const item = this.object(value);
    return {
      hours: this.number(item.hours),
      minutes: this.number(item.minutes),
      seconds: this.number(item.seconds),
      nanos: this.number(item.nanos),
    };
  }
  private safeUrlString(value: unknown): string | null {
    if (typeof value !== "string" || value.length > 2_048) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }
}
