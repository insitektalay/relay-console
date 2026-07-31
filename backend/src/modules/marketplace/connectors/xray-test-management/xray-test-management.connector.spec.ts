import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  XrayTestManagementApiAdapter,
  XrayTestManagementApiError,
} from "./xray-test-management-api.adapter";
import { XRAY_TEST_MANAGEMENT_CONNECTOR_MANIFEST } from "./xray-test-management.connector";

const credentials = {
  clientId: "A".repeat(32),
  clientSecret: "b".repeat(64),
  projectId: "10000",
};
const token = "x".repeat(64);
const auth = () => new Response(JSON.stringify(token), { status: 200 });

describe("Xray Test Management connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers five approval-gated fixed Xray tools", () => {
    expect(new MarketplaceConnectorRegistry().get("xray-test-management")).toBe(
      XRAY_TEST_MANAGEMENT_CONNECTOR_MANIFEST,
    );
    expect(XRAY_TEST_MANAGEMENT_CONNECTOR_MANIFEST.tools).toHaveLength(5);
    expect(
      XRAY_TEST_MANAGEMENT_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("authenticates only at Xray Cloud and pins list variables to one project", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              getTests: {
                total: 2,
                start: 0,
                limit: 1,
                results: [
                  {
                    issueId: "20001",
                    projectId: "10000",
                    testType: { name: "Manual", kind: "Steps" },
                    lastModified: "2026-07-18T01:00:00Z",
                  },
                ],
              },
            },
          }),
          { status: 200 },
        ),
      );
    const result = await new XrayTestManagementApiAdapter().listTests(
      credentials,
      { limit: 1 },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://xray.cloud.getxray.app/api/v2/authenticate",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://xray.cloud.getxray.app/api/v2/graphql",
    );
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.variables).toEqual({ projectId: "10000", limit: 1 });
    expect(body.query).not.toContain("jql");
    expect(result).toEqual(
      expect.objectContaining({ count: 1, total: 2, truncated: true }),
    );
  });

  it("rejects exact resources outside the configured project", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              getTest: {
                issueId: "20001",
                projectId: "99999",
                testType: { name: "Manual", kind: "Steps" },
              },
            },
          }),
          { status: 200 },
        ),
      );
    await expect(
      new XrayTestManagementApiAdapter().getTest(credentials, {
        issueId: "20001",
      }),
    ).rejects.toMatchObject<Partial<XrayTestManagementApiError>>({
      code: "policy_blocked",
    });
  });

  it("resolves and verifies a Test Run before updating only its status", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              getTestRun: {
                id: "run-1",
                status: { name: "TODO" },
                test: { issueId: "20001", projectId: "10000" },
                testExecution: { issueId: "30001", projectId: "10000" },
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { updateTestRunStatus: "run-1" } }),
          { status: 200 },
        ),
      );
    const result = await new XrayTestManagementApiAdapter().updateTestRunStatus(
      credentials,
      {
        testIssueId: "20001",
        testExecIssueId: "30001",
        status: "PASSED",
      },
    );
    const mutation = JSON.parse(String(fetchMock.mock.calls[3][1]?.body));
    expect(mutation.variables).toEqual({ id: "run-1", status: "PASSED" });
    expect(result).toEqual({
      testRunId: "run-1",
      status: "PASSED",
      result: "run-1",
    });
  });

  it("rejects arbitrary issue IDs and status syntax before provider mutation", async () => {
    await expect(
      new XrayTestManagementApiAdapter().updateTestRunStatus(credentials, {
        testIssueId: "ABC-1",
        testExecIssueId: "30001",
        status: "PASSED",
      }),
    ).rejects.toMatchObject<Partial<XrayTestManagementApiError>>({
      code: "provider_validation_error",
    });
    expect(jest.spyOn(global, "fetch")).not.toHaveBeenCalled();
  });

  it("returns secret-safe provider errors", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: `secret ${credentials.clientSecret}` }),
          { status: 401 },
        ),
      );
    const promise = new XrayTestManagementApiAdapter().listTests(
      credentials,
      {},
    );
    await expect(promise).rejects.toThrow(
      "Xray rejected the fixed API request.",
    );
    await expect(promise).rejects.not.toThrow(credentials.clientSecret);
  });
});
