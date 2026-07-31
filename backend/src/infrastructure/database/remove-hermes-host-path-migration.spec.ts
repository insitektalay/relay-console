import { RemoveHermesHostPathAuthority1785182600068 } from "../../migrations/068_remove_hermes_host_path_authority";

describe("RemoveHermesHostPathAuthority migration", () => {
  it("scrubs Hermes host paths and prevents them from returning", async () => {
    const queries: string[] = [];
    const migration = new RemoveHermesHostPathAuthority1785182600068();
    await migration.up({
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
      }),
    } as never);
    const combined = queries.join("\n");

    expect(combined).toContain('"workspaceRoot" = NULL');
    expect(combined).toContain("- 'repoPath'");
    expect(combined).toContain(
      "CHK_runtime_bindings_no_hermes_host_path",
    );
    expect(combined).toContain('"runtimeType" = \'hermes\'');
  });

  it("is intentionally forward-only", async () => {
    const query = jest.fn();
    await new RemoveHermesHostPathAuthority1785182600068().down({
      query,
    } as never);
    expect(query).not.toHaveBeenCalled();
  });
});
