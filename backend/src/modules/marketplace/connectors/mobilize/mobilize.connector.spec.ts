import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import {
  MOBILIZE_BOUNDED_REST_CONNECTOR,
  MOBILIZE_MANAGE_OPERATION_IDS,
  MOBILIZE_OPERATIONS,
  MOBILIZE_PUBLIC_READ_OPERATION_IDS,
  MOBILIZE_SENSITIVE_READ_OPERATION_IDS,
} from "./mobilize-operation-registry";

const credentials = {
  MOBILIZE_API_KEY: "example-provider-key",
  MOBILIZE_ORGANIZATION_ID: "12345",
};

describe("Mobilize connector", () => {
  it("pins every live and restricted non-deprecated v1 operation", () => {
    expect(MOBILIZE_OPERATIONS).toHaveLength(17);
    expect(MOBILIZE_PUBLIC_READ_OPERATION_IDS).toHaveLength(4);
    expect(MOBILIZE_SENSITIVE_READ_OPERATION_IDS).toHaveLength(7);
    expect(MOBILIZE_MANAGE_OPERATION_IDS).toHaveLength(6);
    expect(new Set(MOBILIZE_OPERATIONS.map((item) => item.id)).size).toBe(17);
    expect(
      new Set([
        ...MOBILIZE_PUBLIC_READ_OPERATION_IDS,
        ...MOBILIZE_SENSITIVE_READ_OPERATION_IDS,
        ...MOBILIZE_MANAGE_OPERATION_IDS,
      ]).size,
    ).toBe(17);
  });

  it("verifies the key against the exact bound organization", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ data: [], error: null })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.health(MOBILIZE_BOUNDED_REST_CONNECTOR, credentials);
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe(
      "https://api.mobilize.us/v1/organizations/12345/promoted_organizations",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer example-provider-key",
    );
    expect(init.redirect).toBe("error");
  });

  it("omits credentials from explicitly public operations", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ data: { id: 88 } })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.execute(
      MOBILIZE_BOUNDED_REST_CONNECTOR,
      {},
      "read",
      "get_public_event",
      { pathParameters: { event_id: 88 } },
    );
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe("https://api.mobilize.us/v1/events/88");
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it("builds only a bounded multipart event-image upload", async () => {
    const requester = jest.fn(
      async () =>
        new Response(
          JSON.stringify({ data: "https://mobilize.imgix.net/example.png" }),
        ),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.execute(
      MOBILIZE_BOUNDED_REST_CONNECTOR,
      credentials,
      "manage",
      "upload_event_image",
      {
        json: {
          contentBase64: Buffer.from(
            "89504e470d0a1a0a0000000d49484452",
            "hex",
          ).toString("base64"),
          fileName: "event.png",
          mimeType: "image/png",
        },
      },
    );
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe("https://api.mobilize.us/v1/images");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file_name")).toBe("event.png");
    expect(
      (init.headers as Record<string, string>)["Content-Type"],
    ).toBeUndefined();
  });

  it("rejects arbitrary operations and unknown multipart fields", async () => {
    const adapter = new BoundedRestApiAdapter(jest.fn());
    await expect(
      adapter.execute(
        MOBILIZE_BOUNDED_REST_CONNECTOR,
        credentials,
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.execute(
        MOBILIZE_BOUNDED_REST_CONNECTOR,
        credentials,
        "manage",
        "upload_event_image",
        {
          json: {
            contentBase64: Buffer.from(
              "89504e470d0a1a0a0000000d49484452",
              "hex",
            ).toString("base64"),
            fileName: "event.png",
            sourceUrl: "https://example.com/image.png",
          },
        },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.execute(
        MOBILIZE_BOUNDED_REST_CONNECTOR,
        credentials,
        "manage",
        "upload_event_image",
        {
          json: {
            contentBase64: Buffer.from("not-an-image").toString("base64"),
            fileName: "event.png",
            mimeType: "image/png",
          },
        },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
