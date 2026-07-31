import * as fs from "node:fs";
import * as path from "node:path";

describe("Hermes runtime security boundary", () => {
  const moduleRoot = path.resolve(__dirname);
  const backendSrc = path.resolve(moduleRoot, "../..");
  const repositoryRoot = path.resolve(backendSrc, "../..");

  it("does not carry host paths in worker, bridge, DTO, or client contracts", () => {
    const workerTypes = fs.readFileSync(
      path.join(moduleRoot, "hermes-worker.types.ts"),
      "utf8",
    );
    const adapter = fs.readFileSync(
      path.join(moduleRoot, "hermes-runtime.adapter.ts"),
      "utf8",
    );
    const agentDto = fs.readFileSync(
      path.join(backendSrc, "modules", "agent", "dto", "agent.dto.ts"),
      "utf8",
    );
    const webProducer = fs.readFileSync(
      path.join(
        repositoryRoot,
        "web",
        "features",
        "agents",
        "use-relay-agent-actions.ts",
      ),
      "utf8",
    );
    const bridgeService = fs.readFileSync(
      path.join(backendSrc, "modules", "bridge", "bridge.service.ts"),
      "utf8",
    );

    expect(workerTypes).not.toMatch(/\bworkspaceRoot\??\s*:/);
    expect(agentDto).not.toMatch(/\bworkspaceRoot\??\s*:/);
    expect(webProducer).not.toMatch(/\bworkspaceRoot\s*:/);
    expect(adapter).toContain("workspaceKey:");
    expect(adapter).not.toMatch(/workspaceRoot:\s*binding\./);
    expect(adapter).not.toMatch(/repoPath:\s*binding\./);
    expect(bridgeService).not.toContain("binding.workspaceRoot");
    expect(bridgeService).toContain("binding.repoKey");
  });

  it("pins the base image, runs as non-root, and forbids unsafe toolsets", () => {
    const runtimeRoot = path.join(repositoryRoot, "hermes-runtime");
    const dockerfile = fs.readFileSync(
      path.join(runtimeRoot, "Dockerfile"),
      "utf8",
    );
    const dependencyLock = fs.readFileSync(
      path.join(runtimeRoot, "requirements.lock"),
      "utf8",
    );
    expect(dockerfile).toMatch(/^FROM .+@sha256:[a-f0-9]{64}$/m);
    expect(dockerfile).toContain("USER 10001:10001");
    expect(dockerfile).toContain(
      "HERMES_WORKER_FORBIDDEN_TOOLSETS=session_search,terminal",
    );
    expect(dockerfile).toContain("HERMES_WORKER_ENV=production");
    expect(dockerfile).toContain(
      "COPY --chown=root:root requirements.lock pyproject.toml README.md ./",
    );
    expect(dockerfile).toContain("--require-hashes");
    expect(dockerfile).toContain("--only-binary=:all:");
    expect(dockerfile).toContain("--no-build-isolation");
    expect(dockerfile).toContain("--no-deps");
    expect(dockerfile).toContain("python -m pip check");
    expect(dependencyLock).toContain("--require-hashes");
    expect(dependencyLock).toContain("--only-binary=:all:");
    expect(dependencyLock).toMatch(
      /hermes-agent==0\.19\.0 \\\n\s+--hash=sha256:bd0bac012aee38a60894781f4597dc29ee7bedb3448540249921f10d3bef327f/,
    );
    expect(dependencyLock).not.toMatch(
      /^(?!#).*(?:https?:|git\+|file:|--editable|--trusted-host|--index-url)/m,
    );

    const worker = fs.readFileSync(
      path.join(
        repositoryRoot,
        "hermes-runtime",
        "src",
        "hermes_runtime_worker",
        "app.py",
      ),
      "utf8",
    );
    expect(worker).toContain("Production Hermes worker must not run as root");
    expect(worker).toContain("Production Hermes worker must have no capabilities");
    expect(worker).toContain("PR_SET_NO_NEW_PRIVS");
  });

  it("provisions private per-runtime Railway endpoints without public domains", () => {
    const provider = fs.readFileSync(
      path.join(
        backendSrc,
        "modules",
        "runtime",
        "railway-managed-runtime.provider.ts",
      ),
      "utf8",
    );
    expect(provider).toContain(".railway.internal:8765");
    expect(provider).not.toContain("serviceDomainCreate");
    expect(provider).not.toContain(".up.railway.app");
  });
});
