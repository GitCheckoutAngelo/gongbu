import type { TtsProvider } from "./TtsProvider";

export interface TtsProviderRegistration {
  id: string;
  label: string;
  create: () => TtsProvider;
}

// Kept separate from registry.ts so provider modules can import it without a circular import.
export const registrations = new Map<string, TtsProviderRegistration>();

/** Called at module load by each file in ./providers/. */
export function registerTtsProvider(registration: TtsProviderRegistration): void {
  registrations.set(registration.id, registration);
}
