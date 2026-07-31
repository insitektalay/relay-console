import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateAgentDto } from "./agent.dto";

describe("agent runtime-binding DTO security", () => {
  const validateCreate = (runtimeBinding: Record<string, unknown>) =>
    validate(
      plainToInstance(CreateAgentDto, {
        name: "Hermes",
        workspaceId: "workspace-1",
        role: "Reviewer",
        runtimeBinding,
      }),
      {
        whitelist: true,
        forbidNonWhitelisted: true,
      },
    );

  it("rejects a nested workspaceRoot before service execution", async () => {
    const errors = await validateCreate({
      runtimeType: "hermes",
      repoKey: "review-repo",
      workspaceRoot: "/private/repository",
    });

    expect(JSON.stringify(errors)).toContain("workspaceRoot");
    expect(JSON.stringify(errors)).toContain("should not exist");
  });

  it("accepts the bounded opaque runtime-binding contract", async () => {
    await expect(
      validateCreate({
        runtimeType: "hermes",
        adapterKind: "hermes_bridge",
        routingMode: "default_target",
        repoKey: "review-repo",
        isEnabled: true,
        capabilities: { bridgeBacked: true },
        configMetadata: { model: "openai/gpt-5" },
      }),
    ).resolves.toEqual([]);
  });
});
