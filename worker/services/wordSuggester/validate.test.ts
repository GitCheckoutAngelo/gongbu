import { describe, expect, it } from "vitest";
import { validateSuggestion, validateSuggestions } from "./validate";

const good = {
  spelling: "학교",
  meaning: "school",
  pos: "noun",
  level: 1,
  pronounced: "학꾜",
  rules: ["tensification"],
  letters: [],
  note: "",
};

describe("validateSuggestion", () => {
  it("keeps a well-formed word", () => {
    expect(validateSuggestion(good)).toEqual({ ...good, note: undefined });
  });

  it("drops non-Hangul spellings, unknown parts of speech, and empty meanings", () => {
    expect(validateSuggestion({ ...good, spelling: "hakgyo" })).toBeNull();
    expect(validateSuggestion({ ...good, spelling: "학교!" })).toBeNull();
    expect(validateSuggestion({ ...good, pos: "particle" })).toBeNull();
    expect(validateSuggestion({ ...good, meaning: " " })).toBeNull();
    expect(validateSuggestion({ ...good, pronounced: "hak-kkyo" })).toBeNull();
  });

  it("drops a pronunciation that repeats the spelling, and its rule links", () => {
    expect(validateSuggestion({ ...good, pronounced: "학교", rules: ["tensification"] })).toMatchObject({
      pronounced: undefined,
      rules: [],
    });
  });

  it("keeps allowed alternatives and filters unknown rule/letter ids", () => {
    const w = validateSuggestion({ ...good, spelling: "시계", pronounced: "시계 / 시게", rules: ["made-up"], letters: ["ye", "zz"] });
    expect(w).toMatchObject({ pronounced: "시계/시게", rules: [], letters: ["ye"] });
  });

  it("keeps the level inside the requested band", () => {
    expect(validateSuggestion({ ...good, level: 5 })?.level).toBe(2); // beginner by default
    expect(validateSuggestion({ ...good, level: 4 }, "intermediate")?.level).toBe(4);
    expect(validateSuggestion({ ...good, level: 2 }, "intermediate")?.level).toBe(3);
    expect(validateSuggestion({ ...good, level: 6 }, "intermediate")?.level).toBe(4);
    expect(validateSuggestion({ ...good, level: "x" }, "advanced")?.level).toBe(6);
  });
});

describe("validateSuggestions", () => {
  it("drops excluded words and duplicates, and caps the count", () => {
    const list = [good, { ...good }, { ...good, spelling: "밥", pronounced: "" }, { ...good, spelling: "물", pronounced: "" }];
    expect(validateSuggestions(list, ["밥"], 5).map((w) => w.spelling)).toEqual(["학교", "물"]);
    expect(validateSuggestions(list, [], 1)).toHaveLength(1);
    expect(validateSuggestions("nope", [], 5)).toEqual([]);
  });
});
