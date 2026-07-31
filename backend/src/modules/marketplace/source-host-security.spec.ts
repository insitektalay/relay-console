import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CreateLocalMarketplaceAppDto,
  UpdateLocalMarketplaceAppDto,
} from "./dto/marketplace.dto";

const strictPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

function bodyMetadata(
  metatype: ArgumentMetadata["metatype"],
): ArgumentMetadata {
  return { type: "body", metatype, data: undefined };
}

function repositorySource(relativePath: string) {
  return readFileSync(resolve(__dirname, "../../../..", relativePath), "utf8");
}

describe("H-04 marketplace source-host security boundary", () => {
  it.each([
    [
      CreateLocalMarketplaceAppDto,
      {
        name: "Unsafe source",
        repoPath: "/app",
        sourceHostType: "current_backend",
      },
    ],
    [
      UpdateLocalMarketplaceAppDto,
      {
        sourceHostType: "current_backend",
        repoPath: "/",
      },
    ],
  ])("rejects the retired Railway source type in %s", async (type, body) => {
    await expect(
      strictPipe.transform(body, bodyMetadata(type)),
    ).rejects.toThrow();
  });

  it.each(["openclaw_bridge", "hermes_bridge", "runtime_host"] as const)(
    "accepts the paired %s source type",
    async (sourceHostType) => {
      await expect(
        strictPipe.transform(
          {
            name: "Paired source",
            repoPath: "/srv/repositories/example",
            sourceHostType,
            sourceHostId: "server-issued-host-id",
          },
          bodyMetadata(CreateLocalMarketplaceAppDto),
        ),
      ).resolves.toMatchObject({ sourceHostType });
    },
  );

  it("contains no Railway filesystem source implementation or producer", () => {
    const service = repositorySource(
      "backend/src/modules/marketplace/marketplace.service.ts",
    );
    const dto = repositorySource(
      "backend/src/modules/marketplace/dto/marketplace.dto.ts",
    );
    const bridge = repositorySource(
      "backend/src/modules/bridge/bridge.service.ts",
    );
    const contracts = repositorySource("packages/contracts/src/index.ts");
    const webActions = repositorySource(
      "web/features/marketplace/use-marketplace-local-actions.ts",
    );

    expect(service).not.toContain("current_backend");
    expect(service).not.toMatch(/from ["']node:fs(?:\/promises)?["']/);
    expect(service).not.toContain("discoverBackendLocalRepoSource");
    expect(service).not.toContain("readLocalSourceDirectory");
    expect(dto).not.toContain("current_backend");
    expect(bridge).not.toContain("current_backend");
    expect(contracts).not.toContain("current_backend");
    expect(webActions).not.toContain("current_backend");
  });
});
