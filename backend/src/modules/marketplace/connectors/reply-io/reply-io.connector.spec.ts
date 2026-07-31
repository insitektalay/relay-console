import { REPLY_IO_CONNECTOR_MANIFEST } from "./reply-io.connector";

describe("Reply.io connector manifest", () => {
  it("binds one encrypted read-scoped key, exact sequence ID, and status read", () => {
    expect(REPLY_IO_CONNECTOR_MANIFEST).toMatchObject({ slug: "reply-io", auth: { type: "api_key" } });
    expect(REPLY_IO_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["REPLY_IO_API_KEY", "REPLY_IO_SEQUENCE_ID"]);
    expect(REPLY_IO_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["replyIo.getSequenceStatus"]);
  });
  it("blocks messaging, private content, AI, administration, writes, and raw work in Dangerous", () => {
    const dangerous = REPLY_IO_CONNECTOR_MANIFEST.approvalProfiles[1]; expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["reply_io_sequence_mutation", "reply_io_people_messaging", "reply_io_private_content", "reply_io_ai_admin", "reply_io_raw_bulk"]));
  });
});
