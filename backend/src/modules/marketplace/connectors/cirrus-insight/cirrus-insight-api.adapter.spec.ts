import { CirrusInsightApiAdapter } from "./cirrus-insight-api.adapter";

const credentials = { organizationId: "11111111-1111-4111-8111-111111111111", userEmail: "advisor@example.com" }; const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("CirrusInsightApiAdapter", () => {
  it("pins the exact organization and user GET while returning only bounded scheduling links", async () => {
    const request = jest.fn(async () => json({ status: "Success", message: "Success", calendarViews: [{ email: credentials.userEmail, calendars: [{ url: "https://schedule.cirrusinsight.com/demo", name: "Consultation", isPrimary: true, internalId: "private" }], privateMeetingData: { invitee: "private@example.com" } }] }));
    const result = await new CirrusInsightApiAdapter(request).getSchedulingLinks(credentials);
    expect(request).toHaveBeenCalledWith(`https://api.cirrusinsight.com/api/organizations/${credentials.organizationId}/calendarviews?emails=${encodeURIComponent(credentials.userEmail)}`, expect.objectContaining({ method: "GET" }));
    expect(result).toEqual({ calendars: [{ name: "Consultation", url: "https://schedule.cirrusinsight.com/demo", isPrimary: true }] });
    expect(result).not.toHaveProperty("email"); expect(result).not.toHaveProperty("message"); expect(result).not.toHaveProperty("privateMeetingData");
  });
  it("rejects mismatched users, non-HTTPS links, and provider errors safely", async () => {
    await expect(new CirrusInsightApiAdapter(async () => json({ status: "Success", calendarViews: [{ email: "other@example.com", calendars: [] }] })).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new CirrusInsightApiAdapter(async () => json({ status: "Success", calendarViews: [{ email: credentials.userEmail, calendars: [{ url: "http://unsafe.example.com" }] }] })).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new CirrusInsightApiAdapter(async () => json({ message: credentials.organizationId }, 404)).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error", message: "Cirrus Insight API request failed." });
  });
});
