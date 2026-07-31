import {
  BambooHRApiAdapter,
  type BambooHRCredentials,
} from "./bamboohr-api.adapter";

const credentials: BambooHRCredentials = {
  accessToken: "bamboohr-access-token",
  companyDomain: "relay-demo",
  locationId: "42",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const location = {
  id: "42",
  label: "London",
  archived: false,
  manageable: true,
  address: {
    address1: "must-not-leak",
    city: "must-not-leak",
    zipcode: "must-not-leak",
    timezone: "Europe/London",
    remoteLocation: false,
  },
  createdAt: "2026-01-01T00:00:00Z",
};

describe("BambooHRApiAdapter", () => {
  it("lists only the bounded first Location page and strips address details", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(response({ data: [location] }));
    const result = await new BambooHRApiAdapter(requester).listLocations(
      credentials,
      { limit: 5 },
    );
    expect(requester.mock.calls[0][0]).toContain(
      "https://relay-demo.bamboohr.com/api/v1/hris/org/locations?page=0&pageSize=5",
    );
    expect(result).toMatchObject({
      page: 0,
      limit: 5,
      automaticPagination: false,
      locations: [{ id: "42", addressDetailsReturned: false }],
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
  });

  it("reads only the exact selected Location", async () => {
    const requester = jest.fn().mockResolvedValue(response(location));
    const result = await new BambooHRApiAdapter(requester).getLocation(
      credentials,
    );
    expect(requester.mock.calls[0][0]).toBe(
      "https://relay-demo.bamboohr.com/api/v1/hris/org/locations/42",
    );
    expect(result.location).toMatchObject({
      id: "42",
      timezone: "Europe/London",
      employeeDataReturned: false,
    });
  });

  it("lists bounded Country options with the documented ISO field", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(
        response([{ id: "1", name: "United Kingdom", isoCode: "GB" }]),
      );
    const result = await new BambooHRApiAdapter(requester).listCountries(
      credentials,
      { limit: 1 },
    );
    expect(result).toEqual({
      countries: [{ id: "1", name: "United Kingdom", isoCode: "GB" }],
      limit: 1,
      automaticPagination: false,
    });
  });

  it("rejects a changed Location binding and maps provider throttling", async () => {
    await expect(
      new BambooHRApiAdapter(
        jest.fn().mockResolvedValue(response({ ...location, id: "99" })),
      ).getLocation(credentials),
    ).rejects.toMatchObject({ code: "bamboohr_location_binding_mismatch" });
    await expect(
      new BambooHRApiAdapter(
        jest.fn().mockResolvedValue(response({}, 503)),
      ).getLocation(credentials),
    ).rejects.toMatchObject({ code: "bamboohr_rate_limited", statusCode: 503 });
  });
});
