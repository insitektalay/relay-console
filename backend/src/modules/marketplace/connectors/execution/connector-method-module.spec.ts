import {
  installConnectorMethodModules,
  mergeConnectorMethodModules,
} from "./connector-method-module";

describe("connector method modules", () => {
  it("merges distinct methods and freezes the result", () => {
    const merged = mergeConnectorMethodModules(
      { first: () => "first" },
      { second: () => "second" },
    );

    expect(merged.first()).toBe("first");
    expect(merged.second()).toBe("second");
    expect(Object.isFrozen(merged)).toBe(true);
  });

  it("rejects duplicate method ownership", () => {
    expect(() =>
      mergeConnectorMethodModules(
        { duplicate: () => "first" },
        { duplicate: () => "second" },
      ),
    ).toThrow("Duplicate connector execution method duplicate");
  });

  it("rejects collisions with methods retained on the service prototype", () => {
    const target = { retained: () => "core" };

    expect(() =>
      installConnectorMethodModules(target, {
        retained: () => "extension",
      }),
    ).toThrow(
      "Connector execution method retained conflicts with the service prototype",
    );
  });
});
