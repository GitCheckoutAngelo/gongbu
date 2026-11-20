import { describe, expect, it } from "vitest";
import { detect, mainSense, pronunciationProblems, untense } from "./pronunciationCheck";

describe("pronunciation detector", () => {
  it.each([
    ["학교", ["tensification"]],
    ["음악", ["linking"]],
    ["좋다", ["aspiration"]],
    ["많이", ["h-dropping"]],
    ["같이", ["palatalization"]],
    ["많다", ["aspiration"]],
    ["국물", ["nasalization"]],
    ["연락", ["liquidization"]],
    ["값", ["double-finals"]],
    ["옷", ["final-sounds"]],
    ["희망", ["ui"]],
    ["시계", ["ye"]],
    ["사람", []],
  ])("%s → %j", (word, ids) => {
    expect([...detect(word).must].sort()).toEqual([...ids].sort());
  });

  it("marks possible-but-unpredictable tensification", () => {
    expect(detect("신다")).toEqual({ must: new Set(), may: true });
  });

  it("undoes tensification only where the spelling is lax", () => {
    expect(untense("학꾜", "학교")).toBe("학교");
    expect(untense("색깔", "색깔")).toBe("색깔");
  });
});

describe("pronunciation problems", () => {
  it("accepts a correct entry", () => {
    expect(
      pronunciationProblems({ id: "학교", spelling: "학교", pronounced: "학꾜", rules: ["tensification"] }),
    ).toEqual([]);
  });

  it("catches a missing pronunciation, a missing rule, and a wrong pronunciation", () => {
    expect(pronunciationProblems({ id: "음악", spelling: "음악" })).toContain("missing pronunciation (linking)");
    expect(pronunciationProblems({ id: "국물", spelling: "국물", pronounced: "궁물", rules: ["linking"] })).toContain(
      "should link nasalization",
    );
    expect(
      pronunciationProblems({ id: "죽음", spelling: "죽음", pronounced: "주검", rules: ["linking"] }),
    ).toHaveLength(1);
  });
});

describe("main sense", () => {
  it("is the first gloss without hints or 'to'", () => {
    expect(mainSense("really; truly (emphatic)")).toBe("really");
    expect(mainSense("to be thankful (native Korean word)")).toBe("be thankful");
  });
});
