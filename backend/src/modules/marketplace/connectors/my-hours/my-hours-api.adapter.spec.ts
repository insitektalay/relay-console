import { MyHoursApiAdapter, MyHoursApiError } from "./my-hours-api.adapter";
import {
  MY_HOURS_MANAGE_OPERATION_IDS,
  MY_HOURS_OPERATIONS,
  MY_HOURS_READ_OPERATION_IDS,
  MY_HOURS_SOURCE_SHA256,
} from "./my-hours-operation-registry";

describe("MyHoursApiAdapter", () => {
  const credentials = { apiKey: "customer-owned-key" };

  afterEach(() => jest.restoreAllMocks());

  it("pins all 35 unique operations from the 36-example official collection", () => {
    expect(MY_HOURS_SOURCE_SHA256).toHaveLength(64);
    expect(MY_HOURS_OPERATIONS).toHaveLength(35);
    expect(MY_HOURS_READ_OPERATION_IDS).toHaveLength(13);
    expect(MY_HOURS_MANAGE_OPERATION_IDS).toHaveLength(22);
    expect(MY_HOURS_OPERATIONS.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "logs.recent",
        "projects.copy",
        "reports.activity",
        "users.archive",
        "teams.members",
      ]),
    );
  });

  it("attaches ApiKey authentication only to the fixed provider route", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 7, apiKey: "hidden" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await new MyHoursApiAdapter().read(
      credentials,
      "projects.get",
      { pathParameters: { projectId: 7 }, query: { includeArchived: false } },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        "https://api2.myhours.com/api/Projects/7/overview?includeArchived=false",
      ),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "ApiKey customer-owned-key",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual([{ id: 7, apiKey: "[REDACTED]" }]);
  });

  it("classifies semantic reads independently of HTTP method", async () => {
    const adapter = new MyHoursApiAdapter();
    expect(() => adapter.read(credentials, "projects.copy", {})).toThrow(
      "read accepts read-only",
    );
    expect(() => adapter.manage(credentials, "reports.activity", {})).toThrow(
      "manage accepts mutation",
    );
  });

  it("rejects unpinned operations, missing path parameters, and credential-bearing bodies", async () => {
    const adapter = new MyHoursApiAdapter();
    expect(() => adapter.read(credentials, "raw.request", {})).toThrow(
      MyHoursApiError,
    );
    await expect(adapter.read(credentials, "users.get", {})).rejects.toThrow(
      "path parameters must exactly match",
    );
    await expect(
      adapter.manage(credentials, "clients.create", {
        json: { name: "Example", apiToken: "never" },
      }),
    ).rejects.toThrow("Credential-bearing field apiToken is not allowed");
  });
});
