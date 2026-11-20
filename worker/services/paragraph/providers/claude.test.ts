import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { settingsFromEnv } from "../../../config";
import { ServiceError } from "../../../errors";
import { UnknownProviderError } from "../../../registry";
import { paragraphRegistry } from "../index";
import {
  ClaudeParagraphGenerator,
  alignGlosses,
  alignSentences,
  cleanParagraph,
  parseReply,
  type MessagesClient,
} from "./claude";

const KOREAN = "저는 아침마다 공원에서 산책을 해요. 날씨가 좋으면 기분도 좋아요.";
const SENTENCES = [
  { korean: "저는 아침마다 공원에서 산책을 해요.", english: "I take a walk in the park every morning." },
  { korean: "날씨가 좋으면 기분도 좋아요.", english: "When the weather is nice, I feel good too." },
];
const ENGLISH = SENTENCES.map((s) => s.english).join(" ");
const ALIGNED = [
  { english: SENTENCES[0].english, start: 0, end: 5 },
  { english: SENTENCES[1].english, start: 5, end: 9 },
];
const GLOSSES = [
  "I (topic)",
  "every morning",
  "in the park",
  "a walk (object)",
  "do",
  "the weather (subject)",
  "if it's nice",
  "mood too",
  "is good",
];
const WORDS = KOREAN.split(" ").map((word, i) => ({ word, english: GLOSSES[i] }));
const JSON_REPLY = JSON.stringify({ korean: KOREAN, sentences: SENTENCES, words: WORDS });
const EXPECTED = { paragraph: KOREAN, translation: ENGLISH, glosses: GLOSSES, sentences: ALIGNED };
const NO_GLOSSES = GLOSSES.map(() => "");

function fakeResponse(texts: string[], stop_reason = "end_turn") {
  return {
    stop_reason,
    content: [{ type: "thinking", thinking: "" }, ...texts.map((text) => ({ type: "text", text }))],
  };
}

function setup(response: unknown = fakeResponse([JSON_REPLY])) {
  const create = vi.fn().mockResolvedValue(response);
  const client = { messages: { create } } as unknown as MessagesClient;
  return { create, generator: new ClaudeParagraphGenerator(client, "test-model") };
}

describe("ClaudeParagraphGenerator", () => {
  it("returns the Korean paragraph, its translation and a gloss per word", async () => {
    const { generator } = setup();
    expect(await generator.generate("beginner", "short", undefined)).toEqual(EXPECTED);
  });

  it("sends the model, system prompt, level, length and topic", async () => {
    const { create, generator } = setup();
    await generator.generate("advanced", "long", "  우주 여행  ");
    const args = create.mock.calls[0][0];
    expect(args.model).toBe("test-model");
    expect(args.system).toContain("ONLY the Korean paragraph");
    expect(args.output_config.effort).toBe("low");
    expect(args.output_config.format.type).toBe("json_schema");
    expect(args.output_config.format.schema.required).toEqual(["korean", "sentences", "words", "scene", "roles"]);
    const prompt: string = args.messages[0].content;
    expect(prompt).toContain("Advanced");
    expect(prompt).toContain("8-12 sentences");
    expect(prompt).toContain("Topic: 우주 여행");
  });

  it("asks for any topic when none is given", async () => {
    const { create, generator } = setup();
    await generator.generate("intermediate", "medium", "   ");
    expect(create.mock.calls[0][0].messages[0].content).toContain("choose an interesting everyday topic");
  });

  it("joins JSON split across text blocks", async () => {
    const { generator } = setup(fakeResponse([JSON_REPLY.slice(0, 20), JSON_REPLY.slice(20)]));
    expect(await generator.generate("beginner", "short", undefined)).toEqual(EXPECTED);
  });

  it("falls back to plain text with no translations when the reply isn't JSON", async () => {
    const { generator } = setup(
      fakeResponse([`Here is your paragraph:\n\n**${KOREAN}**\n\n(Translation: I take a walk...)`]),
    );
    expect(await generator.generate("beginner", "short", undefined)).toEqual({
      paragraph: KOREAN,
      translation: "",
      glosses: NO_GLOSSES,
      sentences: [],
    });
  });

  it("joins multiple plain-text lines and text blocks", async () => {
    const { generator } = setup(fakeResponse(["저는 학생이에요.\n", "학교에 가요."]));
    expect((await generator.generate("beginner", "short", undefined)).paragraph).toBe("저는 학생이에요. 학교에 가요.");
  });

  it("errors when there's no Korean", async () => {
    const { generator } = setup(fakeResponse(["Sorry, I can't help with that."]));
    await expect(generator.generate("beginner", "short", undefined)).rejects.toBeInstanceOf(ServiceError);
    const emptyJson = setup(fakeResponse([JSON.stringify({ korean: "", sentences: [], words: [] })]));
    await expect(emptyJson.generator.generate("beginner", "short", undefined)).rejects.toBeInstanceOf(ServiceError);
  });

  it("maps a refusal to a friendly 422", async () => {
    const { generator } = setup(fakeResponse([""], "refusal"));
    await expect(generator.generate("beginner", "short", "x")).rejects.toMatchObject({ status: 422 });
  });

  it("maps connection errors to a friendly message", async () => {
    const create = vi.fn().mockRejectedValue(new Anthropic.APIConnectionError({ message: "offline" }));
    const generator = new ClaudeParagraphGenerator({ messages: { create } } as unknown as MessagesClient, "m");
    await expect(generator.generate("beginner", "short", undefined)).rejects.toThrow("Couldn't reach");
  });

  it("removes wrapping quotes", () => {
    expect(cleanParagraph(`“${KOREAN}”`)).toBe(KOREAN);
  });

  it("cleans the Korean field and tidies the translation's whitespace", () => {
    const messy = SENTENCES.map((s) => ({ ...s, english: `  ${s.english}\n ` }));
    expect(parseReply(JSON.stringify({ korean: `“${KOREAN}”`, sentences: messy, words: WORDS }))).toEqual(EXPECTED);
  });
});

describe("alignGlosses", () => {
  const PARAGRAPH = "저는 학생이에요. 학교에 가요.";

  it("matches glosses ignoring punctuation and quotes", () => {
    const entries = [
      { word: "저는", english: "I" },
      { word: "학생이에요", english: "am a student" },
      { word: "“학교에", english: "to school" },
      { word: "가요.", english: " go " },
    ];
    expect(alignGlosses(PARAGRAPH, entries)).toEqual(["I", "am a student", "to school", "go"]);
  });

  it("leaves a word blank when the model skipped it, without shifting later glosses", () => {
    const entries = [
      { word: "저는", english: "I" },
      { word: "학교에", english: "to school" },
      { word: "가요.", english: "go" },
    ];
    expect(alignGlosses(PARAGRAPH, entries)).toEqual(["I", "", "to school", "go"]);
  });

  it("skips extra entries and splits entries covering several words", () => {
    const entries = [
      { word: "저는", english: "I" },
      { word: "음", english: "um" },
      { word: "학생이에요.", english: "am a student" },
      { word: "학교에 가요.", english: "go to school" },
    ];
    expect(alignGlosses(PARAGRAPH, entries)).toEqual(["I", "am a student", "go to school", "go to school"]);
  });

  it("returns blanks when there are no entries", () => {
    expect(alignGlosses(PARAGRAPH, [])).toEqual(["", "", "", ""]);
  });
});

describe("paragraph registry", () => {
  it("requires an API key", () => {
    expect(() => paragraphRegistry.create("claude", settingsFromEnv({}))).toThrow("ANTHROPIC_API_KEY");
  });

  it("builds the Claude generator from settings", () => {
    const g = paragraphRegistry.create("claude", settingsFromEnv({ ANTHROPIC_API_KEY: "sk-test" }));
    expect(g).toBeInstanceOf(ClaudeParagraphGenerator);
  });

  it("rejects unknown providers", () => {
    expect(() => paragraphRegistry.create("nope", settingsFromEnv({}))).toThrow(UnknownProviderError);
  });
});

describe("alignSentences", () => {
  const PARAGRAPH = "저는 학생이에요. 학교에 가요. 친구를 만나요.";
  const en = (n: number) => `Sentence ${n}.`;

  it("maps each sentence to its words", () => {
    const entries = [
      { korean: "저는 학생이에요.", english: en(1) },
      { korean: "학교에 가요.", english: en(2) },
      { korean: "친구를 만나요.", english: en(3) },
    ];
    expect(alignSentences(PARAGRAPH, entries)).toEqual([
      { english: en(1), start: 0, end: 2 },
      { english: en(2), start: 2, end: 4 },
      { english: en(3), start: 4, end: 6 },
    ]);
  });

  it("tolerates small drift and lets the last sentence run to the end", () => {
    const entries = [
      { korean: "저는 학생이에요", english: en(1) }, // missing full stop
      { korean: "학교에", english: en(2) }, // model dropped a word
      { korean: "친구를", english: en(3) },
    ];
    expect(alignSentences(PARAGRAPH, entries)).toEqual([
      { english: en(1), start: 0, end: 2 },
      { english: en(2), start: 2, end: 3 },
      { english: en(3), start: 3, end: 6 },
    ]);
  });

  it("drops empty sentences, and falls back to the old english field", () => {
    expect(alignSentences(PARAGRAPH, [])).toEqual([]);
    const old = parseReply(JSON.stringify({ korean: KOREAN, english: ENGLISH, words: WORDS }));
    expect(old.translation).toBe(ENGLISH);
    expect(old.sentences).toEqual([]);
  });

  it("reads which words use the practised pattern, and dialogue speakers", () => {
    const reply = JSON.stringify({
      korean: "커피 마실까요? 네, 좋아요.",
      sentences: [
        { korean: "커피 마실까요?", english: "Shall we have coffee?", speaker: "A" },
        { korean: "네, 좋아요.", english: "Yes, sounds good.", speaker: "B" },
      ],
      words: [
        { word: "커피", english: "coffee", pattern: false },
        { word: "마실까요?", english: "shall we drink?", pattern: true },
        { word: "네,", english: "yes", pattern: false },
        { word: "좋아요.", english: "good", pattern: false },
      ],
    });
    const result = parseReply(reply);
    expect(result.highlights).toEqual([1]);
    expect(result.sentences.map((s) => s.speaker)).toEqual(["A", "B"]);
  });
});
