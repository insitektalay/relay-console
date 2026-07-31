import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import {
  ACTBLUE_BOUNDED_REST_CONNECTOR,
  ACTBLUE_MANAGE_OPERATION_IDS,
  ACTBLUE_OPERATIONS,
} from "./actblue-operation-registry";

const credentials = {
  ACTBLUE_CLIENT_UUID: "11111111-1111-1111-1111-111111111111",
  ACTBLUE_CLIENT_SECRET: "test-client-secret",
};

describe("ActBlue connector", () => {
  it("pins the two official CSV API actions and one hidden health probe", () => {
    expect(ACTBLUE_OPERATIONS).toHaveLength(3);
    expect(ACTBLUE_MANAGE_OPERATION_IDS).toEqual([
      "create_csv_report",
      "get_csv_report",
    ]);
  });

  it("generates a bounded report with Basic auth on the fixed origin", async () => {
    const requester = jest.fn(
      async () =>
        new Response(JSON.stringify({ id: "report-id" }), { status: 202 }),
    );
    await new BoundedRestApiAdapter(requester).execute(
      ACTBLUE_BOUNDED_REST_CONNECTOR,
      credentials,
      "manage",
      "create_csv_report",
      {
        json: {
          csv_type: "paid_contributions",
          date_range_start: "2026-07-01",
          date_range_end: "2026-07-18",
        },
      },
    );
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe("https://secure.actblue.com/api/v1/csvs");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from(`${credentials.ACTBLUE_CLIENT_UUID}:${credentials.ACTBLUE_CLIENT_SECRET}`).toString("base64")}`,
    );
  });

  it("keeps signed report retrieval in the approval-gated manage mode", async () => {
    const requester = jest.fn(
      async () =>
        new Response(
          JSON.stringify({ id: "report-id", status: "in_progress" }),
        ),
    );
    await new BoundedRestApiAdapter(requester).execute(
      ACTBLUE_BOUNDED_REST_CONNECTOR,
      credentials,
      "manage",
      "get_csv_report",
      {
        pathParameters: {
          csvId: "22222222-2222-2222-2222-222222222222",
        },
      },
    );
    const [url] = requester.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe(
      "https://secure.actblue.com/api/v1/csvs/22222222-2222-2222-2222-222222222222",
    );
    await expect(
      new BoundedRestApiAdapter(requester).execute(
        ACTBLUE_BOUNDED_REST_CONNECTOR,
        credentials,
        "read",
        "get_csv_report",
        {
          pathParameters: {
            csvId: "22222222-2222-2222-2222-222222222222",
          },
        },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("accepts authenticated not-found only for the hidden health probe", async () => {
    const requester = jest.fn(
      async () =>
        new Response(JSON.stringify({ errors: [{ message: "not found" }] }), {
          status: 404,
        }),
    );
    await expect(
      new BoundedRestApiAdapter(requester).health(
        ACTBLUE_BOUNDED_REST_CONNECTOR,
        credentials,
      ),
    ).resolves.toEqual({ verified: true, acceptedStatusCode: 404 });
  });

  it("never treats an authentication failure as a successful health probe", async () => {
    const requester = jest.fn(
      async () =>
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
        }),
    );
    await expect(
      new BoundedRestApiAdapter(requester).health(
        {
          ...ACTBLUE_BOUNDED_REST_CONNECTOR,
          health: {
            ...ACTBLUE_BOUNDED_REST_CONNECTOR.health,
            acceptedStatusCodes: [401],
          },
        },
        credentials,
      ),
    ).rejects.toMatchObject({ code: "credential_missing", statusCode: 401 });
  });
});
