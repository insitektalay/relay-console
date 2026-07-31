import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;

export class GoogleMapsPlatformApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleMapsPlatformApiAdapter {
  health(apiKey: string) {
    this.apiKey(apiKey);
    return {
      credentialPresent: true,
      providerRequestCount: 0,
      writesEnabled: false,
    };
  }
  async geocodeAddress(apiKey: string, input: JsonObject) {
    const address = this.requiredString(input.address, "address", 500);
    const value = await this.getGeocode(apiKey, { address });
    return this.geocodeResult(value, "google-maps-platform-address-geocode-v1");
  }
  async reverseGeocode(apiKey: string, input: JsonObject) {
    const latitude = this.coordinate(input.latitude, "latitude", -90, 90);
    const longitude = this.coordinate(input.longitude, "longitude", -180, 180);
    const value = await this.getGeocode(apiKey, {
      latlng: `${latitude},${longitude}`,
    });
    return this.geocodeResult(value, "google-maps-platform-reverse-geocode-v1");
  }
  async searchPlaces(apiKey: string, input: JsonObject) {
    const textQuery = this.requiredString(input.textQuery, "textQuery", 256);
    const value = await this.request(
      apiKey,
      new URL("https://places.googleapis.com/v1/places:searchText"),
      {
        method: "POST",
        headers: {
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.businessStatus,places.googleMapsUri",
        },
        body: { textQuery, pageSize: 10 },
      },
    );
    const places = this.array(value.places)
      .slice(0, 10)
      .map((entry) => {
        const place = this.object(entry),
          displayName = this.object(place.displayName),
          location = this.object(place.location);
        return {
          id: this.scalar(place.id, 256),
          displayName: this.scalar(displayName.text, 512),
          formattedAddress: this.scalar(place.formattedAddress, 1_000),
          location: this.location(location),
          primaryType: this.scalar(place.primaryType, 128),
          businessStatus: this.scalar(place.businessStatus, 64),
          googleMapsUri: this.safeMapsUri(place.googleMapsUri),
          expandedDetailsReturned: false,
        };
      });
    return {
      semanticReadContract: "google-maps-platform-text-search-v1",
      places,
      resultCount: places.length,
      maxResults: 10,
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }
  async computeRoute(apiKey: string, input: JsonObject) {
    const origin = this.waypoint(input.origin, "origin"),
      destination = this.waypoint(input.destination, "destination");
    const travelMode = this.travelMode(input.travelMode);
    const value = await this.request(
      apiKey,
      new URL("https://routes.googleapis.com/directions/v2:computeRoutes"),
      {
        method: "POST",
        headers: {
          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration,routes.routeLabels",
        },
        body: {
          origin: { location: { latLng: origin } },
          destination: { location: { latLng: destination } },
          travelMode,
          computeAlternativeRoutes: false,
          units: "METRIC",
        },
      },
    );
    const route = this.object(this.array(value.routes)[0]);
    return {
      semanticReadContract: "google-maps-platform-route-summary-v1",
      route: {
        distanceMeters: this.number(route.distanceMeters),
        duration: this.scalar(route.duration, 64),
        routeLabels: this.stringArray(route.routeLabels, 8, 64),
      },
      travelMode,
      routeReturned: Object.keys(route).length > 0,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async getGeocode(apiKey: string, query: Record<string, string>) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    return this.request(apiKey, url, { method: "GET" });
  }
  private async request(
    apiKey: string,
    url: URL,
    init: {
      method: "GET" | "POST";
      headers?: Record<string, string>;
      body?: unknown;
    },
  ) {
    const key = this.apiKey(apiKey);
    if (!this.safeUrl(url, init.method))
      throw new GoogleMapsPlatformApiError(
        "provider_validation_error",
        "Maps URL is outside Relay's fixed allowlist.",
      );
    const requestUrl = new URL(url);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init.headers ?? {}),
    };
    if (requestUrl.hostname === "maps.googleapis.com")
      requestUrl.searchParams.set("key", key);
    else headers["X-Goog-Api-Key"] = key;
    if (init.method === "POST") headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await safeConnectorFetch(requestUrl, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new GoogleMapsPlatformApiError(
        "provider_unavailable",
        "Google Maps Platform could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new GoogleMapsPlatformApiError(
        "provider_validation_error",
        "Maps response exceeded Relay's 1 MB bound.",
      );
    let value: JsonObject;
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleMapsPlatformApiError(
        "provider_validation_error",
        "Maps returned invalid JSON.",
      );
    }
    const legacyStatus = this.scalar(value.status, 64);
    if (
      !response.ok ||
      (legacyStatus && legacyStatus !== "OK" && legacyStatus !== "ZERO_RESULTS")
    ) {
      const status =
        response.status ||
        (legacyStatus === "OVER_QUERY_LIMIT"
          ? 429
          : legacyStatus === "REQUEST_DENIED"
            ? 403
            : 400);
      throw new GoogleMapsPlatformApiError(
        this.errorCode(status),
        "Google Maps Platform rejected the bounded request.",
        status,
      );
    }
    return value;
  }
  private safeUrl(url: URL, method: string) {
    if (
      url.protocol !== "https:" ||
      url.hash ||
      url.username ||
      url.password ||
      [...url.searchParams.keys()].some(
        (key) => !["address", "latlng"].includes(key),
      )
    )
      return false;
    if (url.hostname === "maps.googleapis.com")
      return (
        method === "GET" &&
        url.pathname === "/maps/api/geocode/json" &&
        [...url.searchParams.keys()].length === 1
      );
    if (url.search) return false;
    if (url.hostname === "places.googleapis.com")
      return method === "POST" && url.pathname === "/v1/places:searchText";
    return (
      url.hostname === "routes.googleapis.com" &&
      method === "POST" &&
      url.pathname === "/directions/v2:computeRoutes"
    );
  }
  private geocodeResult(value: JsonObject, contract: string) {
    const results = this.array(value.results)
      .slice(0, 5)
      .map((entry) => {
        const result = this.object(entry),
          geometry = this.object(result.geometry);
        return {
          formattedAddress: this.scalar(result.formatted_address, 1_000),
          placeId: this.scalar(result.place_id, 256),
          types: this.stringArray(result.types, 16, 128),
          location: this.location(this.object(geometry.location)),
          locationType: this.scalar(geometry.location_type, 64),
          partialMatch: result.partial_match === true,
        };
      });
    return {
      semanticReadContract: contract,
      results,
      resultCount: results.length,
      maxResults: 5,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }
  private boundary() {
    return {
      writesEnabled: false,
      rawProviderToolExposure: false,
      placeDetailsEnabled: false,
      photosReviewsEnabled: false,
      trackingNavigationEnabled: false,
      geometryReturned: false,
      automaticPagination: false,
      automaticRetries: false,
      storagePermitted: false,
      redactionStatus:
        "expanded-place-content-route-geometry-tracking-bulk-persistence-raw-excluded",
    };
  }
  private waypoint(value: unknown, field: string) {
    const point = this.object(value);
    return {
      latitude: this.coordinate(point.latitude, `${field}.latitude`, -90, 90),
      longitude: this.coordinate(
        point.longitude,
        `${field}.longitude`,
        -180,
        180,
      ),
    };
  }
  private location(value: JsonObject) {
    const latitude = this.number(value.lat ?? value.latitude),
      longitude = this.number(value.lng ?? value.longitude);
    return latitude === null || longitude === null
      ? null
      : { latitude, longitude };
  }
  private travelMode(value: unknown) {
    if (value === undefined) return "DRIVE";
    if (
      typeof value === "string" &&
      ["DRIVE", "WALK", "BICYCLE", "TRANSIT"].includes(value)
    )
      return value;
    throw new GoogleMapsPlatformApiError(
      "provider_validation_error",
      "travelMode is outside the fixed allowlist.",
    );
  }
  private coordinate(value: unknown, field: string, min: number, max: number) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    )
      throw new GoogleMapsPlatformApiError(
        "provider_validation_error",
        `${field} must be between ${min} and ${max}.`,
      );
    return value;
  }
  private requiredString(value: unknown, field: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max)
      throw new GoogleMapsPlatformApiError(
        "provider_validation_error",
        `${field} is required and must be at most ${max} characters.`,
      );
    return value.trim();
  }
  private apiKey(value: string) {
    if (!value || value.length > 2_000 || /\s/.test(value))
      throw new GoogleMapsPlatformApiError(
        "credential_missing",
        "Google Maps Platform API key is missing or invalid.",
      );
    return value;
  }
  private safeMapsUri(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" &&
        (url.hostname === "maps.google.com" ||
          url.hostname === "www.google.com" ||
          url.hostname === "google.com")
        ? url.toString().slice(0, 2_000)
        : null;
    } catch {
      return null;
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || status === 403) return "credential_missing";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private stringArray(value: unknown, maxItems: number, maxLength: number) {
    return this.array(value)
      .filter((entry): entry is string => typeof entry === "string")
      .slice(0, maxItems)
      .map((entry) => entry.slice(0, maxLength));
  }
}
