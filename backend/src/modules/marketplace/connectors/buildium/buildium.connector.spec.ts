import { MarketplaceConnectorRegistry } from "../connector-registry";
import { BuildiumApiAdapter } from "./buildium-api.adapter";
import { BUILDIUM_CONNECTOR_MANIFEST } from "./buildium.connector";

const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("Buildium Marketplace connector", () => {
  it("registers two encrypted key fields and four bounded reads", () => {
    expect(new MarketplaceConnectorRegistry().get("buildium")).toBe(
      BUILDIUM_CONNECTOR_MANIFEST,
    );
    expect(
      BUILDIUM_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["BUILDIUM_CLIENT_ID", "BUILDIUM_CLIENT_SECRET"]);
    expect(BUILDIUM_CONNECTOR_MANIFEST.tools).toHaveLength(4);
  });

  it("pins production, credential headers, page one and redacts sensitive fields", async () => {
    let url = "";
    let headers = new Headers();
    const adapter = new BuildiumApiAdapter(async (requestUrl, init) => {
      url = String(requestUrl);
      headers = new Headers(init.headers);
      return response([
        {
          Id: 17,
          Name: "Harbor",
          IsActive: true,
          NumberUnits: 6,
          RentalType: "Residential",
          Address: {
            City: "Portland",
            State: "OR",
            PostalCode: "97205",
            AddressLine1: "hidden",
          },
          OperatingBankAccountId: 99,
          Reserve: 5000,
          RentalManager: { Email: "hidden@example.com" },
        },
      ]);
    });
    const result = await adapter.listRentals(
      { clientId: "client", clientSecret: "secret" },
      { limit: 7 },
    );
    expect(url).toBe(
      "https://api.buildium.com/v1/rentals?orderby=Id&offset=0&limit=7",
    );
    expect(headers.get("x-buildium-client-id")).toBe("client");
    expect(headers.get("x-buildium-client-secret")).toBe("secret");
    expect(result.rentals[0]).toMatchObject({
      rentalId: 17,
      name: "Harbor",
      city: "Portland",
      state: "OR",
    });
    expect(JSON.stringify(result)).not.toContain("AddressLine1");
    expect(JSON.stringify(result)).not.toContain("OperatingBankAccountId");
    expect(JSON.stringify(result)).not.toContain("hidden@example.com");
  });

  it("uses exact unit paths and rejects unsafe identifiers before a request", async () => {
    let url = "";
    const adapter = new BuildiumApiAdapter(async (requestUrl) => {
      url = String(requestUrl);
      return response({
        Id: 8,
        PropertyId: 17,
        UnitNumber: "2A",
        MarketRent: 2200,
        Address: { AddressLine1: "hidden" },
      });
    });
    const result = await adapter.getUnit(
      { clientId: "client", clientSecret: "secret" },
      { unitId: 8 },
    );
    expect(url).toBe("https://api.buildium.com/v1/rentals/units/8");
    expect(result.unit).toEqual(
      expect.objectContaining({ unitId: 8, rentalId: 17, unitNumber: "2A" }),
    );
    expect(JSON.stringify(result)).not.toContain("MarketRent");
    const requester = jest.fn();
    await expect(
      new BuildiumApiAdapter(requester).getRental(
        { clientId: "client", clientSecret: "secret" },
        { rentalId: -1 },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(requester).not.toHaveBeenCalled();
  });
});
