import { registrations } from "./providerStore";
import type { TtsProvider } from "./TtsProvider";

// Auto-discover every provider file; each one calls registerTtsProvider() when imported.
import.meta.glob("./providers/*.ts", { eager: true });

const instances = new Map<string, TtsProvider>();

export function listTtsProviders(): { id: string; label: string }[] {
  return [...registrations.values()].map(({ id, label }) => ({ id, label }));
}

export function hasTtsProvider(id: string): boolean {
  return registrations.has(id);
}

/** Returns a shared instance, so per-provider state (e.g. audio cache) survives switching. */
export function getTtsProvider(id: string): TtsProvider {
  let instance = instances.get(id);
  if (!instance) {
    const registration = registrations.get(id);
    if (!registration) throw new Error(`Unknown TTS provider "${id}"`);
    instance = registration.create();
    instances.set(id, instance);
  }
  return instance;
}
