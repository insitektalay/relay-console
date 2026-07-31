import { BadRequestException } from "@nestjs/common";
import { MarketplaceConnectorOAuthService } from "../connector-oauth.service";

describe("pCloud OAuth regional authority binding", () => {
  const service = Object.create(
    MarketplaceConnectorOAuthService.prototype,
  ) as unknown as {
    pCloudAuthorityFromCallback(input: {
      pCloudLocationId?: string;
      pCloudHostname?: string;
    }): { apiOrigin: string; tokenUrl: string; locationId: number };
  };

  it.each([
    ["1", "api.pcloud.com", "https://api.pcloud.com"],
    ["2", "eapi.pcloud.com", "https://eapi.pcloud.com"],
  ])("binds location %s to %s", (locationId, hostname, apiOrigin) => {
    expect(
      service.pCloudAuthorityFromCallback({
        pCloudLocationId: locationId,
        pCloudHostname: hostname,
      }),
    ).toMatchObject({
      apiOrigin,
      tokenUrl: `${apiOrigin}/oauth2_token`,
      locationId: Number(locationId),
    });
  });

  it.each([
    ["1", "eapi.pcloud.com"],
    ["2", "api.pcloud.com"],
    ["1", "api.pcloud.com.evil.test"],
    ["3", "api.pcloud.com"],
  ])("rejects mismatched callback authority %s/%s", (locationId, hostname) => {
    expect(() =>
      service.pCloudAuthorityFromCallback({
        pCloudLocationId: locationId,
        pCloudHostname: hostname,
      }),
    ).toThrow(BadRequestException);
  });
});
