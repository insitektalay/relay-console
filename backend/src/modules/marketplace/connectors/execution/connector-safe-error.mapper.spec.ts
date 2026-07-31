import { BoundedRestApiError } from "../bounded-rest/bounded-rest-api.adapter";
import { SurveyMonkeyApiError } from "../surveymonkey/surveymonkey-api.adapter";
import { mapKnownConnectorError } from "./connector-safe-error.mapper";

describe("mapKnownConnectorError", () => {
  it("preserves provider errors that already use the safe error contract", () => {
    expect(
      mapKnownConnectorError(
        new BoundedRestApiError(
          "provider_rate_limited",
          "Provider rate limit reached.",
          429,
        ),
      ),
    ).toEqual({
      ok: false,
      statusCode: 429,
      error: {
        code: "provider_rate_limited",
        message: "Provider rate limit reached.",
      },
    });
  });

  it("normalizes provider-specific error codes without exposing raw payloads", () => {
    expect(
      mapKnownConnectorError(
        new SurveyMonkeyApiError(
          "surveymonkey_rate_limited",
          "SurveyMonkey rate limit reached.",
          429,
          { rawProviderPayload: "must-not-escape" },
        ),
      ),
    ).toEqual({
      ok: false,
      statusCode: 429,
      error: {
        code: "provider_rate_limited",
        message: "SurveyMonkey rate limit reached.",
      },
    });
  });

  it("returns null for errors outside the reviewed provider mapper set", () => {
    expect(mapKnownConnectorError(new Error("unexpected"))).toBeNull();
  });
});
