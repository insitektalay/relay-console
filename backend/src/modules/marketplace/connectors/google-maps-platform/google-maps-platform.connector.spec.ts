import {
  GoogleMapsPlatformApiAdapter,
  GoogleMapsPlatformApiError,
} from "./google-maps-platform-api.adapter";
import { GOOGLE_MAPS_PLATFORM_CONNECTOR_MANIFEST } from "./google-maps-platform.connector";

describe("Google Maps Platform connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("declares four bounded reads and no approval bypass", () => {
    expect(GOOGLE_MAPS_PLATFORM_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(GOOGLE_MAPS_PLATFORM_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      GOOGLE_MAPS_PLATFORM_CONNECTOR_MANIFEST.approvalProfiles.every(
        (profile) => profile.approvalRequiredActions.length === 0,
      ),
    ).toBe(true);
  });
  it("geocodes with the fixed endpoint and redacts the key", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "London, UK",
              place_id: "p1",
              types: ["locality"],
              geometry: {
                location: { lat: 51.5, lng: -0.1 },
                location_type: "APPROXIMATE",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleMapsPlatformApiAdapter().geocodeAddress(
      "secret-key",
      { address: "London" },
    );
    const called = new URL(String(fetchMock.mock.calls[0][0]));
    expect(called.origin + called.pathname).toBe(
      "https://maps.googleapis.com/maps/api/geocode/json",
    );
    expect(called.searchParams.get("address")).toBe("London");
    expect(called.searchParams.get("key")).toBe("secret-key");
    expect(result).toMatchObject({
      resultCount: 1,
      providerRequestCount: 1,
      rawProviderToolExposure: false,
    });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });
  it("uses fixed Places fields and caps results", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          places: Array.from({ length: 12 }, (_, i) => ({
            id: `p${i}`,
            displayName: { text: `Place ${i}` },
            location: { latitude: 1, longitude: 2 },
            websiteUri: "https://blocked.example",
          })),
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleMapsPlatformApiAdapter().searchPlaces(
      "secret-key",
      { textQuery: "coffee" },
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(
      (init.headers as Record<string, string>)["X-Goog-FieldMask"],
    ).not.toContain("website");
    expect(result.places).toHaveLength(10);
    expect(JSON.stringify(result)).not.toContain("blocked.example");
  });
  it("computes only a route summary", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [
            {
              distanceMeters: 1200,
              duration: "300s",
              polyline: { encodedPolyline: "blocked" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleMapsPlatformApiAdapter().computeRoute(
      "secret-key",
      {
        origin: { latitude: 1, longitude: 2 },
        destination: { latitude: 3, longitude: 4 },
      },
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe(
      "routes.distanceMeters,routes.duration,routes.routeLabels",
    );
    expect(JSON.stringify(result)).not.toContain("polyline");
  });
  it("rejects invalid coordinates before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new GoogleMapsPlatformApiAdapter().reverseGeocode("secret-key", {
        latitude: 91,
        longitude: 0,
      }),
    ).rejects.toBeInstanceOf(GoogleMapsPlatformApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
