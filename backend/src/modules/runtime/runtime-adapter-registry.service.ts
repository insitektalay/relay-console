import { Injectable, NotFoundException } from "@nestjs/common";
import { RuntimeAdapter, RuntimeType } from "./runtime.types";

@Injectable()
export class RuntimeAdapterRegistry {
  private readonly adapters = new Map<RuntimeType, RuntimeAdapter>();

  register(adapter: RuntimeAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  has(type: RuntimeType): boolean {
    return this.adapters.has(type);
  }

  get(type: RuntimeType): RuntimeAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new NotFoundException(`Runtime adapter not registered for ${type}`);
    }
    return adapter;
  }

  listTypes(): RuntimeType[] {
    return Array.from(this.adapters.keys());
  }
}
