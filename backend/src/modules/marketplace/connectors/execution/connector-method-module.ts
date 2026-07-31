type MethodModule = Readonly<Record<string, unknown>>;

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

export function mergeConnectorMethodModules<
  const Modules extends readonly MethodModule[],
>(...modules: Modules): UnionToIntersection<Modules[number]> {
  const merged: Record<string, unknown> = {};
  for (const module of modules) {
    for (const [methodName, method] of Object.entries(module)) {
      if (Object.prototype.hasOwnProperty.call(merged, methodName)) {
        throw new Error(`Duplicate connector execution method ${methodName}`);
      }
      merged[methodName] = method;
    }
  }
  return Object.freeze(merged) as UnionToIntersection<Modules[number]>;
}

export function installConnectorMethodModules(
  target: object,
  ...modules: MethodModule[]
): void {
  const merged = mergeConnectorMethodModules(...modules);
  for (const methodName of Object.keys(merged)) {
    if (Object.prototype.hasOwnProperty.call(target, methodName)) {
      throw new Error(
        `Connector execution method ${methodName} conflicts with the service prototype`,
      );
    }
  }
  Object.assign(target, merged);
}
