import {
  FirebaseApiAdapter,
  FirebaseApiError,
  type FirebaseCredentials,
} from "./firebase-api.adapter";

const credentials: FirebaseCredentials = {
  accessToken: "firebase-access-token",
  projectId: "relay-prod",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("FirebaseApiAdapter", () => {
  it("lists one bounded page of active Firebase Projects", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        results: [
          {
            name: "projects/relay-prod",
            projectId: "relay-prod",
            projectNumber: "123456789",
            displayName: "Relay Production",
            state: "ACTIVE",
          },
        ],
        nextPageToken: "short-lived",
      }),
    );
    const result = await new FirebaseApiAdapter(requester).listProjects(
      credentials,
      { limit: 5 },
    );
    expect(requester.mock.calls[0][0]).toBe(
      "https://firebase.googleapis.com/v1beta1/projects?pageSize=5&showDeleted=false",
    );
    expect(result).toMatchObject({ returnedCount: 1, more: true });
    expect(result.projects[0]).toMatchObject({
      projectId: "relay-prod",
      adminSdkConfigReturned: false,
    });
  });

  it("rejects an exact Project response with a changed binding", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        name: "projects/other-prod",
        projectId: "other-prod",
        projectNumber: "987654321",
        state: "ACTIVE",
      }),
    );
    await expect(
      new FirebaseApiAdapter(requester).getProject(credentials),
    ).rejects.toMatchObject({ code: "firebase_project_binding_mismatch" });
  });

  it("lists selected-Project Apps without API-key identifiers or configs", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        apps: [
          {
            name: "projects/relay-prod/webApps/1:123:web:abc",
            displayName: "Relay Web",
            platform: "WEB",
            appId: "1:123:web:abc",
            apiKeyId: "sensitive-api-key-id",
            state: "ACTIVE",
          },
        ],
      }),
    );
    const result = await new FirebaseApiAdapter(requester).listApps(
      credentials,
      { limit: 10 },
    );
    expect(requester.mock.calls[0][0]).toBe(
      "https://firebase.googleapis.com/v1beta1/projects/relay-prod:searchApps?pageSize=10&showDeleted=false",
    );
    expect(JSON.stringify(result)).not.toContain("sensitive-api-key-id");
    expect(result).toMatchObject({
      returnedCount: 1,
      apiKeyIdsReturned: false,
      appConfigsReturned: false,
    });
  });

  it("maps rate limiting and rejects unbounded limits", async () => {
    const adapter = new FirebaseApiAdapter(
      jest.fn().mockResolvedValue(response({}, 429)),
    );
    await expect(
      adapter.listProjects(credentials, { limit: 25 }),
    ).rejects.toMatchObject({ code: "firebase_rate_limited", statusCode: 429 });
    await expect(
      adapter.listProjects(credentials, { limit: 26 }),
    ).rejects.toBeInstanceOf(FirebaseApiError);
  });
});
