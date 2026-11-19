/**
 * The REST API, served under /api:
 *   GET  /api/health
 *   POST /api/generate   { difficulty, length, topic? }   → { paragraph, translation, sentences: [{ english, start, end }],
 *                                                         words: [{ korean, romanized, english }] }
 *   POST /api/tts        { text, rate, voice? }           → audio/mpeg
 *   POST /api/tts/timed  { words: [...], rate, voice? }   → { audio_base64, mime_type, word_times }
 *   GET  /api/tts/voices                                  → { voices: [{ name, gender, family }], default }
 *   POST /api/tts/align  { audio_base64, words: [...] }   → { word_times } (null if alignment isn't available)
 *   POST /api/words/suggest { category, band?, count?, exclude? } → { words: [{ spelling, meaning, pos, level,
 *                                                             pronounced?, rules, letters, note?, romanization }] }
 */
import type { Settings } from "./config";
import { ServiceError, ValidationError } from "./errors";
import { CATEGORY_IDS, LEVEL_BAND_IDS } from "../src/data/vocabularyMeta";
import {
  errorResponse,
  intInRange,
  json,
  oneOf,
  optionalString,
  rateValue,
  readJson,
  requiredString,
  stringList,
  wordList,
} from "./http";
import { base64ToBytes, bytesToBase64 } from "./base64";
import { UnknownProviderError } from "./registry";
import { alignerRegistry, type WordAligner } from "./services/aligner";
import { DIFFICULTIES, LENGTHS, paragraphRegistry, type ParagraphGenerator } from "./services/paragraph";
import { romanizerRegistry, type Romanizer } from "./services/romanizer";
import { ttsRegistry, type TtsService } from "./services/tts";
import { wordSuggesterRegistry, type WordSuggester } from "./services/wordSuggester";


/** Services can be injected (tests); otherwise they're created from settings on first use. */
export interface Services {
  paragraph: () => ParagraphGenerator;
  romanizer: () => Romanizer;
  tts: () => TtsService;
  wordSuggester: () => WordSuggester;
  aligner: () => WordAligner;
}

export function servicesFromSettings(settings: Settings): Services {
  return {
    paragraph: () => paragraphRegistry.create(settings.paragraphProvider, settings),
    romanizer: () => romanizerRegistry.create(settings.romanizerProvider, settings),
    tts: () => ttsRegistry.create(settings.ttsProvider, settings),
    wordSuggester: () => wordSuggesterRegistry.create(settings.wordSuggesterProvider, settings),
    aligner: () => alignerRegistry.create(settings.alignerProvider, settings),
  };
}

const MAX_TTS_CHARS = 1500; // Google limits input to 5000 bytes; Hangul is 3 bytes in UTF-8.
const MAX_SUGGESTIONS = 10;
const MAX_ALIGN_AUDIO_B64 = 800_000; // ~600 KB of MP3: well over a minute of Google TTS audio
const MAX_EXCLUDE = 3000; // the built-in list plus plenty of added words

export async function handleApi(request: Request, settings: Settings, services: Services): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/api/, "") || "/";
  try {
    if (path === "/health" && request.method === "GET") {
      return json({
        status: "ok",
        providers: {
          paragraph: settings.paragraphProvider,
          romanizer: settings.romanizerProvider,
          tts: settings.ttsProvider,
          wordSuggester: settings.wordSuggesterProvider,
        },
      });
    }

    if (path === "/generate" && request.method === "POST") {
      const body = await readJson(request);
      const difficulty = oneOf(body.difficulty, DIFFICULTIES, "difficulty", "beginner");
      const length = oneOf(body.length, LENGTHS, "length", "short");
      const topic = optionalString(body.topic, "topic", 200);
      const { paragraph, translation, glosses, sentences } = await services
        .paragraph()
        .generate(difficulty, length, topic);
      const words = paragraph.split(/\s+/).filter(Boolean);
      const romanized = services.romanizer().romanizeWords(words);
      return json({
        paragraph,
        translation,
        sentences,
        words: words.map((korean, i) => ({ korean, romanized: romanized[i] ?? "", english: glosses[i] ?? "" })),
      });
    }

    if (path === "/tts" && request.method === "POST") {
      const body = await readJson(request);
      const text = requiredString(body.text, "text", MAX_TTS_CHARS);
      const rate = rateValue(body.rate);
      const voice = optionalString(body.voice, "voice", 60);
      const audio = await services.tts().synthesize(text, rate, voice);
      return new Response(audio, { headers: { "Content-Type": "audio/mpeg" } });
    }

    if (path === "/tts/timed" && request.method === "POST") {
      const body = await readJson(request);
      const words = wordList(body.words, 400, MAX_TTS_CHARS);
      const rate = rateValue(body.rate);
      const voice = optionalString(body.voice, "voice", 60);
      const tts = services.tts();
      // Providers without timing support still return audio, with word_times = null.
      const result = tts.synthesizeTimed
        ? await tts.synthesizeTimed(words, rate, voice)
        : { audioBase64: bytesToBase64(await tts.synthesize(words.join(" "), rate, voice)), wordTimes: null };
      return json({ audio_base64: result.audioBase64, mime_type: "audio/mpeg", word_times: result.wordTimes });
    }

    if (path === "/tts/align" && request.method === "POST") {
      const body = await readJson(request);
      const words = wordList(body.words, 400, MAX_TTS_CHARS);
      const audioB64 = requiredString(body.audio_base64, "audio_base64", MAX_ALIGN_AUDIO_B64);
      let audio: Uint8Array;
      try {
        audio = base64ToBytes(audioB64);
      } catch {
        throw new ValidationError("Invalid audio_base64: not base64");
      }
      // Alignment is a bonus: any failure (e.g. the Speech-to-Text API not enabled) returns null and the
      // browser keeps its own estimate. The reason is logged for the server owner.
      try {
        return json({ word_times: await services.aligner().align(audio, words) });
      } catch (err) {
        console.warn("Word alignment unavailable:", err instanceof Error ? err.message : err);
        return json({ word_times: null });
      }
    }

    if (path === "/tts/voices" && request.method === "GET") {
      const tts = services.tts();
      const voices = tts.listVoices ? await tts.listVoices() : [];
      return json({ voices, default: settings.googleTtsVoice });
    }

    if (path === "/words/suggest" && request.method === "POST") {
      const body = await readJson(request);
      if (body.category === undefined) throw new ValidationError("Invalid category: required");
      const category = oneOf(body.category, CATEGORY_IDS, "category", CATEGORY_IDS[0]);
      const band = oneOf(body.band, LEVEL_BAND_IDS, "band", "beginner");
      const count = intInRange(body.count, "count", 1, MAX_SUGGESTIONS, 5);
      const exclude = stringList(body.exclude, "exclude", MAX_EXCLUDE, 30);
      const words = await services.wordSuggester().suggest({ category, band, count, exclude });
      const romanized = services.romanizer().romanizeWords(words.map((w) => w.spelling));
      return json({ words: words.map((w, i) => ({ ...w, romanization: romanized[i] ?? "" })) });
    }

    return errorResponse("Not found", 404);
  } catch (err) {
    if (err instanceof ValidationError) return errorResponse(err.message, 422);
    if (err instanceof ServiceError) {
      console.warn("Service error:", err.userMessage);
      return errorResponse(err.userMessage, err.status);
    }
    if (err instanceof UnknownProviderError) return errorResponse(`Server misconfiguration: ${err.message}`, 500);
    console.error("Unexpected error", err);
    return errorResponse("Something went wrong on the server. Please try again.", 500);
  }
}
