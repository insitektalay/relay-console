import { AvazaApiAdapter, type AvazaCredentials } from "./avaza-api.adapter";

const credentials: AvazaCredentials = {
  personalAccessToken: "A".repeat(48),
  projectId: "4242",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("AvazaApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns only selected-project lifecycle state", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      json({
        ProjectID: 4242,
        Title: "Private client implementation",
        ProjectCode: "SECRET-42",
        Notes: "Confidential notes",
        CompanyName: "Private Client",
        Members: [{ Email: "private@example.test", RateAmount: 350 }],
        Sections: [{ Title: "Secret phase" }],
        BudgetAmount: 500000,
        ProjectTags: [{ Name: "confidential" }],
        ProjectStatusCode: "Active",
        ProjectStatusName: "In Progress",
        ProjectStatusIsNotStarted: false,
        ProjectStatusIsComplete: false,
        isArchived: false,
        StartDate: "2026-07-01T00:00:00Z",
        EndDate: "2026-09-30T00:00:00Z",
        DateCreated: "2026-06-20T12:00:00Z",
        DateUpdated: "2026-07-18T12:00:00Z",
      }),
    );
    await expect(
      new AvazaApiAdapter().getSelectedProjectState(credentials),
    ).resolves.toEqual({
      project: {
        projectId: "4242",
        statusCode: "Active",
        statusName: "In Progress",
        archived: false,
        notStarted: false,
        complete: false,
        startDate: "2026-07-01T00:00:00Z",
        endDate: "2026-09-30T00:00:00Z",
        createdAt: "2026-06-20T12:00:00Z",
        updatedAt: "2026-07-18T12:00:00Z",
        titleCompanyNotesIncluded: false,
        sectionsMembersRatesBudgetsTagsIncluded: false,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.avaza.com/api/Project/4242",
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${credentials.personalAccessToken}`,
        }),
      }),
    );
  });

  it("rejects invalid credentials and project identifiers before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new AvazaApiAdapter().getSelectedProjectState({
        ...credentials,
        personalAccessToken: "short",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new AvazaApiAdapter().getSelectedProjectState({
        ...credentials,
        projectId: "../Company",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a different returned project", async () => {
    jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      json({
        ProjectID: 9999,
        ProjectStatusCode: "Active",
        ProjectStatusName: "In Progress",
        ProjectStatusIsNotStarted: false,
        ProjectStatusIsComplete: false,
        isArchived: false,
      }),
    );
    await expect(
      new AvazaApiAdapter().getSelectedProjectState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects malformed lifecycle metadata", async () => {
    jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      json({
        ProjectID: 4242,
        ProjectStatusCode: "Active",
        ProjectStatusName: "In Progress",
        ProjectStatusIsNotStarted: "false",
        ProjectStatusIsComplete: false,
        isArchived: false,
      }),
    );
    await expect(
      new AvazaApiAdapter().getSelectedProjectState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("maps rate limits without exposing the provider body", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementationOnce(() =>
        json({ message: "private account detail" }, 429),
      );
    await expect(
      new AvazaApiAdapter().getSelectedProjectState(credentials),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      message: "Avaza API returned HTTP 429.",
    });
  });
});
