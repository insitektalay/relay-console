import { lookup } from "node:dns/promises";
import {
  StrapiSelfHostedApiAdapter,
  type StrapiSelfHostedCredentials,
} from "./strapi-self-hosted-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const documentId = "a1b2c3d4e5f6g7h8i9j0klm";
const credentials: StrapiSelfHostedCredentials = {
  projectBaseUrl: "https://strapi.example.test/platform",
  apiToken: "S".repeat(32),
  contentTypeRoute: "articles",
  documentId,
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("StrapiSelfHostedApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("reads one published document and returns only lifecycle metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          id: 42,
          documentId,
          createdAt: "2026-07-01T10:00:00.000Z",
          updatedAt: "2026-07-02T11:00:00.000Z",
          publishedAt: "2026-07-03T12:00:00.000Z",
          title: "Private title",
          body: "Private content",
          author: { email: "private@example.test" },
        },
      }),
    );
    await expect(
      new StrapiSelfHostedApiAdapter().getSelectedDocumentLifecycle(
        credentials,
      ),
    ).resolves.toEqual({
      document: {
        documentId,
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-02T11:00:00.000Z",
        publishedAt: "2026-07-03T12:00:00.000Z",
        documentContentOrIdentityIncluded: false,
        otherProjectDataIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `https://strapi.example.test/platform/api/articles/${documentId}?fields%5B0%5D=createdAt&fields%5B1%5D=updatedAt&fields%5B2%5D=publishedAt&status=published`,
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${"S".repeat(32)}`,
        },
        redirect: "error",
      }),
    );
  });

  it.each([
    "http://strapi.example.test",
    "https://user@strapi.example.test",
    "https://strapi.example.test/platform?private=true",
    "https://strapi.example.test/platform#private",
    "https://strapi.example.test/platform/%2Fprivate",
  ])(
    "rejects an unsafe project URL before network access: %s",
    async (projectBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new StrapiSelfHostedApiAdapter().getSelectedDocumentLifecycle({
          ...credentials,
          projectBaseUrl,
        }),
      ).rejects.toMatchObject({ code: "policy_blocked" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects private DNS resolution before network access", async () => {
    mockedLookup.mockResolvedValue([
      { address: "192.168.1.10", family: 4 },
    ] as never);
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new StrapiSelfHostedApiAdapter().getSelectedDocumentLifecycle(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens and unsafe route identifiers", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new StrapiSelfHostedApiAdapter().getSelectedDocumentLifecycle({
        ...credentials,
        apiToken: "short",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new StrapiSelfHostedApiAdapter().getSelectedDocumentLifecycle({
        ...credentials,
        contentTypeRoute: "../users",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      new StrapiSelfHostedApiAdapter().getSelectedDocumentLifecycle({
        ...credentials,
        documentId: "../other-document",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a returned document that differs from the selection", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          documentId: "z1y2x3w4v5u6t7s8r9q0ponm",
          createdAt: "2026-07-01T10:00:00.000Z",
          updatedAt: "2026-07-02T11:00:00.000Z",
          publishedAt: "2026-07-03T12:00:00.000Z",
        },
      }),
    );
    await expect(
      new StrapiSelfHostedApiAdapter().getSelectedDocumentLifecycle(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
