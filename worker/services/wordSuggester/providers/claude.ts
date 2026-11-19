/** Word suggestions with Claude via the official Anthropic TypeScript SDK (structured JSON output). */
import Anthropic from "@anthropic-ai/sdk";
import type { Settings } from "../../../config";
import { ServiceError } from "../../../errors";
import {
  CATEGORIES,
  LEVEL_BANDS,
  LETTER_NOTES,
  LETTER_NOTE_IDS,
  PARTS_OF_SPEECH,
  PART_OF_SPEECH_IDS,
  RULE_IDS_FOR_WORDS,
  RULE_SUMMARIES,
} from "../../../../src/data/vocabularyMeta";
import { anthropicServiceError, missingAnthropicKey } from "../../anthropicErrors";
import { wordSuggesterRegistry, type SuggestRequest, type SuggestedWord, type WordSuggester } from "../types";
import { validateSuggestions } from "../validate";

export const SYSTEM_PROMPT = [
  "You suggest high-frequency Korean vocabulary at a requested TOPIK level band for a learner's flashcards.",
  "Accuracy matters more than anything: the learner memorizes exactly what you write.",
  "Rules for every word:",
  "- spelling: standard Korean in Hangul. Verbs and adjectives in dictionary form (먹다, 크다).",
  "- level: the TOPIK level (1-6) a learner typically meets the word at, within the requested band.",
  '- meaning: concise English. Verbs start with "to"; adjectives with "to be" (크다 → "to be big").',
  "  If a common synonym exists, add a short hint so the English points to one Korean word.",
  "- pronounced: the standard pronunciation (표준 발음법) in Hangul, ONLY if it differs from the spelling;",
  '  otherwise "". Separate allowed alternatives with "/" (시계 → "시계/시게"). Omit long-vowel marks.',
  "  Include linking (음악 → 으막), tensification (학교 → 학꾜, 먹다 → 먹따), nasalization, aspiration, etc.",
  "- rules: ids of the pronunciation rules that explain the difference (empty if pronounced is empty).",
  "- letters: ids of letter notes that explain a vowel difference (empty if none).",
  "- note: anything uncertain (e.g. disputed pronunciation or level), otherwise \"\".",
  "Suggest only words you are confident about. Never repeat a word from the exclusion list.",
].join("\n");

const OUTPUT_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      words: {
        type: "array",
        items: {
          type: "object",
          properties: {
            spelling: { type: "string" },
            meaning: { type: "string" },
            pos: { type: "string", enum: PART_OF_SPEECH_IDS },
            level: { type: "integer", enum: [1, 2, 3, 4, 5, 6] },
            pronounced: { type: "string" },
            rules: { type: "array", items: { type: "string", enum: RULE_IDS_FOR_WORDS } },
            letters: { type: "array", items: { type: "string", enum: LETTER_NOTE_IDS } },
            note: { type: "string" },
          },
          required: ["spelling", "meaning", "pos", "level", "pronounced", "rules", "letters", "note"],
          additionalProperties: false,
        },
      },
    },
    required: ["words"],
    additionalProperties: false,
  },
} as const;

export function buildUserPrompt({ category, band, count, exclude }: SuggestRequest): string {
  const label = CATEGORIES.find((c) => c.id === category)?.label ?? category;
  const b = LEVEL_BANDS.find((x) => x.id === band) ?? LEVEL_BANDS[0];
  return [
    `Suggest ${count} words for the category "${label}" at ${b.label.toLowerCase()} level ` +
      `(TOPIK ${b.levels[0]}-${b.levels[b.levels.length - 1]}).`,
    "",
    "Parts of speech: " + PARTS_OF_SPEECH.map((p) => `${p.id} (${p.label})`).join(", "),
    "Rule ids: " + RULE_IDS_FOR_WORDS.map((id) => `${id} = ${RULE_SUMMARIES[id]}`).join("; "),
    "Letter note ids: " + LETTER_NOTE_IDS.map((id) => `${id} = ${LETTER_NOTES[id].summary}`).join("; "),
    "",
    `Already in the list (do not suggest): ${exclude.join(", ") || "(none)"}`,
  ].join("\n");
}

/** The part of the Anthropic client this provider uses (so tests can pass a mock). */
export type MessagesClient = Pick<Anthropic, "messages">;

export class ClaudeWordSuggester implements WordSuggester {
  constructor(
    private readonly client: MessagesClient,
    private readonly model: string,
    private readonly maxTokens = 4096,
  ) {}

  static fromSettings(settings: Settings): ClaudeWordSuggester {
    if (!settings.anthropicApiKey) throw missingAnthropicKey();
    return new ClaudeWordSuggester(new Anthropic({ apiKey: settings.anthropicApiKey }), settings.anthropicModel);
  }

  async suggest(request: SuggestRequest): Promise<SuggestedWord[]> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: SYSTEM_PROMPT,
        // Accuracy matters here (pronunciations get memorized), so think a bit more than for paragraphs.
        output_config: { effort: "medium", format: OUTPUT_FORMAT },
        messages: [{ role: "user", content: buildUserPrompt(request) }],
      });
    } catch (err) {
      throw anthropicServiceError(err, "word suggestion");
    }
    if (response.stop_reason === "refusal") {
      throw new ServiceError("That request couldn't be completed. Try a different category.", 422);
    }
    const raw = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ServiceError("The word service returned an unreadable reply. Please try again.");
    }
    const words = validateSuggestions((data as { words?: unknown })?.words, request.exclude, request.count, request.band);
    if (words.length === 0) throw new ServiceError("No new words came back. Please try again.");
    return words;
  }
}

wordSuggesterRegistry.register("claude", (settings) => ClaudeWordSuggester.fromSettings(settings));
