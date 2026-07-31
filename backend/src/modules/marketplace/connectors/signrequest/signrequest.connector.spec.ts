import {
  SignRequestApiAdapter,
  SignRequestApiError,
} from "./signrequest-api.adapter";
import { SIGNREQUEST_CONNECTOR_MANIFEST } from "./signrequest.connector";

describe("SignRequest connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses exactly the read scope and two bounded reads", () => {
    expect(SIGNREQUEST_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual([
      "read",
    ]);
    expect(SIGNREQUEST_CONNECTOR_MANIFEST.auth.oauth?.pkce).toBe(false);
    expect(SIGNREQUEST_CONNECTOR_MANIFEST.tools).toHaveLength(2);
    expect(
      SIGNREQUEST_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && !tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("lists one bounded page and strips people, files, teams, and signing data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            results: Array.from({ length: 30 }, (_, index) => ({
              uuid: `123e4567-e89b-12d3-a456-4266141740${String(index).padStart(2, "0")}`,
              name: `Agreement ${index}`,
              status: "co",
              processing: false,
              user: { email: "private@example.com" },
              team: { subdomain: "private-team" },
              file: "https://private.example/file",
              signrequest: { signers: [{ email: "signer@example.com" }] },
            })),
          }),
          { status: 200 },
        ),
      );
    const result = await new SignRequestApiAdapter().listDocuments("token", {
      resultLimit: 25,
    });
    expect(new URL(String(fetchMock.mock.calls[0][0])).toString()).toBe(
      "https://signrequest.com/api/v1/documents/?limit=25",
    );
    expect(result.documents).toHaveLength(25);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("private-team");
    expect(JSON.stringify(result)).not.toContain("signer@example.com");
    expect(result).toMatchObject({
      exactReadScope: true,
      automaticPagination: false,
    });
  });

  it("reads one fixed document UUID and returns only lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            uuid: "123e4567-e89b-12d3-a456-426614174000",
            name: "NDA",
            status: "se",
            processing: false,
            created: "2026-07-17T10:00:00Z",
            modified: "2026-07-17T11:00:00Z",
            file_as_pdf: "https://private.example/pdf",
            user: { email: "private@example.com" },
          }),
          { status: 200 },
        ),
      );
    const result = await new SignRequestApiAdapter().getDocument("token", {
      documentUuid: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.document).toEqual({
      documentUuid: "123e4567-e89b-12d3-a456-426614174000",
      name: "NDA",
      status: "se",
      processing: false,
      createdAt: "2026-07-17T10:00:00Z",
      modifiedAt: "2026-07-17T11:00:00Z",
      autoDeleteAfter: null,
    });
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("rejects invalid UUIDs and limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new SignRequestApiAdapter();
    await expect(
      adapter.getDocument("token", { documentUuid: "../../users" }),
    ).rejects.toBeInstanceOf(SignRequestApiError);
    await expect(
      adapter.listDocuments("token", { resultLimit: 26 }),
    ).rejects.toBeInstanceOf(SignRequestApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
