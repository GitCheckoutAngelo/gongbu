import { listTtsVoices, type TtsVoiceInfo } from "../../api/client";

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

let voiceList: Promise<{ voices: TtsVoiceInfo[]; default: string }> | undefined;

/**
 * The second voice for dialogues: the opposite gender in the same family as the chosen voice (Neural2 A →
 * Neural2 C), else another voice in that family, else the chosen voice itself.
 */
export async function partnerVoice(): Promise<string> {
  try {
    voiceList ??= listTtsVoices().catch((err) => {
      voiceList = undefined;
      throw err;
    });
    const { voices, default: fallback } = await voiceList;
    const name = current || fallback;
    const me = voices.find((v) => v.name === name);
    if (!me) return current;
    const family = voices.filter((v) => v.family === me.family && v.name !== me.name);
    const opposite = family.find((v) => v.gender !== me.gender && v.gender !== "neutral");
    return (opposite ?? family[0])?.name ?? current;
  } catch {
    return current;
  }
}
