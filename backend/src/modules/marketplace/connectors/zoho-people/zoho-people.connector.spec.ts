import {
  ZohoPeopleApiAdapter,
  ZohoPeopleApiError,
  type ZohoPeopleCredentials,
} from "./zoho-people-api.adapter";
import { ZOHO_PEOPLE_CONNECTOR_MANIFEST } from "./zoho-people.connector";

const credentials: ZohoPeopleCredentials = {
  accessToken: "access-token",
  apiOrigin: "https://www.zohoapis.eu",
  accountsOrigin: "https://accounts.zoho.eu",
  userId: "1000000000001",
};

describe("Zoho People connector", () => {
  it("publishes only two approval-gated organization-structure reads", () => {
    expect(ZOHO_PEOPLE_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual([
      "AaaServer.profile.Read",
      "ZOHOPEOPLE.orgstructure.READ",
    ]);
    expect(
      ZOHO_PEOPLE_CONNECTOR_MANIFEST.tools.map((tool) => tool.functionName),
    ).toEqual(["zoho_people_structure_list", "zoho_people_structure_get"]);
    expect(
      ZOHO_PEOPLE_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("lists a bounded first page and projects only structure fields", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(String(url)).toBe(
        "https://www.zohoapis.eu/people/api/v3/orgstructure/divisions?offset=1&limit=2",
      );
      return new Response(
        JSON.stringify({
          data: [
            {
              zoho_id: "1000000000101",
              name: "Operations",
              zp_code: "OPS",
              description: "private internal description",
              parent_division: {
                zoho_id: "1000000000100",
                name: "Company",
                confidential: "excluded",
              },
              employees: [{ email: "private@example.com" }],
            },
          ],
          has_more: true,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const result = await new ZohoPeopleApiAdapter(requester).listStructure(
      credentials,
      { kind: "divisions", limit: 2 },
    );
    expect(result).toEqual({
      kind: "divisions",
      records: [
        {
          id: "1000000000101",
          name: "Operations",
          code: "OPS",
          parentDivision: { id: "1000000000100", name: "Company" },
        },
      ],
      hasMore: true,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("description");
  });

  it("reads one exact allowlisted structure route", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(String(url)).toBe(
        "https://www.zohoapis.eu/people/api/v3/orgstructure/units/1000000000201",
      );
      return new Response(
        JSON.stringify({
          zoho_id: "1000000000201",
          name: "Europe",
          zp_code: "EU",
        }),
        { status: 200 },
      );
    });
    await expect(
      new ZohoPeopleApiAdapter(requester).getStructure(credentials, {
        kind: "units",
        recordId: "1000000000201",
      }),
    ).resolves.toEqual({
      kind: "units",
      record: {
        id: "1000000000201",
        name: "Europe",
        code: "EU",
        parentDivision: null,
      },
    });
  });

  it("health binds the same current user and checks People scope", async () => {
    const requester = jest.fn(async (url: string | URL) =>
      String(url).includes("/oauth/user/info")
        ? new Response(
            JSON.stringify({
              ZUID: "1000000000001",
              Display_Name: "Ada Admin",
              Email: "ada@example.com",
            }),
            { status: 200 },
          )
        : new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    await expect(
      new ZohoPeopleApiAdapter(requester).health(credentials),
    ).resolves.toMatchObject({
      userId: "1000000000001",
      displayName: "Ada Admin",
      email: "ada@example.com",
      apiOrigin: "https://www.zohoapis.eu",
      accountsOrigin: "https://accounts.zoho.eu",
    });
    expect(requester).toHaveBeenCalledTimes(2);
  });

  it("rejects unsafe identifiers, regions, and oversized responses", async () => {
    const adapter = new ZohoPeopleApiAdapter(
      async () =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-length": "1000001" },
        }),
    );
    await expect(
      adapter.getStructure(credentials, {
        kind: "entities",
        recordId: "../employees",
      }),
    ).rejects.toBeInstanceOf(ZohoPeopleApiError);
    await expect(
      adapter.listStructure(
        { ...credentials, apiOrigin: "https://attacker.example" },
        { kind: "entities" },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listStructure(credentials, { kind: "entities" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
