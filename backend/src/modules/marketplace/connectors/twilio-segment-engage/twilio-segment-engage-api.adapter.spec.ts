import {
  TwilioSegmentEngageApiAdapter,
  type TwilioSegmentEngageCredentials,
} from "./twilio-segment-engage-api.adapter";
import {
  TWILIO_SEGMENT_ENGAGE_OPERATIONS,
  TWILIO_SEGMENT_ENGAGE_SENSITIVE_READ_OPERATION_IDS,
  TWILIO_SEGMENT_ENGAGE_STRUCTURAL_READ_OPERATION_IDS,
} from "./twilio-segment-engage-operation-registry";

describe("TwilioSegmentEngageApiAdapter", () => {
  const credentials: TwilioSegmentEngageCredentials = {
    apiToken: "secret",
    region: "eu",
    healthSpaceId: "space_123",
  };

  afterEach(() => jest.restoreAllMocks());

  it("pins three reads with a 1/2 policy split", () => {
    expect(TWILIO_SEGMENT_ENGAGE_OPERATIONS).toHaveLength(3);
    expect(TWILIO_SEGMENT_ENGAGE_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(1);
    expect(TWILIO_SEGMENT_ENGAGE_SENSITIVE_READ_OPERATION_IDS).toHaveLength(2);
  });

  it("uses only the selected fixed regional origin and bearer token", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"data":{"audiences":[]}}'));
    await new TwilioSegmentEngageApiAdapter().read(
      credentials,
      "list_audiences",
      { spaceId: "space_123" },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://eu1.api.segmentapis.com/spaces/space_123/audiences",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });

  it("pins exact audience IDs without include or pagination expansion", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"data":{"audience":{}}}'));
    await new TwilioSegmentEngageApiAdapter().read(
      credentials,
      "get_audience",
      { spaceId: "space_123", audienceId: "aud_456" },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://eu1.api.segmentapis.com/spaces/space_123/audiences/aud_456",
    );
  });

  it("blocks routing input, cross-operation IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new TwilioSegmentEngageApiAdapter();
    await expect(
      adapter.read(credentials, "get_space", {
        spaceId: "space_123",
        audienceId: "aud_456",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.read(credentials, "get_space", {
        spaceId: "space_123",
        region: "us",
      } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(() => adapter.read(credentials, "send_campaign", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
