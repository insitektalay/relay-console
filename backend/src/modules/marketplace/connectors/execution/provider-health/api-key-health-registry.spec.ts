import {
  type ApiKeyHealthHandler,
  mergeApiKeyHealthHandlerMaps,
} from "./api-key-health-handler";
import { API_KEY_HEALTH_HANDLER_BY_SLUG } from "./api-key-health-registry.index";

describe("API-key health handler registry", () => {
  it("owns every extracted provider exactly once", () => {
    const slugs = Object.keys(API_KEY_HEALTH_HANDLER_BY_SLUG);

    expect(slugs).toHaveLength(476);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(Object.values(API_KEY_HEALTH_HANDLER_BY_SLUG)).toEqual(
      expect.arrayContaining([expect.any(Function)]),
    );
    expect(API_KEY_HEALTH_HANDLER_BY_SLUG["onesignal"]).toEqual(
      expect.any(Function),
    );
    expect(API_KEY_HEALTH_HANDLER_BY_SLUG["yodlee-fastlink"]).toBe(
      API_KEY_HEALTH_HANDLER_BY_SLUG["plaid-link"],
    );
  });

  it("rejects duplicate ownership while composing handler modules", () => {
    const handler = (async () => undefined) as ApiKeyHealthHandler;

    expect(() =>
      mergeApiKeyHealthHandlerMaps({ example: handler }, { example: handler }),
    ).toThrow("Duplicate API-key health handler for example");
  });

  it("freezes the composed registry", () => {
    expect(Object.isFrozen(API_KEY_HEALTH_HANDLER_BY_SLUG)).toBe(true);
  });
});
