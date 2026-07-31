type MethodModule = Readonly<Record<string, unknown>>;

export type NativeExecutorRegistration<MethodName extends string = string> = {
  methodName: MethodName;
  needsConnection: boolean;
};

export type NativeExecutorRegistrationMap<Methods extends MethodModule> =
  Readonly<
    Record<string, NativeExecutorRegistration<Extract<keyof Methods, string>>>
  >;

export type NativeExecutorRegistrationModule = {
  methods: MethodModule;
  registrations: Readonly<Record<string, NativeExecutorRegistration>>;
};

export function mergeNativeExecutorRegistrationModules(
  ...modules: NativeExecutorRegistrationModule[]
): ReadonlyMap<string, NativeExecutorRegistration> {
  const bySlug = new Map<string, NativeExecutorRegistration>();
  const ownerByMethod = new Map<string, string>();
  for (const module of modules) {
    for (const [slug, registration] of Object.entries(module.registrations)) {
      if (bySlug.has(slug)) {
        throw new Error(`Duplicate native executor registration for ${slug}`);
      }
      const existingMethodOwner = ownerByMethod.get(registration.methodName);
      if (existingMethodOwner) {
        throw new Error(
          `Native executor method ${registration.methodName} is owned by both ${existingMethodOwner} and ${slug}`,
        );
      }
      if (typeof module.methods[registration.methodName] !== "function") {
        throw new Error(
          `Native executor registration ${slug} references missing method ${registration.methodName}`,
        );
      }
      bySlug.set(slug, registration);
      ownerByMethod.set(registration.methodName, slug);
    }
  }
  return bySlug;
}
