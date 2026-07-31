import {
  GreenhouseApiAdapter,
  type GreenhouseCredentials,
} from "./greenhouse-api.adapter";

const credentials: GreenhouseCredentials = {
  accessToken: "greenhouse-access",
  organizationId: "org_42",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("GreenhouseApiAdapter", () => {
  it("lists bounded first-page Jobs and excludes recruiting content", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(
        response([
          {
            id: 101,
            name: "Platform Engineer",
            status: "open",
            requisition_id: "ENG-101",
            department_id: 10,
            office_ids: [20],
            hiring_team: [{ name: "must-not-leak" }],
            notes: "must-not-leak",
            custom_fields: { salary: "must-not-leak" },
          },
        ]),
      );
    const result = await new GreenhouseApiAdapter(requester).listJobs(
      credentials,
      { limit: 5 },
    );
    expect(requester.mock.calls[0][0]).toBe(
      "https://harvest.greenhouse.io/v3/jobs?per_page=5",
    );
    expect(result).toMatchObject({
      limit: 5,
      automaticPagination: false,
      jobs: [
        { id: 101, candidateDataReturned: false, hiringTeamReturned: false },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
  });

  it("lists safe Office and Department hierarchy summaries", async () => {
    const officeRequester = jest
      .fn()
      .mockResolvedValue(
        response({
          data: [
            {
              id: 20,
              name: "London",
              parent_id: null,
              external_id: "LDN",
              location: "must-not-leak",
              primary_in_house_contact_user_id: 9,
            },
          ],
        }),
      );
    const offices = await new GreenhouseApiAdapter(officeRequester).listOffices(
      credentials,
      {},
    );
    expect(offices.offices[0]).toMatchObject({
      id: 20,
      physicalLocationReturned: false,
      contactUserReturned: false,
    });
    expect(JSON.stringify(offices)).not.toContain("must-not-leak");
    const departments = await new GreenhouseApiAdapter(
      jest
        .fn()
        .mockResolvedValue(
          response([{ id: 10, name: "Engineering", external_id: "ENG" }]),
        ),
    ).listDepartments(credentials, { limit: 1 });
    expect(departments.departments[0]).toMatchObject({
      id: 10,
      name: "Engineering",
      externalId: "ENG",
    });
  });

  it("rejects invalid organization bindings and maps rate limits", async () => {
    await expect(
      new GreenhouseApiAdapter(jest.fn()).listJobs(
        { ...credentials, organizationId: "bad/org" },
        {},
      ),
    ).rejects.toMatchObject({ code: "greenhouse_organization_id_invalid" });
    await expect(
      new GreenhouseApiAdapter(
        jest.fn().mockResolvedValue(response({}, 429)),
      ).listJobs(credentials, {}),
    ).rejects.toMatchObject({
      code: "greenhouse_rate_limited",
      statusCode: 429,
    });
  });
});
