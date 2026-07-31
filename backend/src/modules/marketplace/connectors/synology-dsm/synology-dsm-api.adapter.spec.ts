import { lookup } from "node:dns/promises";
import {
  SynologyDsmApiAdapter,
  type SynologyDsmCredentials,
} from "./synology-dsm-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: SynologyDsmCredentials = {
  serverOrigin: "https://dsm.example.test:5001",
  apiName: "SYNO.FileStation.List",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("SynologyDsmApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("queries one API name and strips provider paths and storage details", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        success: true,
        data: {
          "SYNO.FileStation.List": {
            path: "entry.cgi",
            minVersion: 1,
            maxVersion: 2,
            requestFormat: "JSON",
            private: "private",
          },
        },
      }),
    );
    await expect(
      new SynologyDsmApiAdapter().getSelectedApiCompatibility(credentials),
    ).resolves.toEqual({
      api: {
        apiName: "SYNO.FileStation.List",
        minVersion: 1,
        maxVersion: 2,
        requestFormat: "JSON",
        providerPathIncluded: false,
        accountOrStorageDataIncluded: false,
      },
    });
    const requested = new URL(fetchMock.mock.calls[0][0].toString());
    expect(requested.origin).toBe("https://dsm.example.test:5001");
    expect(requested.pathname).toBe("/webapi/entry.cgi");
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      api: "SYNO.API.Info",
      version: "1",
      method: "query",
      query: "SYNO.FileStation.List",
    });
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({
      Accept: "application/json",
    });
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("error");
  });

  it.each([
    "http://dsm.example.test:5000",
    "https://user@dsm.example.test:5001",
    "https://dsm.example.test:5001/webapi",
    "https://dsm.example.test:5001?api=private",
    "https://dsm.example.test:5001#private",
  ])(
    "rejects an unsafe DSM origin before network access: %s",
    async (serverOrigin) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new SynologyDsmApiAdapter().getSelectedApiCompatibility({
          ...credentials,
          serverOrigin,
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
      new SynologyDsmApiAdapter().getSelectedApiCompatibility(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe API names before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new SynologyDsmApiAdapter().getSelectedApiCompatibility({
        ...credentials,
        apiName: "SYNO.API.Info&query=all",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a response without the selected API", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({ success: true, data: { "SYNO.API.Auth": {} } }),
      );
    await expect(
      new SynologyDsmApiAdapter().getSelectedApiCompatibility(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects an invalid selected API version range", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        success: true,
        data: {
          "SYNO.FileStation.List": { minVersion: 3, maxVersion: 2 },
        },
      }),
    );
    await expect(
      new SynologyDsmApiAdapter().getSelectedApiCompatibility(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("maps provider failures without exposing response content", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ message: "private" }, 503));
    await expect(
      new SynologyDsmApiAdapter().getSelectedApiCompatibility(credentials),
    ).rejects.toMatchObject({ code: "provider_unavailable", statusCode: 503 });
  });
});
