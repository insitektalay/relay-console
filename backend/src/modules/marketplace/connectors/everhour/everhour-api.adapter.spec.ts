import { EverhourApiAdapter, EverhourApiError } from "./everhour-api.adapter";
import {
  EVERHOUR_MANAGE_OPERATION_IDS,
  EVERHOUR_OPERATIONS,
  EVERHOUR_READ_OPERATION_IDS,
} from "./everhour-operation-registry";

describe("EverhourApiAdapter", () => {
  it("pins the complete official operation split", () => {
    expect(EVERHOUR_OPERATIONS).toHaveLength(103);
    expect(EVERHOUR_READ_OPERATION_IDS).toHaveLength(40);
    expect(EVERHOUR_MANAGE_OPERATION_IDS).toHaveLength(63);
  });
  it("rejects unpinned and cross-tool operations before network access", () => {
    const adapter = new EverhourApiAdapter();
    const credentials = { apiKey: "test-key" };
    expect(() => adapter.read(credentials, "not_pinned", {})).toThrow(
      EverhourApiError,
    );
    expect(() =>
      adapter.read(credentials, EVERHOUR_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts GET");
  });
});
