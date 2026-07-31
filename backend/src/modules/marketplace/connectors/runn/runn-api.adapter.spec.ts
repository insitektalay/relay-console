import { RunnApiAdapter, RunnApiError } from "./runn-api.adapter";
import {
  RUNN_MANAGE_OPERATION_IDS,
  RUNN_OPERATIONS,
  RUNN_READ_OPERATION_IDS,
} from "./runn-operation-registry";

describe("RunnApiAdapter", () => {
  it("pins the complete official operation split", () => {
    expect(RUNN_OPERATIONS).toHaveLength(196);
    expect(RUNN_READ_OPERATION_IDS).toHaveLength(92);
    expect(RUNN_MANAGE_OPERATION_IDS).toHaveLength(104);
  });
  it("rejects unpinned and cross-tool operations before network access", () => {
    const adapter = new RunnApiAdapter();
    const credentials = {
      apiToken: "TEST_token",
      apiOrigin: "https://api.runn.io" as const,
    };
    expect(() => adapter.read(credentials, "not_pinned", {})).toThrow(
      RunnApiError,
    );
    expect(() =>
      adapter.read(credentials, RUNN_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts GET");
  });
});
