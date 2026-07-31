import {
  type NativeExecutorRegistrationModule,
  mergeNativeExecutorRegistrationModules,
} from "./native-executor-registration";
import { NATIVE_EXECUTOR_REGISTRATION_BY_SLUG } from "./provider-handlers/native-executor-registry.index";

function module(
  slug: string,
  methodName: string,
): NativeExecutorRegistrationModule {
  return {
    methods: { [methodName]: () => undefined },
    registrations: {
      [slug]: { methodName, needsConnection: false },
    },
  };
}

describe("native executor registration ownership", () => {
  it("registers every extracted native provider exactly once", () => {
    expect(NATIVE_EXECUTOR_REGISTRATION_BY_SLUG.size).toBe(630);
    expect(NATIVE_EXECUTOR_REGISTRATION_BY_SLUG.get("airmeet")).toEqual({
      methodName: "executeAirmeet",
      needsConnection: false,
    });
    expect(NATIVE_EXECUTOR_REGISTRATION_BY_SLUG.get("onesignal")).toEqual({
      methodName: "executeOneSignal",
      needsConnection: false,
    });
  });

  it("rejects duplicate provider and method ownership", () => {
    expect(() =>
      mergeNativeExecutorRegistrationModules(
        module("first", "executeFirst"),
        module("first", "executeSecond"),
      ),
    ).toThrow("Duplicate native executor registration for first");

    expect(() =>
      mergeNativeExecutorRegistrationModules(
        module("first", "executeShared"),
        module("second", "executeShared"),
      ),
    ).toThrow(
      "Native executor method executeShared is owned by both first and second",
    );
  });

  it("rejects registrations whose owning module lacks the method", () => {
    expect(() =>
      mergeNativeExecutorRegistrationModules({
        methods: {},
        registrations: {
          missing: {
            methodName: "executeMissing",
            needsConnection: false,
          },
        },
      }),
    ).toThrow(
      "Native executor registration missing references missing method executeMissing",
    );
  });
});
