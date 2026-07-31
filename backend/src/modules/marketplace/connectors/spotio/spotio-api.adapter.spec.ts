import { SpotioApiAdapter } from "./spotio-api.adapter";

const credentials = { clientId: "fixture-client", clientSecret: "fixture-secret", dataObjectId: "65137544cd48c0aa1b0f5180" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("SpotioApiAdapter", () => {
  it("exchanges customer keys, pins one data-object GET, and redacts people, location, fields, and activity content", async () => {
    const request = jest.fn()
      .mockResolvedValueOnce(json({ accessToken: "fixture-bearer" }))
      .mockResolvedValueOnce(json({ id: credentials.dataObjectId, typeId: "1", stageId: "5", source: "Ios", createdAt: "2026-01-02T03:04:05Z", updatedAt: "2026-01-03T03:04:05Z", stageUpdatedAt: "2026-01-03T03:04:05Z", visitsCount: 2, callsCount: 1, name: "Private lead", ownerId: "private-owner", pin: { address: "private", lat: 1, lng: 2 }, fields: [{ label: "Email", value: "private@example.com" }], phones: ["private"], emails: ["private@example.com"], lastVisitNote: "private" }));
    const result = await new SpotioApiAdapter(request).getDataObjectSummary(credentials);
    expect(request).toHaveBeenNthCalledWith(1, "https://api.spotio2.com/api/users/apitoken", expect.objectContaining({ method: "POST", body: JSON.stringify({ clientId: credentials.clientId, secret: credentials.clientSecret }) }));
    expect(request).toHaveBeenNthCalledWith(2, `https://api.spotio2.com/api/DataObjects/${credentials.dataObjectId}`, expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: "Bearer fixture-bearer" }) }));
    expect(result.dataObject).toEqual({ dataObjectId: credentials.dataObjectId, typeId: "1", stageId: "5", source: "Ios", createdAt: "2026-01-02T03:04:05Z", updatedAt: "2026-01-03T03:04:05Z", stageUpdatedAt: "2026-01-03T03:04:05Z", visitsCount: 2, callsCount: 1 });
    expect(result.dataObject).not.toHaveProperty("name"); expect(result.dataObject).not.toHaveProperty("ownerId"); expect(result.dataObject).not.toHaveProperty("pin"); expect(result.dataObject).not.toHaveProperty("fields"); expect(result.dataObject).not.toHaveProperty("phones"); expect(result.dataObject).not.toHaveProperty("emails"); expect(result.dataObject).not.toHaveProperty("lastVisitNote");
  });

  it("rejects mismatched IDs and maps authentication errors safely", async () => {
    const mismatch = jest.fn().mockResolvedValueOnce(json({ accessToken: "fixture-bearer" })).mockResolvedValueOnce(json({ id: "aaaaaaaaaaaaaaaaaaaaaaaa" }));
    await expect(new SpotioApiAdapter(mismatch).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new SpotioApiAdapter(async () => json({ message: credentials.clientSecret }, 401)).health(credentials)).rejects.toMatchObject({ code: "credential_missing", message: "SPOTIO API request failed." });
  });
});
