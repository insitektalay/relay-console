import {
  ResourceGuruApiAdapter,
  ResourceGuruApiError,
} from "./resource-guru-api.adapter";
import {
  RESOURCE_GURU_READ_OPERATION_IDS,
  RESOURCE_GURU_MANAGE_OPERATION_IDS,
} from "./resource-guru-operation-registry";

describe("ResourceGuruApiAdapter", () => {
  it("pins the complete official operation split", () => {
    expect(RESOURCE_GURU_READ_OPERATION_IDS).toHaveLength(60);
    expect(RESOURCE_GURU_MANAGE_OPERATION_IDS).toHaveLength(52);
  });
  it("rejects unpinned and cross-tool operations before network access", () => {
    const adapter = new ResourceGuruApiAdapter();
    expect(() => adapter.read("token", "not_pinned", {})).toThrow(
      ResourceGuruApiError,
    );
    expect(() =>
      adapter.read("token", RESOURCE_GURU_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts GET");
  });
});
