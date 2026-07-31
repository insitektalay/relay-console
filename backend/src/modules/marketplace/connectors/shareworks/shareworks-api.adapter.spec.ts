import { generateKeyPairSync, verify } from "node:crypto";
import {
  ShareworksApiAdapter,
  ShareworksApiError,
} from "./shareworks-api.adapter";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const credentials = {
  accountNumber: "12345678",
  clientId: "WS12345678",
  clientSecret: "secret",
  privateKey,
};

describe("ShareworksApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("mints an exact signed token and minimizes a bounded company page", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "access-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              companyId: 42,
              companyName: "Example Company",
              phone: "hidden",
            },
          ]),
          { status: 200 },
        ),
      );

    await expect(
      new ShareworksApiAdapter().read(credentials, {
        operation: "company.list",
        pageSize: 20,
        pageNumber: 2,
      }),
    ).resolves.toEqual({
      companies: [{ id: 42, name: "Example Company" }],
      pageSize: 20,
      pageNumber: 2,
      nextPageNumber: null,
    });

    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://shareworks-api.solium.com/rest/admin/v1/auth/tokens",
    );
    const authHeader = String(
      (fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>)
        .Authorization,
    );
    const token = authHeader.replace(/^Bearer /, "");
    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual(
      expect.objectContaining({
        iss: "shareworks.com",
        aud: "shareworks-api.solium.com",
        sub: "12345678",
        grant_type: "client_credentials",
        client_id: "WS12345678",
        client_secret: "secret",
      }),
    );
    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(`${header}.${payload}`),
        publicKey,
        Buffer.from(signature, "base64url"),
      ),
    ).toBe(true);
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: expect.objectContaining({
          "Content-Length": "0",
          "Content-Type": "text/plain",
        }),
      }),
    );
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
      "https://shareworks-api.solium.com/rest/admin/v1/company?pageSize=20&pageNumber=2",
    );
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("rejects arbitrary operations, oversized pages, and invalid keys", async () => {
    const adapter = new ShareworksApiAdapter();
    await expect(
      adapter.read(credentials, { operation: "stakeholder.list" }),
    ).rejects.toBeInstanceOf(ShareworksApiError);
    await expect(
      adapter.read(credentials, { operation: "company.list", pageSize: 21 }),
    ).rejects.toBeInstanceOf(ShareworksApiError);
    await expect(
      adapter.read(
        { ...credentials, privateKey: "not-a-key" },
        { operation: "company.list" },
      ),
    ).rejects.toBeInstanceOf(ShareworksApiError);
  });
});
