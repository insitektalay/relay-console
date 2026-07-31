import { safeOutboundHttpClient } from "../../../common/security/safe-outbound-http";
import { safeConnectorFetch } from "./safe-connector-fetch";

describe("safe connector fetch", () => {
  afterEach(() => jest.restoreAllMocks());

  it("binds credentials, body, and redirects to the canonical initial host", async () => {
    const request = jest
      .spyOn(safeOutboundHttpClient, "requestBuffer")
      .mockResolvedValue({
        url: "https://tenant.vendor.example/api/items",
        status: 201,
        headers: {
          "content-type": "application/json",
          "x-request-id": "request-1",
        },
        body: Buffer.from('{"id":"item-1"}'),
      });

    const response = await safeConnectorFetch(
      "https://tenant.vendor.example/api/items",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer credential",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "item" }),
        redirect: "error",
      },
    );

    expect(request).toHaveBeenCalledWith(
      "https://tenant.vendor.example/api/items",
      expect.objectContaining({
        method: "POST",
        allowedHosts: ["tenant.vendor.example"],
        maxRedirects: 0,
        body: Buffer.from('{"name":"item"}'),
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("request-1");
    await expect(response.json()).resolves.toEqual({ id: "item-1" });
  });
});
