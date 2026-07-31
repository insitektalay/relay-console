import {
  AmplitudeExperimentApiAdapter,
  type AmplitudeExperimentCredentials,
} from "./amplitude-experiment-api.adapter";
import { AMPLITUDE_EXPERIMENT_OPERATIONS } from "./amplitude-experiment-operation-registry";

describe("AmplitudeExperimentApiAdapter", () => {
  const credentials: AmplitudeExperimentCredentials = {
    managementApiKey: "secret",
    region: "eu",
    projectId: "project_123",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins four read-only flag and experiment operations", () => {
    expect(AMPLITUDE_EXPERIMENT_OPERATIONS).toHaveLength(4);
    expect(
      AMPLITUDE_EXPERIMENT_OPERATIONS.every((operation) =>
        operation.path.startsWith("/api/1/"),
      ),
    ).toBe(true);
  });

  it("binds collections to the stored project and fixed EU origin with caps", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("[]"));
    await new AmplitudeExperimentApiAdapter().read(
      credentials,
      "list_experiments",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://experiment.eu.amplitude.com/api/1/experiments?projectId=project_123&limit=25&includeArchived=false",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });

  it("pins exact resource routes without project or cursor expansion", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("{}"));
    await new AmplitudeExperimentApiAdapter().read(credentials, "get_flag", {
      resourceId: "flag_456",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://experiment.eu.amplitude.com/api/1/flags/flag_456",
    );
  });

  it("blocks routing/project input, cross-operation IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new AmplitudeExperimentApiAdapter();
    await expect(
      adapter.read(credentials, "list_flags", { resourceId: "flag" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.read(credentials, "list_flags", { projectId: "other" } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(() => adapter.read(credentials, "update_rollout", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
