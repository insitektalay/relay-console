jest.mock("node:dns/promises", () => ({
  lookup: jest.fn().mockResolvedValue([{ address: "203.0.113.10", family: 4 }]),
}));

import {
  NinjaFormsApiAdapter,
  NinjaFormsApiError,
} from "./ninja-forms-api.adapter";

describe("NinjaFormsApiAdapter", () => {
  const credentials = {
    siteUrl: "https://forms.example.com/wordpress/",
    username: "relay-reader",
    applicationPassword: "abcd efgh ijkl mnop",
  };

  afterEach(() => jest.restoreAllMocks());

  it("pins the ability route and forces bounded action-free form listing", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          forms: [
            {
              id: 7,
              title: "Intake",
              created_at: "2026-07-17",
              field_count: 3,
              settings: { admin_email_to: "private@example.com" },
            },
          ],
          count: 1,
        }),
        { status: 200 },
      ),
    );
    const result = await new NinjaFormsApiAdapter().read(
      credentials,
      "forms.list",
      { title: "Intake", limit: 5 },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        "https://forms.example.com/wordpress/wp-json/wp-abilities/v1/ninjaforms/list-forms/run",
      ),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("relay-reader:abcd efgh ijkl mnop").toString("base64")}`,
        }),
        body: JSON.stringify({
          input: {
            title: "Intake",
            include_fields: true,
            include_actions: false,
            limit: 5,
          },
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      success: true,
      forms: [
        {
          id: 7,
          title: "Intake",
          created_at: "2026-07-17",
          field_count: 3,
        },
      ],
      count: 1,
      message: undefined,
    });
  });

  it("pins exact submission-field reads and preserves labeled field values", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          submission_id: 44,
          fields: [{ field_id: 2, field_label: "Email", value: "a@b.test" }],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new NinjaFormsApiAdapter().read(credentials, "submission-fields.get", {
        submissionId: 44,
      }),
    ).resolves.toEqual({
      success: true,
      submission_id: 44,
      fields: [{ field_id: 2, field_label: "Email", value: "a@b.test" }],
    });
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ input: { submission_id: 44, include_labels: true } }),
    );
  });

  it("blocks private sites, arbitrary abilities, and unbounded inputs", async () => {
    const adapter = new NinjaFormsApiAdapter();
    expect(() => adapter.read(credentials, "submissions.list", {})).toThrow(
      NinjaFormsApiError,
    );
    await expect(
      adapter.read(
        { ...credentials, siteUrl: "https://127.0.0.1/" },
        "forms.list",
        {},
      ),
    ).rejects.toThrow("private or local address");
    expect(() =>
      adapter.read(credentials, "forms.list", { limit: 26 }),
    ).toThrow("integer from 1 to 25");
  });
});
