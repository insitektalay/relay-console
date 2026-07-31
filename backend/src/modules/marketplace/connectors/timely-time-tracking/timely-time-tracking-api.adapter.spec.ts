import {
  TimelyTimeTrackingApiAdapter,
  TimelyTimeTrackingApiError,
} from "./timely-time-tracking-api.adapter";
import {
  TIMELY_TIME_TRACKING_MANAGE_OPERATION_IDS,
  TIMELY_TIME_TRACKING_READ_OPERATION_IDS,
} from "./timely-time-tracking-operation-registry";

describe("TimelyTimeTrackingApiAdapter", () => {
  it("pins the complete official application-operation split", () => {
    expect(TIMELY_TIME_TRACKING_READ_OPERATION_IDS).toHaveLength(32);
    expect(TIMELY_TIME_TRACKING_MANAGE_OPERATION_IDS).toHaveLength(38);
  });

  it("rejects unpinned and cross-tool operations before network access", () => {
    const adapter = new TimelyTimeTrackingApiAdapter();
    expect(() => adapter.read("token", "not_pinned", {})).toThrow(
      TimelyTimeTrackingApiError,
    );
    expect(() =>
      adapter.read("token", TIMELY_TIME_TRACKING_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts GET");
  });
});
