/**
 * Worker configuration. Plain settings come from `vars` in wrangler.jsonc; secrets come from
 * `wrangler secret put …` in production and `.dev.vars` locally. Secrets never reach the browser.
 */
export interface Env {
  // vars (wrangler.jsonc)
  PARAGRAPH_PROVIDER?: string;
  ROMANIZER_PROVIDER?: string;
  TTS_PROVIDER?: string;
  WORD_SUGGESTER_PROVIDER?: string;
  ALIGNER_PROVIDER?: string;
  ANTHROPIC_MODEL?: string;
  GOOGLE_TTS_VOICE?: string;
  // secrets
  ANTHROPIC_API_KEY?: string;
  GOOGLE_TTS_API_KEY?: string;
  /** Optional: a key for Speech-to-Text (word alignment); defaults to GOOGLE_TTS_API_KEY. */
  GOOGLE_STT_API_KEY?: string;
  // rate-limit bindings (wrangler.jsonc "ratelimits"); absent in unit tests
  AI_RATE_LIMITER?: RateLimit;
  TTS_RATE_LIMITER?: RateLimit;
  DATA_RATE_LIMITER?: RateLimit;
  // D1 database for per-learner data (wrangler.jsonc "d1_databases"); absent in unit tests
  DB?: D1Database;
}

export interface Settings {
  paragraphProvider: string;
  romanizerProvider: string;
  ttsProvider: string;
  wordSuggesterProvider: string;
  alignerProvider: string;
  anthropicApiKey?: string;
  anthropicModel: string;
  googleTtsApiKey?: string;
  googleSttApiKey?: string;
  googleTtsVoice: string;
}

const clean = (v: string | undefined) => v?.trim() || undefined;

export function settingsFromEnv(env: Env): Settings {
  return {
    paragraphProvider: clean(env.PARAGRAPH_PROVIDER) ?? "claude",
    romanizerProvider: clean(env.ROMANIZER_PROVIDER) ?? "koroman",
    ttsProvider: clean(env.TTS_PROVIDER) ?? "google_cloud",
    wordSuggesterProvider: clean(env.WORD_SUGGESTER_PROVIDER) ?? "claude",
    alignerProvider: clean(env.ALIGNER_PROVIDER) ?? "google_stt",
    anthropicApiKey: clean(env.ANTHROPIC_API_KEY),
    anthropicModel: clean(env.ANTHROPIC_MODEL) ?? "claude-haiku-5-5",
    googleTtsApiKey: clean(env.GOOGLE_TTS_API_KEY),
    googleSttApiKey: clean(env.GOOGLE_STT_API_KEY),
    googleTtsVoice: clean(env.GOOGLE_TTS_VOICE) ?? "ko-KR-Standard-A",
  };
}
