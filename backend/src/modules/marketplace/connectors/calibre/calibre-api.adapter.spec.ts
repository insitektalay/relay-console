import { lookup } from "node:dns/promises";
import {
  CalibreApiAdapter,
  type CalibreCredentials,
} from "./calibre-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: CalibreCredentials = {
  serverOrigin: "https://books.example.com",
  username: "relay-reader",
  password: "test-password",
  libraryId: "main-library",
  bookId: "42",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("CalibreApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("uses one selected-book path and strips private metadata and content", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        application_id: 42,
        timestamp: "2026-01-01T00:00:00+00:00",
        last_modified: "2026-01-02T00:00:00+00:00",
        formats: ["EPUB", "PDF"],
        title: "Private title",
        authors: ["Private author"],
        comments: "Private description",
        identifiers: { isbn: "private" },
        tags: ["private"],
        user_metadata: { private: "private" },
        cover: "/get/cover/private",
        main_format: { epub: "/get/epub/private" },
      }),
    );
    await expect(
      new CalibreApiAdapter().getSelectedBookLifecycle(credentials),
    ).resolves.toEqual({
      book: {
        id: 42,
        libraryId: "main-library",
        addedAt: "2026-01-01T00:00:00+00:00",
        lastModifiedAt: "2026-01-02T00:00:00+00:00",
        formatCount: 2,
        privateBookMetadataIncluded: false,
        bookContentIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://books.example.com/ajax/book/42/main-library?category_urls=false",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe(
      `Basic ${Buffer.from("relay-reader:test-password").toString("base64")}`,
    );
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("error");
  });

  it.each([
    "http://books.example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://books.example.com/calibre",
    "https://user@books.example.com",
  ])(
    "rejects an unsafe Content server origin before network access: %s",
    async (serverOrigin) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new CalibreApiAdapter().getSelectedBookLifecycle({
          ...credentials,
          serverOrigin,
        }),
      ).rejects.toMatchObject({ code: "policy_blocked" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects private DNS resolution before network access", async () => {
    mockedLookup.mockResolvedValue([
      { address: "10.0.0.2", family: 4 },
    ] as never);
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new CalibreApiAdapter().getSelectedBookLifecycle(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe selected IDs before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new CalibreApiAdapter().getSelectedBookLifecycle({
        ...credentials,
        libraryId: "../private",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps authentication failure without exposing response content", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ message: "private" }, 401));
    await expect(
      new CalibreApiAdapter().getSelectedBookLifecycle(credentials),
    ).rejects.toMatchObject({ code: "credential_missing", statusCode: 401 });
  });
});
