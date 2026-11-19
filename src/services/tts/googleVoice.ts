/**
 * The learner's chosen Google voice (e.g. "ko-KR-Neural2-A"), remembered in this browser.
 * Empty = the server's default (GOOGLE_TTS_VOICE).
 */
const KEY = "korean-reader.googleVoice";

let current = "";
try {
  current = localStorage.getItem(KEY) ?? "";
} catch {
  // storage unavailable
}

export function getGoogleVoice(): string {
  return current;
}

export function setGoogleVoice(voice: string): void {
  current = voice;
  try {
    if (voice) localStorage.setItem(KEY, voice);
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
