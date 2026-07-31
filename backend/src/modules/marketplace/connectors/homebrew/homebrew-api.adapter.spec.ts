import {
  HomebrewApiAdapter,
  type HomebrewCredentials,
} from "./homebrew-api.adapter";

const credentials: HomebrewCredentials = {
  formulaToken: "make",
  caskToken: "firefox",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("HomebrewApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the selected formula path and strips source and install details", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        name: "make",
        full_name: "make",
        tap: "homebrew/core",
        versions: { stable: "4.4.1", head: "HEAD", bottle: true },
        revision: 0,
        deprecated: false,
        disabled: false,
        homepage: "https://private.example/formula",
        urls: { stable: { url: "https://private.example/archive" } },
        bottle: { stable: { files: { private: "private" } } },
        dependencies: ["private"],
        analytics: { private: "private" },
      }),
    );
    await expect(
      new HomebrewApiAdapter().getFormulaSummary(credentials),
    ).resolves.toEqual({
      formula: {
        token: "make",
        fullName: "make",
        tap: "homebrew/core",
        stableVersion: "4.4.1",
        revision: 0,
        deprecated: false,
        disabled: false,
        sourceAndInstallDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://formulae.brew.sh/api/formula/make.json",
    );
  });

  it("projects only bounded selected cask lifecycle metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        token: "firefox",
        full_token: "firefox",
        tap: "homebrew/cask",
        version: "152.0.6",
        auto_updates: true,
        deprecated: false,
        disabled: false,
        url: "https://private.example/app.dmg",
        sha256: "private",
        artifacts: [{ app: ["Private.app"] }],
        caveats: "private",
        depends_on: { private: "private" },
      }),
    );
    await expect(
      new HomebrewApiAdapter().getCaskSummary(credentials),
    ).resolves.toEqual({
      cask: {
        token: "firefox",
        fullToken: "firefox",
        tap: "homebrew/cask",
        version: "152.0.6",
        autoUpdates: true,
        deprecated: false,
        disabled: false,
        artifactAndInstallDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://formulae.brew.sh/api/cask/firefox.json",
    );
  });

  it("rejects unsafe tokens before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new HomebrewApiAdapter().getFormulaSummary({
        ...credentials,
        formulaToken: "../private",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps throttling without exposing provider content", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ message: "private" }, 429));
    await expect(
      new HomebrewApiAdapter().getCaskSummary(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
