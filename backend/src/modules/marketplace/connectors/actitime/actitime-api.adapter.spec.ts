jest.mock("node:dns/promises", () => ({
  lookup: jest.fn().mockResolvedValue([{ address: "203.0.113.10", family: 4 }]),
}));

import { ActiTimeApiAdapter, ActiTimeApiError } from "./actitime-api.adapter";
import {
  ACTITIME_MANAGE_OPERATION_IDS,
  ACTITIME_OPERATIONS,
  ACTITIME_READ_OPERATION_IDS,
  ACTITIME_SOURCE_SHA256,
} from "./actitime-operation-registry";

describe("ActiTimeApiAdapter", () => {
  const credentials = {
    installationUrl: "https://team.example.com/actitime/",
    username: "relay-integration",
    password: "customer-owned-password",
  };

  it("pins the complete public REST resource contract", () => {
    expect(ACTITIME_SOURCE_SHA256).toHaveLength(64);
    expect(ACTITIME_OPERATIONS).toHaveLength(58);
    expect(ACTITIME_READ_OPERATION_IDS).toHaveLength(32);
    expect(ACTITIME_MANAGE_OPERATION_IDS).toHaveLength(26);
    expect(ACTITIME_OPERATIONS.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "customers.list",
        "timetrack.adjust",
        "users.me",
        "userRates.replace",
        "hooks.create",
        "batch.execute",
      ]),
    );
  });

  it("sends Basic auth only to the configured installation API route", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 7,
          username: "relay-integration",
          password: "hidden",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const result = await new ActiTimeApiAdapter().read(
      credentials,
      "users.get",
      {
        pathParameters: { uid: "7" },
        query: { includeReferenced: "departments" },
      },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        "https://team.example.com/actitime/api/v1/users/7?includeReferenced=departments",
      ),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("relay-integration:customer-owned-password").toString("base64")}`,
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      id: 7,
      username: "relay-integration",
      password: "[REDACTED]",
    });
  });

  it("rejects cross-tool operations, private URLs, and credential-bearing inputs", async () => {
    const adapter = new ActiTimeApiAdapter();
    expect(() =>
      adapter.read(credentials, ACTITIME_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts read-only");
    await expect(
      adapter.read(
        { ...credentials, installationUrl: "https://127.0.0.1/" },
        "users.me",
        {},
      ),
    ).rejects.toThrow("private or local address");
    await expect(
      adapter.manage(credentials, "customers.create", {
        json: { name: "Test", password: "never" },
      }),
    ).rejects.toThrow("Credential-bearing field password is not allowed");
  });

  it("rejects unpinned operations and missing exact path parameters", async () => {
    const adapter = new ActiTimeApiAdapter();
    expect(() => adapter.read(credentials, "raw.request", {})).toThrow(
      ActiTimeApiError,
    );
    await expect(adapter.read(credentials, "tasks.get", {})).rejects.toThrow(
      "path parameters must exactly match",
    );
  });
});
