import { MyobApiAdapter } from "./myob-api.adapter";

const credentials = {
  accessToken: "fixture-access-token",
  clientId: "fixture-api-key",
  companyFileId: "770ed441-0abb-4832-bd2b-2032d035656e",
  companyFileToken: Buffer.from("relay-api:fixture-password").toString(
    "base64",
  ),
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("MyobApiAdapter", () => {
  it("pins the company file, paths, headers, returned fields, and bounds", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses = [
      {
        Id: credentials.companyFileId,
        Name: "Relay Sandbox",
        ProductVersion: "2026.1",
        ProductLevel: { Code: 50, Name: "Premier" },
        Country: "AU",
        SerialNumber: "private-serial",
        CheckedOutBy: "private-user",
        Uri: "private-uri",
      },
      {
        Build: "2.15.7224",
        Resources: [
          {
            ResourcePath: "/Company/",
            Version: "v2",
            FromProductVersion: "2013.3",
            MinimumProductLevel: { Code: 20, Name: "Standard" },
            privateFields: true,
          },
        ],
      },
    ];
    const adapter = new MyobApiAdapter(async (url, init) => {
      calls.push({ url, init });
      return json(responses.shift());
    });

    const company = await adapter.getCompanyFile(credentials);
    const info = await adapter.getApiInfo(credentials, { limit: 3 });

    expect(calls.map((call) => call.url)).toEqual([
      `https://api.myob.com/accountright/${credentials.companyFileId}/`,
      `https://api.myob.com/accountright/${credentials.companyFileId}/Info`,
    ]);
    expect(calls[0].init.headers).toMatchObject({
      Authorization: `Bearer ${credentials.accessToken}`,
      "x-myobapi-cftoken": credentials.companyFileToken,
      "x-myobapi-key": credentials.clientId,
      "x-myobapi-version": "v2",
    });
    expect(company.companyFile).not.toHaveProperty("SerialNumber");
    expect(company.companyFile).not.toHaveProperty("CheckedOutBy");
    expect(company.companyFile).not.toHaveProperty("Uri");
    expect(info.resources[0]).not.toHaveProperty("privateFields");
    expect(info.nextPageFollowed).toBe(false);
  });

  it("rejects invalid company bindings, credentials, and limits before network access", async () => {
    const request = jest.fn();
    const adapter = new MyobApiAdapter(request);
    await expect(
      adapter.getCompanyFile({ ...credentials, companyFileId: "../file" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.getCompanyFile({ ...credentials, companyFileToken: "invalid" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getApiInfo(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on company mismatch and provider errors without leaking details", async () => {
    const mismatch = new MyobApiAdapter(async () =>
      json({ ...credentials, Id: "ba62b938-2dc6-4ae4-b6bb-e1f32d3e3172" }),
    );
    await expect(mismatch.getCompanyFile(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
    const denied = new MyobApiAdapter(async () =>
      json({ detail: `denied ${credentials.companyFileToken}` }, 403),
    );
    await expect(denied.getCompanyFile(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      message: "MYOB API request failed.",
    });
  });
});
