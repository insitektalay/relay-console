import { EhrFhirApiAdapter } from "./ehr-fhir-api.adapter";

const credentials = {
  fhirBaseUrl: "https://fhir.example.org/r4/tenant-a",
  accessToken: "token_123",
};

describe("EhrFhirApiAdapter", () => {
  it("reads discovery without exposing bearer authorization", async () => {
    const calls: Array<{ url: string; auth: string | null }> = [];
    const adapter = new EhrFhirApiAdapter(async (url, init) => {
      calls.push({
        url: String(url),
        auth: new Headers(init.headers).get("Authorization"),
      });
      return new Response(JSON.stringify({ resourceType: "CapabilityStatement" }), {
        status: 200,
        headers: { "Content-Type": "application/fhir+json" },
      });
    });

    await adapter.capabilityStatement(credentials);

    expect(calls[0]).toEqual({
      url: "https://fhir.example.org/r4/tenant-a/metadata",
      auth: null,
    });
  });

  it("caps FHIR searches and minimizes raw clinical content", async () => {
    const calls: string[] = [];
    const adapter = new EhrFhirApiAdapter(async (url, init) => {
      calls.push(String(url));
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token_123");
      return new Response(
        JSON.stringify({
          resourceType: "Bundle",
          total: 1,
          entry: [
            {
              resource: {
                resourceType: "Observation",
                id: "obs-1",
                status: "final",
                text: { div: "PRIVATE narrative" },
                valueString: "PRIVATE value",
                subject: { reference: "Patient/pat-1", display: "PRIVATE name" },
                code: {
                  text: "PRIVATE label",
                  coding: [{ system: "http://loinc.org", code: "1234-5", display: "PRIVATE" }],
                },
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/fhir+json" } },
      );
    });

    const result = await adapter.search(credentials, {
      resourceType: "Observation",
      query: { patient: "pat-1", _count: 500 },
    });

    expect(calls[0]).toBe(
      "https://fhir.example.org/r4/tenant-a/Observation?patient=pat-1&_count=25",
    );
    expect(JSON.stringify(result)).toContain("Observation");
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(JSON.stringify(result)).not.toContain("valueString");
  });

  it("rejects resource types outside the healthcare V1 allowlist", async () => {
    const adapter = new EhrFhirApiAdapter(async () => {
      throw new Error("should not request");
    });

    await expect(
      adapter.search(credentials, { resourceType: "Binary", query: {} }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
