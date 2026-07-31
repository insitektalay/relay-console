import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type XrayTestManagementCredentials = {
  clientId: string;
  clientSecret: string;
  projectId: string;
};

export class XrayTestManagementApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class XrayTestManagementApiAdapter {
  private readonly authUrl =
    "https://xray.cloud.getxray.app/api/v2/authenticate";
  private readonly graphUrl = "https://xray.cloud.getxray.app/api/v2/graphql";

  async health(credentials: XrayTestManagementCredentials) {
    await this.listTests(credentials, { limit: 1 });
    return { projectId: credentials.projectId };
  }

  async listTests(
    credentials: XrayTestManagementCredentials,
    input: JsonObject,
  ) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const data = await this.graphql(
      credentials,
      `query RelayXrayTests($projectId: String!, $limit: Int!) {
        getTests(projectId: $projectId, limit: $limit, start: 0) {
          total start limit results { issueId projectId testType { name kind } lastModified }
        }
      }`,
      { projectId: credentials.projectId, limit },
    );
    return this.collection(
      data,
      "getTests",
      limit,
      "test",
      credentials.projectId,
    );
  }

  async getTest(credentials: XrayTestManagementCredentials, input: JsonObject) {
    const issueId = this.issueId(input.issueId);
    const data = await this.graphql(
      credentials,
      `query RelayXrayTest($issueId: String!) {
        getTest(issueId: $issueId) {
          issueId projectId testType { name kind } scenarioType lastModified
        }
      }`,
      { issueId },
    );
    const test = this.object(data.getTest);
    this.requireProject(test, credentials.projectId);
    return this.test(test);
  }

  async listTestExecutions(
    credentials: XrayTestManagementCredentials,
    input: JsonObject,
  ) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const data = await this.graphql(
      credentials,
      `query RelayXrayExecutions($projectId: String!, $limit: Int!) {
        getTestExecutions(projectId: $projectId, limit: $limit, start: 0) {
          total start limit results { issueId projectId testEnvironments lastModified }
        }
      }`,
      { projectId: credentials.projectId, limit },
    );
    return this.collection(
      data,
      "getTestExecutions",
      limit,
      "execution",
      credentials.projectId,
    );
  }

  async getTestRun(
    credentials: XrayTestManagementCredentials,
    input: JsonObject,
  ) {
    return this.testRun(credentials, input);
  }

  async updateTestRunStatus(
    credentials: XrayTestManagementCredentials,
    input: JsonObject,
  ) {
    const run = await this.testRun(credentials, input);
    const status = this.status(input.status);
    const data = await this.graphql(
      credentials,
      `mutation RelayXrayRunStatus($id: String!, $status: String!) {
        updateTestRunStatus(id: $id, status: $status)
      }`,
      { id: run.id, status },
    );
    const result = this.text(data.updateTestRunStatus, 200);
    if (!result)
      throw this.invalid("Xray returned an invalid test-run status result.");
    return { testRunId: run.id, status, result };
  }

  private async testRun(
    credentials: XrayTestManagementCredentials,
    input: JsonObject,
  ) {
    const testIssueId = this.issueId(input.testIssueId);
    const testExecIssueId = this.issueId(input.testExecIssueId);
    const data = await this.graphql(
      credentials,
      `query RelayXrayRun($testIssueId: String!, $testExecIssueId: String!) {
        getTestRun(testIssueId: $testIssueId, testExecIssueId: $testExecIssueId) {
          id status { name } startedOn finishedOn lastModified
          test { issueId projectId }
          testExecution { issueId projectId }
        }
      }`,
      { testIssueId, testExecIssueId },
    );
    const run = this.object(data.getTestRun);
    const test = this.object(run?.test);
    const execution = this.object(run?.testExecution);
    this.requireProject(test, credentials.projectId);
    this.requireProject(execution, credentials.projectId);
    const id = this.text(run?.id, 100);
    if (!run || !id) throw this.invalid("Xray returned an invalid test run.");
    return {
      id,
      status: this.text(this.object(run.status)?.name, 100),
      startedOn: this.text(run.startedOn, 40),
      finishedOn: this.text(run.finishedOn, 40),
      lastModified: this.text(run.lastModified, 40),
      testIssueId: this.text(test?.issueId, 40),
      testExecIssueId: this.text(execution?.issueId, 40),
    };
  }

  private async graphql(
    credentials: XrayTestManagementCredentials,
    query: string,
    variables: JsonObject,
  ) {
    this.assertCredentials(credentials);
    const token = await this.authenticate(credentials);
    const parsed = await this.request(this.graphUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "RelayConsole/1.0",
      },
      body: JSON.stringify({ query, variables }),
    });
    const envelope = this.object(parsed);
    if (!envelope || (Array.isArray(envelope.errors) && envelope.errors.length))
      throw this.invalid("Xray rejected the fixed GraphQL operation.");
    const data = this.object(envelope.data);
    if (!data) throw this.invalid("Xray returned an invalid GraphQL result.");
    return data;
  }

  private async authenticate(credentials: XrayTestManagementCredentials) {
    const parsed = await this.request(this.authUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "RelayConsole/1.0",
      },
      body: JSON.stringify({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    });
    if (
      typeof parsed !== "string" ||
      parsed.length < 20 ||
      parsed.length > 4096
    )
      throw this.invalid("Xray returned an invalid authentication token.");
    return parsed;
  }

  private async request(url: string, init: RequestInit) {
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new XrayTestManagementApiError(
        "provider_unavailable",
        "Xray Test Management could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw this.invalid("Xray response exceeded the 256 KiB Relay limit.");
    let parsed: unknown;
    try {
      parsed = raw.byteLength ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      throw new XrayTestManagementApiError(
        response.ok ? "provider_unavailable" : this.safeCode(response.status),
        "Xray returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new XrayTestManagementApiError(
        this.safeCode(response.status),
        "Xray rejected the fixed API request.",
        response.status,
      );
    return parsed;
  }

  private collection(
    data: JsonObject,
    field: string,
    limit: number,
    kind: "test" | "execution",
    projectId: string,
  ) {
    const envelope = this.object(data[field]);
    const results = Array.isArray(envelope?.results) ? envelope.results : null;
    if (!results) throw this.invalid("Xray returned an invalid bounded list.");
    const total = this.number(envelope?.total);
    const rows = results.slice(0, limit).map((value) => {
      const row = this.object(value);
      this.requireProject(row, projectId);
      return kind === "test" ? this.test(row) : this.execution(row);
    });
    return {
      rows,
      count: rows.length,
      total,
      truncated: total !== null ? total > rows.length : results.length >= limit,
    };
  }

  private test(value: JsonObject | null) {
    const issueId = this.text(value?.issueId, 40);
    const projectId = this.text(value?.projectId, 40);
    if (!value || !issueId || !projectId)
      throw this.invalid("Xray returned an invalid test.");
    const type = this.object(value.testType);
    return {
      issueId,
      projectId,
      testType: this.text(type?.name, 100),
      testKind: this.text(type?.kind, 100),
      scenarioType: this.text(value.scenarioType, 100),
      lastModified: this.text(value.lastModified, 40),
    };
  }

  private execution(value: JsonObject | null) {
    const issueId = this.text(value?.issueId, 40);
    const projectId = this.text(value?.projectId, 40);
    if (!value || !issueId || !projectId)
      throw this.invalid("Xray returned an invalid test execution.");
    const environments = Array.isArray(value.testEnvironments)
      ? value.testEnvironments.slice(0, 20).map((item) => this.text(item, 100))
      : [];
    return {
      issueId,
      projectId,
      testEnvironments: environments,
      lastModified: this.text(value.lastModified, 40),
    };
  }

  private requireProject(value: JsonObject | null, projectId: string) {
    if (this.text(value?.projectId, 40) !== projectId)
      throw new XrayTestManagementApiError(
        "policy_blocked",
        "The Xray resource is outside the configured project.",
        403,
      );
  }

  private assertCredentials(credentials: XrayTestManagementCredentials) {
    if (!/^[A-Za-z0-9_-]{16,200}$/.test(credentials.clientId))
      throw new XrayTestManagementApiError(
        "credential_missing",
        "A valid Xray client ID is required.",
        401,
      );
    if (
      !credentials.clientSecret ||
      credentials.clientSecret.length < 24 ||
      credentials.clientSecret.length > 500 ||
      /[\s\u0000]/.test(credentials.clientSecret)
    )
      throw new XrayTestManagementApiError(
        "credential_missing",
        "A valid Xray client secret is required.",
        401,
      );
    this.projectId(credentials.projectId);
  }

  private projectId(value: unknown) {
    const id = String(value ?? "");
    if (!/^\d{1,30}$/.test(id))
      throw this.invalid("Xray project ID must be one exact numeric Jira ID.");
    return id;
  }

  private issueId(value: unknown) {
    const id = String(value ?? "");
    if (!/^\d{1,30}$/.test(id))
      throw this.invalid("Xray issue ID must be one exact numeric Jira ID.");
    return id;
  }

  private status(value: unknown) {
    const status = String(value ?? "").trim();
    if (!/^[A-Za-z][A-Za-z0-9 _-]{0,39}$/.test(status))
      throw this.invalid("Xray test-run status is invalid.");
    return status;
  }

  private integer(
    value: unknown,
    minimum: number,
    maximum: number,
    fallback: number,
  ) {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
      throw this.invalid(
        `Xray integer must be between ${minimum} and ${maximum}.`,
      );
    return parsed;
  }

  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }

  private text(value: unknown, maximum: number) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    return String(value)
      .replace(/[\r\n\u0000]/g, " ")
      .slice(0, maximum);
  }

  private number(value: unknown) {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 408 || status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }

  private invalid(message: string) {
    return new XrayTestManagementApiError("provider_validation_error", message);
  }
}
