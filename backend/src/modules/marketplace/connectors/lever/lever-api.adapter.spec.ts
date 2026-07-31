import { LeverApiAdapter, type LeverCredentials } from "./lever-api.adapter";
const credentials: LeverCredentials = {
  accessToken: "lever-access",
  accountId: "account_42",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
describe("LeverApiAdapter", () => {
  it("lists only bounded non-confidential Postings and strips content and people", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(
        response({
          data: [
            {
              id: "posting-1",
              text: "Platform Engineer",
              state: "published",
              confidentiality: "non-confidential",
              categories: {
                team: "Platform",
                department: "Engineering",
                location: "London",
                commitment: "Full-time",
              },
              workplaceType: "hybrid",
              distributionChannels: ["public"],
              content: { descriptionHtml: "must-not-leak" },
              salaryDescription: "must-not-leak",
              owner: "must-not-leak",
            },
          ],
          next: "must-not-follow",
          hasNext: true,
        }),
      );
    const result = await new LeverApiAdapter(requester).listPostings(
      credentials,
      { limit: 5 },
    );
    expect(requester.mock.calls[0][0]).toBe(
      "https://api.lever.co/v1/postings?limit=5&confidentiality=non-confidential",
    );
    expect(result).toMatchObject({
      limit: 5,
      automaticPagination: false,
      confidentialDataReturned: false,
      postings: [
        {
          text: "Platform Engineer",
          contentReturned: false,
          peopleReturned: false,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(JSON.stringify(result)).not.toContain("must-not-follow");
  });
  it("lists Stage vocabulary without opportunity membership", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(
        response({
          data: [
            { id: "stage-1", text: "Onsite", opportunities: ["must-not-leak"] },
          ],
        }),
      );
    const result = await new LeverApiAdapter(requester).listStages(
      credentials,
      { limit: 1 },
    );
    expect(result.stages).toEqual([
      { id: "stage-1", text: "Onsite", candidateDataReturned: false },
    ]);
  });
  it("rejects invalid account bindings and maps throttling", async () => {
    await expect(
      new LeverApiAdapter(jest.fn()).listStages(
        { ...credentials, accountId: "bad/account" },
        {},
      ),
    ).rejects.toMatchObject({ code: "lever_account_id_invalid" });
    await expect(
      new LeverApiAdapter(
        jest.fn().mockResolvedValue(response({}, 503)),
      ).listStages(credentials, {}),
    ).rejects.toMatchObject({ code: "lever_rate_limited", statusCode: 503 });
  });
});
