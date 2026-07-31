import {
  TimeDoctorApiAdapter,
  TimeDoctorApiError,
} from "./time-doctor-api.adapter";
import {
  TIME_DOCTOR_MANAGE_OPERATION_IDS,
  TIME_DOCTOR_OPERATIONS,
  TIME_DOCTOR_READ_OPERATION_IDS,
} from "./time-doctor-operation-registry";

describe("TimeDoctorApiAdapter", () => {
  it("pins the supported official operation split", () => {
    expect(TIME_DOCTOR_OPERATIONS).toHaveLength(119);
    expect(TIME_DOCTOR_READ_OPERATION_IDS).toHaveLength(61);
    expect(TIME_DOCTOR_MANAGE_OPERATION_IDS).toHaveLength(58);
    expect(TIME_DOCTOR_OPERATIONS.map((operation) => operation.id)).not.toEqual(
      expect.arrayContaining(["login", "getUsersTokens", "getFileSignedUrl"]),
    );
  });

  it("rejects unpinned and cross-tool operations before network access", () => {
    const adapter = new TimeDoctorApiAdapter();
    const credentials = { jwtToken: "test-jwt-token-long-enough" };
    expect(() => adapter.read(credentials, "not_pinned", {})).toThrow(
      TimeDoctorApiError,
    );
    expect(() =>
      adapter.read(credentials, TIME_DOCTOR_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts GET");
  });

  it("sends the JWT only to the fixed origin and redacts credential-shaped output", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ companies: [], token: "provider-secret" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const adapter = new TimeDoctorApiAdapter();
    const result = await adapter.read(
      { jwtToken: "test-jwt-token-long-enough" },
      "getCompanies",
      {},
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://api2.timedoctor.com/api/1.0/companies"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "JWT test-jwt-token-long-enough",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({ companies: [], token: "[REDACTED]" });
  });

  it("rejects credential-bearing runtime fields", async () => {
    const adapter = new TimeDoctorApiAdapter();
    await expect(
      adapter.manage(
        { jwtToken: "test-jwt-token-long-enough" },
        "createProject",
        { json: { password: "never-forward-this" } },
      ),
    ).rejects.toThrow("Credential-bearing field password is not allowed");
  });
});
