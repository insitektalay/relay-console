import { ZOHO_DESK_CONNECTOR_MANIFEST } from "./zoho-desk.connector";

describe("Zoho Desk connector manifest", () => {
  it("publishes two exact scopes and two bounded ticket reads", () => {
    expect(ZOHO_DESK_CONNECTOR_MANIFEST).toMatchObject({
      slug: "zoho-desk",
      connectorType: "native_clawchat",
      auth: {
        type: "oauth2_authorization_code",
        oauth: { requiredScopes: ["Desk.tickets.READ", "Desk.basic.READ"] },
      },
    });
    expect(ZOHO_DESK_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual([]);
    expect(ZOHO_DESK_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "zohoDesk.listTickets",
      "zohoDesk.getTicket",
    ]);
  });

  it("requires Safe approval and preserves hard blocks in Dangerous", () => {
    const [safe, dangerous] = ZOHO_DESK_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual([
      "zoho_desk_ticket_list",
      "zoho_desk_ticket_get",
    ]);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual([
      "zoho_desk_ticket_list",
      "zoho_desk_ticket_get",
    ]);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "zoho_desk_ticket_mutation",
        "zoho_desk_private_support_data",
        "zoho_desk_raw_search",
        "zoho_desk_bulk_export",
      ]),
    );
  });
});
