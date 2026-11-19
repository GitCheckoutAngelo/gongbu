import type { Settings } from "./config";

export class UnknownProviderError extends Error {}

/**
 * A provider registry for one service. Provider files register themselves:
 *
 *   paragraphRegistry.register("claude", (settings) => ClaudeParagraphGenerator.fromSettings(settings));
 *
 * Each service's index.ts imports every file in its providers/ folder (import.meta.glob), so adding a
 * provider means one new file plus one config value; no central list to edit.
 */
export class Registry<T> {
  private readonly factories = new Map<string, (settings: Settings) => T>();

  constructor(readonly serviceName: string) {}

  register(name: string, factory: (settings: Settings) => T): void {
    if (this.factories.has(name)) throw new Error(`${this.serviceName} provider "${name}" is registered twice`);
    this.factories.set(name, factory);
  }

  names(): string[] {
    return [...this.factories.keys()].sort();
  }

  create(name: string, settings: Settings): T {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new UnknownProviderError(
        `Unknown ${this.serviceName} provider "${name}". Available: ${this.names().join(", ") || "(none)"}`,
      );
    }
    return factory(settings);
  }
}
