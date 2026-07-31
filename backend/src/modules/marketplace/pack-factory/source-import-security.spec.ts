import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { safeOutboundHttpClient } from "../../../common/security/safe-outbound-http";
import {
  ImportMarketplacePackSourcesDto,
  UpdateMarketplacePackSourcesDto,
} from "../dto/marketplace.dto";
import { importDocsSources } from "./docs-source-importer";
import {
  importOpenApiSource,
  summarizeOpenApiSpec,
} from "./openapi-importer";

const strictPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});
const bodyMetadata: ArgumentMetadata = {
  type: "body",
  metatype: ImportMarketplacePackSourcesDto,
  data: undefined,
};

describe("pack source request boundary", () => {
  it("keeps both remote importers on the shared client with no file reads", () => {
    const importerRoot = __dirname;
    const docsImporter = readFileSync(
      join(importerRoot, "docs-source-importer.ts"),
      "utf8",
    );
    const openApiImporter = readFileSync(
      join(importerRoot, "openapi-importer.ts"),
      "utf8",
    );
    const dtoSource = readFileSync(
      join(importerRoot, "..", "dto", "marketplace.dto.ts"),
      "utf8",
    );

    expect(docsImporter).toContain("safeOutboundHttpClient.getText");
    expect(openApiImporter).toContain("safeOutboundHttpClient.getText");
    expect(docsImporter).not.toMatch(/\bfetch\s*\(/);
    expect(openApiImporter).not.toMatch(/\bfetch\s*\(|\breadFile\b/);
    expect(dtoSource).not.toContain("openApiSpecFilePath");
  });

  it("rejects the removed host file-path authority", async () => {
    await expect(
      strictPipe.transform(
        { openApiSpecFilePath: "/etc/passwd" },
        bodyMetadata,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    "file:///etc/passwd",
    "http://127.0.0.1/openapi.json",
    "data:application/json,{}",
    "ftp://vendor.com/openapi.json",
  ])("rejects non-HTTPS import URL %s", async (openApiSpecUrl) => {
    await expect(
      strictPipe.transform({ openApiSpecUrl }, bodyMetadata),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects unknown nested docs fields", async () => {
    await expect(
      strictPipe.transform(
        { docs: { apiOverview: "https://vendor.com", filePath: "/etc" } },
        {
          ...bodyMetadata,
          metatype: UpdateMarketplacePackSourcesDto,
        },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("accepts bounded inline OpenAPI content as the file-path replacement", async () => {
    await expect(
      strictPipe.transform(
        {
          openApiSpecContent: JSON.stringify({
            openapi: "3.0.0",
            paths: {},
          }),
        },
        bodyMetadata,
      ),
    ).resolves.toMatchObject({
      openApiSpecContent: expect.stringContaining('"openapi":"3.0.0"'),
    });
  });
});

describe("bounded pack source importers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the shared safe client for documentation URLs", async () => {
    const getText = jest
      .spyOn(safeOutboundHttpClient, "getText")
      .mockResolvedValue({
        url: "https://docs.vendor.com/api",
        status: 200,
        contentType: "text/markdown",
        text: "GET /api/items",
        decodedBytes: 14,
      });

    const model = await importDocsSources([
      {
        kind: "official_api_docs",
        url: "https://docs.vendor.com/api",
        official: true,
      },
    ]);

    expect(getText).toHaveBeenCalledWith(
      "https://docs.vendor.com/api",
      expect.objectContaining({ maxBytes: 400_000, maxRedirects: 3 }),
    );
    expect(model.ingestionErrors).toEqual([]);
  });

  it("rejects too many documentation sources", async () => {
    await expect(
      importDocsSources(
        Array.from({ length: 9 }, (_, index) => ({
          kind: "manual_notes" as const,
          notes: `note ${index}`,
          official: false,
        })),
      ),
    ).rejects.toThrow("At most 8");
  });

  it("rejects oversized inline documentation before parsing", async () => {
    await expect(
      importDocsSources([
        {
          kind: "manual_notes",
          notes: "x".repeat(100_001),
          official: false,
        },
      ]),
    ).rejects.toThrow("byte limit");
  });

  it("does not accept a file path in the OpenAPI importer", async () => {
    await expect(
      importOpenApiSource({
        kind: "openapi_spec",
        filePath: "/etc/passwd",
        official: false,
      } as any),
    ).rejects.toThrow("HTTPS URL or inline content");
  });

  it("summarizes bounded inline OpenAPI content", async () => {
    const model = await importOpenApiSource({
      kind: "openapi_spec",
      notes: JSON.stringify({
        openapi: "3.0.0",
        paths: {
          "/items": {
            get: { summary: "List items", tags: ["Items"] },
          },
        },
      }),
      official: false,
    });

    expect(model.endpoints).toEqual([
      expect.objectContaining({ method: "GET", path: "/items" }),
    ]);
  });

  it("rejects excessive OpenAPI path complexity", () => {
    const paths = Object.fromEntries(
      Array.from({ length: 1_001 }, (_, index) => [
        `/items/${index}`,
        { get: {} },
      ]),
    );
    expect(() => summarizeOpenApiSpec({ paths })).toThrow("exceeds 1000");
  });
});
