/**
 * Per-learner data routes (no accounts: each browser sends its random sync key in X-Sync-Key, and
 * only sees rows saved under that key):
 *   GET    /api/progress              → { progress } (null if nothing saved yet)
 *   PUT    /api/progress { progress } → { progress }  (merged with what was saved; see mergeProgress)
 *   GET    /api/paragraphs            → { paragraphs: [{ id, createdAt, difficulty, length, topic, preview }] }
 *   POST   /api/paragraphs { settings: { difficulty, length, topic }, paragraph } → { saved: { id, … } }
 *   GET    /api/paragraphs/:id        → { saved: { id, … }, settings, paragraph }
 *   DELETE /api/paragraphs/:id        → { deleted: true }
 */
import { BackupError, parseProgress } from "../src/services/progress/backup";
import { mergeProgress } from "../src/services/progress/merge";
import { ServiceError, ValidationError } from "./errors";
import { json, oneOf, optionalString } from "./http";
import { DIFFICULTIES, LENGTHS } from "./services/paragraph";
import type { UserDataStore } from "./services/userData";

export const SYNC_KEY_HEADER = "X-Sync-Key";
const SYNC_KEY = /^[A-Za-z0-9_-]{32,64}$/;
const MAX_BODY_CHARS = 2_000_000; // progress for every word in every mode is well under 1 MB
export const MAX_SAVED_PARAGRAPHS = 300;
const PREVIEW_CHARS = 60;

/** The routes this module handles (also used by the rate limiter). */
export const USER_DATA_PATH = /^\/(progress|paragraphs)(\/[A-Za-z0-9_-]{1,64})?$/;

function ownerOf(request: Request): string {
  const key = request.headers.get(SYNC_KEY_HEADER) ?? "";
  if (!SYNC_KEY.test(key)) throw new ValidationError(`Invalid ${SYNC_KEY_HEADER}: missing or malformed`);
  return key;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) throw new ValidationError("Invalid request: too large");
  try {
    const body = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new ValidationError("Invalid request: expected a JSON object");
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function text(v: unknown, field: string, max: number, required = false): string {
  if (v === undefined || v === null) {
    if (required) throw new ValidationError(`Invalid ${field}: required`);
    return "";
  }
  if (typeof v !== "string" || v.length > max) throw new ValidationError(`Invalid ${field}: text of at most ${max}`);
  if (required && !v.trim()) throw new ValidationError(`Invalid ${field}: required`);
  return v;
}

/** A Reader paragraph (as /api/generate returns it), checked and rebuilt so only known fields are stored. */
function parseParagraph(v: unknown) {
  if (!isObj(v)) throw new ValidationError("Invalid paragraph: expected an object");
  const words = v.words;
  if (!Array.isArray(words) || words.length === 0 || words.length > 800) {
    throw new ValidationError("Invalid paragraph.words: 1 to 800 words");
  }
  const sentences = v.sentences ?? [];
  if (!Array.isArray(sentences) || sentences.length > 200) throw new ValidationError("Invalid paragraph.sentences");
  return {
    paragraph: text(v.paragraph, "paragraph.paragraph", 8000, true),
    translation: text(v.translation, "paragraph.translation", 8000),
    sentences: sentences.map((s, i) => {
      const start = isObj(s) ? s.start : undefined;
      const end = isObj(s) ? s.end : undefined;
      if (!isObj(s) || !Number.isInteger(start) || !Number.isInteger(end)) {
        throw new ValidationError(`Invalid paragraph.sentences[${i}]`);
      }
      const speaker = s.speaker === "A" || s.speaker === "B" ? s.speaker : undefined;
      return {
        english: text(s.english, "sentence.english", 2000),
        start: start as number,
        end: end as number,
        ...(speaker && { speaker }),
      };
    }),
    words: words.map((w, i) => {
      if (!isObj(w)) throw new ValidationError(`Invalid paragraph.words[${i}]`);
      return {
        korean: text(w.korean, "word.korean", 60, true),
        romanized: text(w.romanized, "word.romanized", 120),
        english: text(w.english, "word.english", 200),
      };
    }),
    ...parsePractice(v, words.length),
  };
}

/** Grammar practice parts of a paragraph (highlighted words and the pattern card), if any. */
function parsePractice(v: Record<string, unknown>, wordCount: number) {
  if (!isObj(v.practice)) return {};
  const p = v.practice;
  const pattern = isObj(p.pattern) ? p.pattern : {};
  const examples = Array.isArray(pattern.examples) ? pattern.examples.slice(0, 4) : [];
  const highlights = Array.isArray(v.highlights)
    ? v.highlights.filter((i): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < wordCount)
    : [];
  return {
    highlights,
    practice: {
      pattern: {
        id: text(pattern.id, "practice.pattern.id", 80, true),
        form: text(pattern.form, "practice.pattern.form", 80, true),
        title: text(pattern.title, "practice.pattern.title", 80),
        explain: text(pattern.explain, "practice.pattern.explain", 400),
        sample: {
          ko: text(isObj(pattern.sample) ? pattern.sample.ko : "", "practice.pattern.sample.ko", 60),
          en: text(isObj(pattern.sample) ? pattern.sample.en : "", "practice.pattern.sample.en", 120),
        },
        meaning: text(pattern.meaning, "practice.pattern.meaning", 200),
        level: Number.isInteger(pattern.level) ? pattern.level : 1,
        group: text(pattern.group, "practice.pattern.group", 40),
        register: text(pattern.register, "practice.pattern.register", 20),
        attaches: text(pattern.attaches, "practice.pattern.attaches", 600),
        examples: examples.filter(isObj).map((e) => ({
          ko: text(e.ko, "example.ko", 300),
          en: text(e.en, "example.en", 300),
          part: text(e.part, "example.part", 100),
        })),
        similar: [],
        ...(Array.isArray(pattern.variants) && {
          variants: pattern.variants
            .filter(isObj)
            .slice(0, 8)
            .map((v) => ({ form: text(v.form, "variant.form", 80), title: text(v.title, "variant.title", 80) })),
        }),
        ...(typeof pattern.note === "string" &&
          pattern.note && { note: text(pattern.note, "practice.pattern.note", 400) }),
      },
      setting: text(p.setting, "practice.setting", 120),
      ...(typeof p.scene === "string" && p.scene && { scene: text(p.scene, "practice.scene", 200) }),
      ...(isObj(p.roles) && {
        roles: { A: text(p.roles.A, "practice.roles.A", 40), B: text(p.roles.B, "practice.roles.B", 40) },
      }),
      politeness: text(p.politeness, "practice.politeness", 20),
      format: p.format === "dialogue" ? "dialogue" : "prose",
    },
  };
}

export async function handleUserData(
  request: Request,
  path: string,
  store: () => UserDataStore,
  now: () => number = Date.now,
): Promise<Response | null> {
  const match = USER_DATA_PATH.exec(path);
  if (!match) return null;
  const [, resource, idPart] = match;
  const id = idPart?.slice(1);
  const method = request.method;

  if (resource === "progress" && !id) {
    if (method === "GET") {
      const owner = ownerOf(request);
      const saved = await store().getProgress(owner);
      return json({ progress: saved ? parseProgress(JSON.parse(saved)) : null });
    }
    if (method === "PUT") {
      const owner = ownerOf(request);
      const body = await readBody(request);
      let incoming;
      try {
        incoming = parseProgress(body.progress);
      } catch (err) {
        if (err instanceof BackupError) throw new ValidationError("Invalid progress");
        throw err;
      }
      const data = store();
      const saved = await data.getProgress(owner);
      const merged = saved ? mergeProgress(parseProgress(JSON.parse(saved)), incoming) : incoming;
      await data.putProgress(owner, JSON.stringify(merged), now());
      return json({ progress: merged });
    }
  }

  if (resource === "paragraphs" && !id) {
    if (method === "GET") {
      return json({ paragraphs: await store().listParagraphs(ownerOf(request)) });
    }
    if (method === "POST") {
      const owner = ownerOf(request);
      const body = await readBody(request);
      const settings = isObj(body.settings) ? body.settings : {};
      const paragraph = parseParagraph(body.paragraph);
      const data = store();
      if ((await data.countParagraphs(owner)) >= MAX_SAVED_PARAGRAPHS) {
        throw new ServiceError(
          `You can keep up to ${MAX_SAVED_PARAGRAPHS} paragraphs. Delete some saved ones to make room.`,
          409,
        );
      }
      const saved = {
        id: crypto.randomUUID().replace(/-/g, ""),
        createdAt: now(),
        difficulty: oneOf(settings.difficulty, DIFFICULTIES, "settings.difficulty", "beginner"),
        length: oneOf(settings.length, LENGTHS, "settings.length", "short"),
        topic: optionalString(settings.topic, "settings.topic", 200) ?? "",
        preview: paragraph.paragraph.slice(0, PREVIEW_CHARS),
      };
      await data.addParagraph(owner, { ...saved, data: JSON.stringify(paragraph) });
      return json({ saved }, 201);
    }
  }

  if (resource === "paragraphs" && id) {
    if (method === "GET") {
      const found = await store().getParagraph(ownerOf(request), id);
      if (!found) return json({ detail: "That saved paragraph wasn't found." }, 404);
      const { data, ...saved } = found;
      return json({
        saved,
        settings: { difficulty: saved.difficulty, length: saved.length, topic: saved.topic },
        paragraph: JSON.parse(data),
      });
    }
    if (method === "DELETE") {
      const deleted = await store().deleteParagraph(ownerOf(request), id);
      if (!deleted) return json({ detail: "That saved paragraph wasn't found." }, 404);
      return json({ deleted: true });
    }
  }

  return json({ detail: "Method not allowed" }, 405);
}
