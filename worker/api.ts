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
 *   GET  /api/grammar                                     → { patterns, version } grammar patterns for practice
 *   GET  /api/grammar/conversations?pattern=ID            → { pattern, conversations } ready-made practice texts
 *   POST /api/generate also takes grammar?: { pattern, setting?, politeness } (practise one pattern; the reply
 *        then has highlights: [word index] and practice: { pattern, setting, politeness, format })
 *   GET  /api/words                                       → { words, version } the shared Common Words list
 *   /api/progress, /api/paragraphs[/:id]                  → per-learner data (see userDataApi.ts)
 */
import type { Env, Settings } from "./config";
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
import { D1UserDataStore, type UserDataStore } from "./services/userData";
import { D1WordStore, type WordStore } from "./services/words";
import { D1GrammarStore, type GrammarStore } from "./services/grammar";
import { POLITENESS_IDS, PRACTICE_SETTINGS, type GrammarPattern, type Scenario } from "../src/data/grammarMeta";
import SCENARIOS from "../data/scenarios.json";
import { wordSuggesterRegistry, type WordSuggester } from "./services/wordSuggester";
import { handleUserData } from "./userDataApi";

/** Services can be injected (tests); otherwise they're created from settings on first use. */
export interface Services {
  paragraph: () => ParagraphGenerator;
  romanizer: () => Romanizer;
  tts: () => TtsService;
  wordSuggester: () => WordSuggester;
  aligner: () => WordAligner;
  userData: () => UserDataStore;
  words: () => WordStore;
  grammar: () => GrammarStore;
}

export function servicesFromSettings(settings: Settings, env: Pick<Env, "DB"> = {}): Services {
  return {
    userData: () => {
      if (!env.DB) throw new ServiceError("Saving isn't set up on this server (no database).", 503);
      return new D1UserDataStore(env.DB);
    },
    words: () => {
      if (!env.DB) throw new ServiceError("The word list isn't set up on this server (no database).", 503);
      return new D1WordStore(env.DB);
    },
    grammar: () => {
      if (!env.DB) throw new ServiceError("Grammar practice isn't set up on this server (no database).", 503);
      return new D1GrammarStore(env.DB);
    },
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
const MAX_EXCLUDE = 8000; // the whole word list plus plenty of added words

/** Grammar practice in a /generate request: the pattern (from the database), setting and politeness. */
async function readPractice(raw: unknown, services: Services) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new ValidationError("Invalid grammar: expected an object");
  const g = raw as Record<string, unknown>;
  const id = requiredString(g.pattern, "grammar.pattern", 80);
  let politeness = oneOf(g.politeness, POLITENESS_IDS, "grammar.politeness", "polite");
  const pattern = await services.grammar().get(id);
  if (!pattern) throw new ValidationError("Invalid grammar.pattern: unknown pattern");
  // A speech level the pattern isn't used at (e.g. casual for -아/어 주시겠어요?) becomes one it is.
  const allowed = pattern.speechLevels ?? POLITENESS_IDS;
  if (!allowed.includes(politeness)) politeness = allowed.includes("polite") ? "polite" : allowed[0];
  // Your own situation as typed (Claude decides who's talking); none: a real scenario from the library that
  // suits this pattern and speech level.
  const custom = optionalString(g.setting, "grammar.setting", 120)?.trim() || undefined;
  let setting = custom;
  let scene: string | undefined;
  if (!custom) {
    const fits = (SCENARIOS as Scenario[]).filter((s) => s.politeness.includes(politeness));
    const best = fits.filter((s) => s.functions.includes(pattern.group));
    const pool = best.length ? best : fits;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) {
      setting = PRACTICE_SETTINGS.find((s) => s.id === pick.setting)?.label;
      scene = `${pick.situation} A is the ${pick.roles.A}; B is the ${pick.roles.B}.`;
    }
  }
  // Written patterns (-(으)므로, -(으)며…) get prose; everything else a dialogue.
  const format: "dialogue" | "prose" = pattern.register === "written" ? "prose" : "dialogue";
  return { pattern, request: { pattern, setting, scene, politeness, format } };
}

/** The paragraph's level follows the pattern's: TOPIK 1-2 beginner, 3-4 intermediate, 5-6 advanced. */
const difficultyFor = (p: GrammarPattern) => (p.level <= 2 ? "beginner" : p.level <= 4 ? "intermediate" : "advanced");

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
      const practice = await readPractice(body.grammar, services);
      const { paragraph, translation, glosses, sentences, highlights, scene, roles } = await services
        .paragraph()
        .generate(practice ? difficultyFor(practice.pattern) : difficulty, length, topic, practice?.request);
      const words = paragraph.split(/\s+/).filter(Boolean);
      const romanized = services.romanizer().romanizeWords(words);
      return json({
        paragraph,
        translation,
        sentences,
        words: words.map((korean, i) => ({ korean, romanized: romanized[i] ?? "", english: glosses[i] ?? "" })),
        ...(practice && {
          highlights: (highlights ?? []).filter((i) => i >= 0 && i < words.length),
          practice: {
            pattern: practice.pattern,
            setting: practice.request.setting ?? "",
            ...(scene && { scene }),
            ...(roles && { roles }),
            politeness: practice.request.politeness,
            format: practice.request.format,
          },
        }),
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

    if (path === "/grammar/conversations" && request.method === "GET") {
      const id = requiredString(new URL(request.url).searchParams.get("pattern") ?? undefined, "pattern", 80);
      const grammar = services.grammar();
      const pattern = await grammar.get(id); // an old (merged) id finds its family
      if (!pattern) return errorResponse("That grammar pattern wasn't found.", 404);
      const res = json({ pattern: pattern.id, conversations: await grammar.conversations(pattern.id) });
      res.headers.set("Cache-Control", "public, max-age=300");
      return res;
    }

    if (path === "/grammar" && request.method === "GET") {
      const { patterns, version } = await services.grammar().list();
      const etag = `"${version}"`;
      const headers = { ETag: etag, "Cache-Control": "public, max-age=300" };
      if (request.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers });
      const res = json({ patterns, version });
      Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    if (path === "/words" && request.method === "GET") {
      const { words, version } = await services.words().list();
      const etag = `"${version}"`;
      const headers = { ETag: etag, "Cache-Control": "public, max-age=300" };
      // Unchanged since the browser's copy: nothing to send.
      if (request.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers });
      const res = json({ words, version });
      Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
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

    const userData = await handleUserData(request, path, services.userData);
    if (userData) return userData;

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
