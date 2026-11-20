/**
 * This browser's sync key: a random secret that identifies its saved data on the server (saved
 * paragraphs, Common Words progress). There are no accounts; whoever has the key has the data.
 */
const KEY = "gongbu.syncKey";
export const SYNC_KEY_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

let cached: string | null = null;

function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The key, made on first use and remembered in this browser. */
export function getSyncKey(): string {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && SYNC_KEY_PATTERN.test(stored)) return (cached = stored);
    const fresh = randomKey();
    localStorage.setItem(KEY, fresh);
    return (cached = fresh);
  } catch {
    // Storage blocked: a key for this page visit only.
    return (cached ??= randomKey());
  }
}
