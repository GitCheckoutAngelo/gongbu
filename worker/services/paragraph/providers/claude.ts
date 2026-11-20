/** Paragraph generation with Claude via the official Anthropic TypeScript SDK. */
import Anthropic from "@anthropic-ai/sdk";
import type { Settings } from "../../../config";
import { ServiceError } from "../../../errors";
import { anthropicServiceError, missingAnthropicKey } from "../../anthropicErrors";
import {
  DIFFICULTIES,
  LENGTHS,
  paragraphRegistry,
  type Difficulty,
  type GeneratedParagraph,
  type GrammarPractice,
  type SentenceTranslation,
  type Length,
  type ParagraphGenerator,
} from "../types";

const DIFFICULTY_GUIDANCE: Record<Difficulty, string> = {
  beginner:
    "Beginner (TOPIK 1): very common everyday vocabulary, short simple sentences, present and simple past tense, polite 해요체 endings.",
  intermediate:
    "Intermediate (TOPIK 3-4): broader everyday and social vocabulary, compound sentences with common connectives (-고, -지만, -아서/어서, -(으)면, -는데), a mix of tenses.",
  advanced:
    "Advanced (TOPIK 5-6): rich vocabulary including Sino-Korean and abstract terms, complex sentences, written style (-다 endings) and nuanced grammar.",
};

const LENGTH_GUIDANCE: Record<Length, string> = {
  short: "2-3 sentences",
  medium: "4-6 sentences",
  long: "8-12 sentences",
};

export const SYSTEM_PROMPT =
  "You write Korean reading-practice paragraphs for language learners. " +
  'Reply in JSON. "korean" holds ONLY the Korean paragraph itself (no title, no romanization, ' +
  'no notes, no quotation marks, no markdown). "sentences" lists every sentence of the paragraph, in order, ' +
  "each exactly as written in the paragraph, with a faithful English translation of that one sentence " +
  "(translate each sentence on its own, so every Korean sentence has its own English sentence). " +
  '"words" lists every space-separated word of the paragraph, in order, exactly as written (punctuation included), ' +
  "each with a short English gloss of its meaning in this sentence, including what its particles or endings add " +
  '(e.g. 학교에 → "to school", 먹었어요 → "ate"). ' +
  "Use natural, standard Korean spacing (띄어쓰기) and punctuation, and write the Korean as one paragraph. " +
  'For grammar practice, mark each word that contains the practised pattern with "pattern": true (otherwise false). ' +
  'For a dialogue, "korean" is the lines in order without speaker labels, and each sentence gets "speaker" ' +
  '"A" or "B"; otherwise "speaker" is "".';

/** Structured output: the Korean paragraph, its translation sentence by sentence, and a gloss per word. */
export const OUTPUT_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      korean: { type: "string", description: "The Korean paragraph only." },
      scene: { type: "string", description: "Grammar practice: the scene in one English line (else empty)." },
      roles: {
        type: "object",
        description: "Grammar practice dialogues: who A and B are (else empty strings).",
        properties: { A: { type: "string" }, B: { type: "string" } },
        required: ["A", "B"],
        additionalProperties: false,
      },
      sentences: {
        type: "array",
        description: "Every sentence of the paragraph, in order, each with its own English translation.",
        items: {
          type: "object",
          properties: {
            korean: { type: "string", description: "The sentence exactly as it appears in the paragraph." },
            english: { type: "string", description: "A faithful English translation of this sentence only." },
            speaker: { type: "string", enum: ["A", "B", ""], description: "Dialogue speaker, or empty." },
          },
          required: ["korean", "english", "speaker"],
          additionalProperties: false,
        },
      },
      words: {
        type: "array",
        description: "Every space-separated word of the paragraph, in order.",
        items: {
          type: "object",
          properties: {
            word: { type: "string", description: "The word exactly as it appears in the paragraph." },
            english: { type: "string", description: "Short English gloss of the word in context (1-5 words)." },
            pattern: { type: "boolean", description: "True if this word contains the practised grammar pattern." },
          },
          required: ["word", "english", "pattern"],
          additionalProperties: false,
        },
      },
    },
    required: ["korean", "sentences", "words", "scene", "roles"],
    additionalProperties: false,
  },
} as const;

const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;
const MAX_TOPIC_CHARS = 200;

const POLITENESS_GUIDANCE = {
  casual: "casual speech (반말), as between close friends",
  polite: "polite everyday speech (해요체)",
  formal: "formal speech (합쇼체/하십시오체), as with a boss or in an announcement",
} as const;

/** How many times to use the practised pattern, by length. */
const PATTERN_USES: Record<Length, string> = { short: "at least 2", medium: "3-4", long: "5-6" };

export function buildUserPrompt(
  difficulty: Difficulty,
  length: Length,
  topic: string | undefined,
  practice?: GrammarPractice,
): string {
  if (practice) {
    const { pattern, setting, scene, politeness, format } = practice;
    const where = scene
      ? `Scene: ${scene}`
      : setting?.trim()
        ? `Setting: ${setting.trim()}. Decide who A and B are so the scene and the speech level below are natural.`
        : "Setting: choose an everyday scene where this pattern is genuinely useful, and decide who A and B are.";
    return [
      format === "dialogue"
        ? "Write a short dialogue in Korean between two people, A and B."
        : "Write one short piece of Korean prose that fits the scene: a diary entry, a message or a notice.",
      where,
      `Speech level: ${POLITENESS_GUIDANCE[politeness]}. Write every line at this level, and adapt the pattern's ` +
        "ending to it: the pattern is shown in its textbook (polite) form, so at casual level -(으)ㄹ까요? becomes " +
        "-(으)ㄹ까?, -아/어 주세요 becomes -아/어 줘, -는데요 becomes -는데; at formal level use 합쇼체 endings.",
      `Grammar focus: ${pattern.form}, ${pattern.meaning}. How it attaches: ${pattern.attaches}`,
      pattern.variants?.length
        ? `Its variants also count as uses: ${pattern.variants.map((v) => v.form).join(", ")}.`
        : "",
      "",
      "Make it sound like real Korean speakers in exactly this situation:",
      "- every line makes sense for who is speaking, to whom, and what is happening; the conversation has a",
      "  natural flow (a reason to talk, a reply that answers, a small outcome);",
      `- use the pattern where a native speaker naturally would, ${PATTERN_USES[length]} times, with different`,
      "  verbs or nouns; never force it into a line where it sounds odd (fewer natural uses beat more forced",
      "  ones, but use it at least twice);",
      "- some patterns belong to one speech level (e.g. -아/어 주시겠어요? is always polite, -자 is casual):",
      "  give such a pattern only to a speaker for whom it is natural in this scene, never e.g. 주시겠어요 between",
      "  close friends;",
      "- names, places and details fit the scene; no textbook-style filler.",
      `Level: ${DIFFICULTY_GUIDANCE[difficulty]}`,
      `Length: ${LENGTH_GUIDANCE[length]}.`,
      topic?.trim() ? `Also about: ${topic.trim()}` : "",
      "",
      'Also return "scene": the scene in one short English line, and "roles": who A and B are in 1-3 English',
      'words each (e.g. A "customer", B "barista"); for prose, A is the writer and B is "".',
    ]
      .filter((line, i, all) => line !== "" || (all[i - 1] ?? "") !== "")
      .join("\n");
  }
  const topicLine = topic?.trim() ? `Topic: ${topic.trim()}` : "Topic: choose an interesting everyday topic.";
  return `Write one Korean paragraph.\nLevel: ${DIFFICULTY_GUIDANCE[difficulty]}\nLength: ${LENGTH_GUIDANCE[length]}.\n${topicLine}`;
}

/**
 * Keep only lines that contain Hangul and join them into one paragraph. Drops stray English
 * preambles ("Here is your paragraph:"), trailing notes or translations, markdown and wrapping quotes.
 */
export function cleanParagraph(text: string): string {
  const koreanLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => HANGUL.test(l));
  return koreanLines
    .join(" ")
    .replace(/^#+\s*/, "")
    .replaceAll("**", "")
    .replaceAll("__", "")
    .trim()
    .replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

const tidy = (s: string) => s.trim().replace(/\s+/g, " ");
/** Compare words ignoring punctuation and quotes. */
const normalize = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "");
/** How far ahead to look for a gloss when the model's word list drifts from the paragraph. */
const ALIGN_LOOKAHEAD = 3;

/**
 * Match the model's `{ word, english }` list to the paragraph's space-separated words, in order.
 * A word with no matching entry gets "", so one mismatch doesn't shift every later gloss.
 */
export function alignGlosses(paragraph: string, entries: { word: string; english: string }[]): string[] {
  // An entry covering several words ("학교에 가요") glosses each of them.
  const pieces = entries.flatMap((e) =>
    e.word
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => ({ key: normalize(w), english: tidy(e.english) })),
  );
  let next = 0;
  return paragraph
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const key = normalize(token);
      for (let j = next; j < Math.min(pieces.length, next + ALIGN_LOOKAHEAD); j++) {
        if (pieces[j].key === key) {
          next = j + 1;
          return pieces[j].english;
        }
      }
      return "";
    });
}

function readEntries(value: unknown): { word: string; english: string; pattern?: boolean }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((e) =>
    e && typeof e.word === "string" && typeof e.english === "string"
      ? [{ word: e.word, english: e.english, pattern: e.pattern === true }]
      : [],
  );
}

/**
 * Grammar practice: the paragraph's word indices marked as using the pattern. Matched like the glosses
 * (alignGlosses): each marked entry's word is found in order, so one mismatch doesn't shift the rest.
 */
export function alignHighlights(paragraph: string, entries: { word: string; pattern?: boolean }[]): number[] {
  const marks = alignGlosses(
    paragraph,
    entries.map((e) => ({ word: e.word, english: e.pattern ? "1" : "" })),
  );
  return marks.flatMap((m, i) => (m === "1" ? [i] : []));
}

/**
 * Read the structured `{ korean, english, words }` reply. Falls back to treating the whole reply as
 * the Korean paragraph (with no translations) if it isn't valid JSON.
 */
/**
 * Map each translated sentence onto the paragraph's space-separated words, in order: a sentence covers
 * as many words as it has, matched loosely (punctuation ignored) with a little lookahead for drift.
 * The last sentence runs to the end of the paragraph. Sentences that end up empty are dropped.
 */
export function alignSentences(
  paragraph: string,
  entries: { korean: string; english: string; speaker?: string }[],
): SentenceTranslation[] {
  const tokens = paragraph.split(/\s+/).filter(Boolean).map(normalize);
  const out: SentenceTranslation[] = [];
  let p = 0;
  entries.forEach((entry, n) => {
    const start = p;
    for (const t of entry.korean.split(/\s+/).filter(Boolean).map(normalize)) {
      if (p >= tokens.length) break;
      if (tokens[p] === t) {
        p++;
        continue;
      }
      const ahead = tokens.slice(p + 1, p + 1 + ALIGN_LOOKAHEAD).indexOf(t);
      p = ahead >= 0 ? p + 2 + ahead : p + 1;
    }
    const end = n === entries.length - 1 ? tokens.length : p;
    const english = tidy(entry.english);
    const speaker = entry.speaker === "A" || entry.speaker === "B" ? entry.speaker : undefined;
    if (end > start && english) out.push({ english, start, end, ...(speaker && { speaker }) });
  });
  return out;
}

function readSentences(value: unknown): { korean: string; english: string; speaker?: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((e) =>
    e && typeof e.korean === "string" && typeof e.english === "string"
      ? [{ korean: e.korean, english: e.english, speaker: typeof e.speaker === "string" ? e.speaker : undefined }]
      : [],
  );
}

export function parseReply(raw: string): GeneratedParagraph {
  try {
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === "object") {
      const { korean, sentences, english, words, scene, roles } = data as {
        scene?: unknown;
        roles?: { A?: unknown; B?: unknown };
        korean?: unknown;
        sentences?: unknown;
        english?: unknown;
        words?: unknown;
      };
      if (typeof korean === "string") {
        const paragraph = cleanParagraph(korean);
        const aligned = alignSentences(paragraph, readSentences(sentences));
        // The translation is the sentences joined; an older-style "english" field is the fallback.
        const translation = aligned.length
          ? aligned.map((s) => s.english).join(" ")
          : typeof english === "string"
            ? tidy(english)
            : "";
        const entries = readEntries(words);
        const highlights = alignHighlights(paragraph, entries);
        return {
          paragraph,
          translation,
          glosses: alignGlosses(paragraph, entries),
          sentences: aligned,
          ...(highlights.length && { highlights }),
          ...(typeof scene === "string" && scene.trim() && { scene: tidy(scene).slice(0, 200) }),
          ...(roles &&
            typeof roles.A === "string" &&
            roles.A.trim() && {
              roles: {
                A: tidy(roles.A).slice(0, 40),
                B: typeof roles.B === "string" ? tidy(roles.B).slice(0, 40) : "",
              },
            }),
        };
      }
    }
  } catch {
    // Not JSON: fall through.
  }
  const paragraph = cleanParagraph(raw);
  return {
    paragraph,
    translation: "",
    glosses: paragraph
      .split(/\s+/)
      .filter(Boolean)
      .map(() => ""),
    sentences: [],
  };
}

/** The part of the Anthropic client this generator uses (so tests can pass a mock). */
export type MessagesClient = Pick<Anthropic, "messages">;

export class ClaudeParagraphGenerator implements ParagraphGenerator {
  constructor(
    private readonly client: MessagesClient,
    private readonly model: string,
    private readonly maxTokens = 16000,
  ) {}

  static fromSettings(settings: Settings): ClaudeParagraphGenerator {
    if (!settings.anthropicApiKey) throw missingAnthropicKey();
    return new ClaudeParagraphGenerator(new Anthropic({ apiKey: settings.anthropicApiKey }), settings.anthropicModel);
  }

  async generate(
    difficulty: Difficulty,
    length: Length,
    topic: string | undefined,
    practice?: GrammarPractice,
  ): Promise<GeneratedParagraph> {
    if (!DIFFICULTIES.includes(difficulty)) throw new Error(`difficulty must be one of ${DIFFICULTIES.join(", ")}`);
    if (!LENGTHS.includes(length)) throw new Error(`length must be one of ${LENGTHS.join(", ")}`);
    const cleanTopic = topic?.trim().slice(0, MAX_TOPIC_CHARS) || undefined;

    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: SYSTEM_PROMPT,
        // Short creative task: low effort keeps latency and cost down.
        // Grammar practice needs a natural scene and correct use of the pattern: think a little more.
        output_config: { effort: practice ? "medium" : "low", format: OUTPUT_FORMAT },
        messages: [{ role: "user", content: buildUserPrompt(difficulty, length, cleanTopic, practice) }],
      });
    } catch (err) {
      throw anthropicServiceError(err, "paragraph");
    }

    if (response.stop_reason === "refusal") {
      throw new ServiceError("That topic couldn't be used. Try a different topic.", 422);
    }
    const raw = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const result = parseReply(raw);
    if (!result.paragraph) throw new ServiceError("The generated text didn't contain Korean. Please try again.");
    return result;
  }
}

paragraphRegistry.register("claude", (settings) => ClaudeParagraphGenerator.fromSettings(settings));
