import { lookup } from "node:dns/promises";
import {
  KirbyCmsApiAdapter,
  type KirbyCmsCredentials,
} from "./kirby-cms-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: KirbyCmsCredentials = {
  siteBaseUrl: "https://kirby.example.test/cms",
  userEmail: "relay-reader@example.test",
  userPassword: "dedicated-password",
  pageId: "projects+example-project",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("KirbyCmsApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("reads one exact page and returns only its ID and status", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          id: "projects/example-project",
          status: "listed",
          title: "Private title",
          content: { privateBody: "Private content" },
          uuid: "page://private",
          url: "https://kirby.example.test/private",
        },
      }),
    );
    await expect(
      new KirbyCmsApiAdapter().getSelectedPageState(credentials),
    ).resolves.toEqual({
      page: {
        pageId: "projects/example-project",
        status: "listed",
        pageContentOrIdentityIncluded: false,
        otherSiteDataIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://kirby.example.test/cms/api/pages/projects+example-project?select=id%2Cstatus",
    );
    const request = fetchMock.mock.calls[0][1];
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: expect.stringMatching(/^Basic /),
        },
        redirect: "error",
      }),
    );
    expect((request?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("relay-reader@example.test:dedicated-password").toString("base64")}`,
    );
  });

  it.each([
    "http://kirby.example.test",
    "https://user@kirby.example.test",
    "https://kirby.example.test/cms?private=true",
    "https://kirby.example.test/cms#private",
    "https://kirby.example.test/cms/%2Fprivate",
  ])(
    "rejects an unsafe site URL before network access: %s",
    async (siteBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new KirbyCmsApiAdapter().getSelectedPageState({
          ...credentials,
          siteBaseUrl,
        }),
      ).rejects.toMatchObject({ code: "policy_blocked" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects private DNS resolution before network access", async () => {
    mockedLookup.mockResolvedValue([
      { address: "192.168.1.10", family: 4 },
    ] as never);
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new KirbyCmsApiAdapter().getSelectedPageState(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid credentials and unsafe page IDs before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new KirbyCmsApiAdapter().getSelectedPageState({
        ...credentials,
        userEmail: "not-an-email",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new KirbyCmsApiAdapter().getSelectedPageState({
        ...credentials,
        userPassword: "short",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new KirbyCmsApiAdapter().getSelectedPageState({
        ...credentials,
        pageId: "projects/example-project",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a returned page that differs from the configured selection", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({ data: { id: "projects/other", status: "listed" } }),
      );
    await expect(
      new KirbyCmsApiAdapter().getSelectedPageState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
