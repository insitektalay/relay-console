type MethodModule = Readonly<Record<string, unknown>>;

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

export function mergeOAuthServiceMethodModules<
  const Modules extends readonly MethodModule[],
>(...modules: Modules): UnionToIntersection<Modules[number]> {
  const merged: Record<string, unknown> = {};
  for (const module of modules) {
    for (const [methodName, method] of Object.entries(module)) {
      if (Object.prototype.hasOwnProperty.call(merged, methodName)) {
        throw new Error(`Duplicate OAuth service method ${methodName}`);
      }
      merged[methodName] = method;
    }
  }
  return Object.freeze(merged) as UnionToIntersection<Modules[number]>;
}

export function installOAuthServiceMethodModules(
  target: object,
  ...modules: MethodModule[]
): void {
  const merged = mergeOAuthServiceMethodModules(...modules);
  for (const methodName of Object.keys(merged)) {
    if (Object.prototype.hasOwnProperty.call(target, methodName)) {
      throw new Error(
        `OAuth service method ${methodName} conflicts with the service prototype`,
      );
    }
  }
  Object.assign(target, merged);
}
