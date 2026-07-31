import { TexAuApiAdapter } from "./texau-api.adapter";

const credentials = { apiKey: "fixture-key" }; const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("TexAuApiAdapter", () => {
  it("pins one action and privacy-redacts the input and guessed identity", async () => {
    const request = jest.fn(async () => json({ ok: true, data: { email_address: "jane@example.com", username: "jane", guessed_name: "Jane Person", is_gmail: false, is_likely_company_email: true } }));
    const result = await new TexAuApiAdapter(request).identifyEmailType(credentials, { email: "Jane@Example.com" });
    expect(request).toHaveBeenCalledWith("https://v3-api.texau.com/api/v1/texau-identify-email-type", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-api-key": credentials.apiKey }), body: JSON.stringify({ email: "jane@example.com" }) }));
    expect(result).toEqual({ classification: { type: "company", publicEmailProvider: null, likelyCompany: true, likelyEducation: false, likelyPersonal: false } });
    expect(JSON.stringify(result)).not.toContain("jane@example.com"); expect(JSON.stringify(result)).not.toContain("Jane Person");
  });
  it("validates locally and maps provider errors safely", async () => {
    await expect(new TexAuApiAdapter().health({ apiKey: "" })).rejects.toMatchObject({ code: "credential_missing" });
    await expect(new TexAuApiAdapter().identifyEmailType(credentials, { email: "not-an-email" })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new TexAuApiAdapter(async () => json({ error: credentials.apiKey }, 401)).identifyEmailType(credentials, { email: "a@example.com" })).rejects.toMatchObject({ code: "credential_missing", message: "TexAu API request failed." });
  });
  it("maps the provider's iCloud field without returning source data", async () => {
    const result = await new TexAuApiAdapter(async () => json({ data: { is_i_cloud: true, is_likely_personal_email: true, email_address: "private@icloud.com" } })).identifyEmailType(credentials, { email: "private@icloud.com" });
    expect(result.classification).toMatchObject({ type: "personal", publicEmailProvider: "icloud" });
    expect(JSON.stringify(result)).not.toContain("private@icloud.com");
  });
});
