import {
  buildCondensedFallbackPreview,
  CONDENSED_MESSAGE_PROVIDER,
  getCondensedMessageMetadata,
  withCondensedMessageMetadata,
} from "../../../../packages/contracts/src/message-condensed";

describe("condensed message contract helpers", () => {
  it("parses condensed metadata safely", () => {
    expect(
      getCondensedMessageMetadata({
        condensed: {
          text: "Short summary",
          lineCountHint: 1,
          generatedAt: "2026-04-22T10:30:00.000Z",
          provider: CONDENSED_MESSAGE_PROVIDER,
          sourceContentHash: "abc123",
        },
      }),
    ).toEqual({
      text: "Short summary",
      lineCountHint: 1,
      generatedAt: "2026-04-22T10:30:00.000Z",
      provider: CONDENSED_MESSAGE_PROVIDER,
      sourceContentHash: "abc123",
    });
  });

  it("writes condensed metadata without dropping unrelated metadata", () => {
    expect(
      withCondensedMessageMetadata(
        { runtimeDispatchId: "dispatch-1" },
        {
          text: "Tight summary",
          lineCountHint: 2,
          generatedAt: "2026-04-22T10:30:00.000Z",
          provider: CONDENSED_MESSAGE_PROVIDER,
          sourceContentHash: "hash-1",
        },
      ),
    ).toEqual({
      runtimeDispatchId: "dispatch-1",
      condensed: {
        text: "Tight summary",
        lineCountHint: 2,
        generatedAt: "2026-04-22T10:30:00.000Z",
        provider: CONDENSED_MESSAGE_PROVIDER,
        sourceContentHash: "hash-1",
      },
    });
  });

  it("builds a plain-text fallback preview from markdown-heavy content", () => {
    const preview = buildCondensedFallbackPreview(
      "## Update\n\n- Fixed the auth redirect bug.\n- Added retry handling for websocket reconnects.\n\n[See PR](https://example.com)",
    );

    expect(preview).toContain("Fixed the auth redirect bug");
    expect(preview).not.toContain("##");
    expect(preview).not.toContain("[");
    expect(preview.length).toBeLessThanOrEqual(160);
  });
});
