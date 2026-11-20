import { describe, expect, it } from "vitest";
import type { CommonWord } from "../../data/vocabularyMeta";
import { emptyProgress, type Progress } from "../progress/types";
import { addDays, daysBetween, localDate } from "./dates";
import { getScheduler, listSchedulers } from "./registry";
import { MIN_EASE, START_EASE, sm2 } from "./schedulers/sm2";
import { applyGrade, buildSession, cardKey, isMistake, requeue, summarize, type SessionCard } from "./session";
import type { CardState, Grade } from "./types";

const TODAY = "2026-03-10";

function word(id: string, category: CommonWord["category"] = "food"): CommonWord {
  return { id, spelling: id, meaning: `meaning of ${id}`, pos: "noun", category, level: 1, romanization: "", source: "built-in" };
}

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-03-01", "2026-03-11")).toBe(10);
    expect(localDate(new Date(2026, 2, 5))).toBe("2026-03-05");
  });
});

describe("SM-2", () => {
  const run = (grades: Grade[]) => {
    let s: CardState | undefined;
    let day = TODAY;
    for (const g of grades) {
      s = sm2.review(s, g, day);
      day = s.due;
    }
    return s!;
  };

  it("is the default scheduler", () => {
    expect(getScheduler().id).toBe("sm2");
    expect(listSchedulers().map((s) => s.id)).toContain("sm2");
  });

  it("follows 1 day, 6 days, then × ease for Good", () => {
    expect(run(["good"])).toMatchObject({ interval: 1, due: "2026-03-11", reps: 1, ease: START_EASE });
    expect(run(["good", "good"]).interval).toBe(6);
    expect(run(["good", "good", "good"]).interval).toBe(15); // 6 × 2.5
  });

  it("orders intervals Hard < Good < Easy after the first reviews", () => {
    const base = run(["good", "good"]);
    const [hard, good, easy] = (["hard", "good", "easy"] as Grade[]).map((g) => sm2.review(base, g, TODAY).interval);
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);
    expect(sm2.review(undefined, "easy", TODAY).interval).toBe(4);
  });

  it("resets on Again, counts a lapse only for learned cards, and lowers ease to a floor", () => {
    const learned = run(["good", "good"]);
    const forgot = sm2.review(learned, "again", TODAY);
    expect(forgot).toMatchObject({ interval: 0, reps: 0, lapses: 1, due: TODAY, streak: 0, everWrong: true });
    expect(sm2.review(undefined, "again", TODAY).lapses).toBe(0);
    let s = learned;
    for (let i = 0; i < 20; i++) s = sm2.review(s, "again", TODAY);
    expect(s.ease).toBe(MIN_EASE);
  });
});

describe("sessions", () => {
  const words = [word("a"), word("b"), word("c"), word("d", "time")];
  const progressWith = (cards: Record<string, Partial<CardState>>, settings = {}): Progress => {
    const p = emptyProgress();
    p.settings = { ...p.settings, ...settings };
    for (const [id, c] of Object.entries(cards)) p.cards[cardKey(id, "read")] = { ...sm2.review(undefined, "good", TODAY), ...c };
    return p;
  };

  it("puts due reviews first (oldest first), then new words up to the daily limit", () => {
    const p = progressWith({ a: { due: TODAY }, b: { due: "2026-03-01" }, c: { due: "2026-04-01" } }, { newPerDay: 5 });
    const s = buildSession(words, p, { mode: "read", today: TODAY });
    expect(s.map((c) => [c.word.id, c.isNew])).toEqual([
      ["b", false],
      ["a", false],
      ["d", true],
    ]);
  });

  it("keeps schedules separate per mode", () => {
    const p = progressWith({ a: { due: TODAY } });
    expect(buildSession(words, p, { mode: "recall", today: TODAY }).every((c) => c.isNew)).toBe(true);
  });

  it("filters by category and respects new words already started today", () => {
    const p = emptyProgress();
    p.settings.newPerDay = 2;
    p.newToday = { date: TODAY, counts: { read: 1 } };
    expect(buildSession(words, p, { mode: "read", today: TODAY })).toHaveLength(1);
    expect(buildSession(words, p, { mode: "read", today: TODAY, category: "time" }).map((c) => c.word.id)).toEqual(["d"]);
    // A new day resets the count.
    expect(buildSession(words, p, { mode: "read", today: "2026-03-11" })).toHaveLength(2);
  });

  it("drills only mistakes when asked, due or not", () => {
    const p = progressWith({ a: { everWrong: true, streak: 0, due: "2026-05-01" }, b: { everWrong: true, streak: 2 } });
    const s = buildSession(words, p, { mode: "read", today: TODAY, mistakesOnly: true });
    expect(s.map((c) => [c.word.id, c.early])).toEqual([["a", true]]);
  });

  it("applies grades, counting new words once and clearing mistakes after two right in a row", () => {
    let p = emptyProgress();
    const card: SessionCard = { word: words[0], isNew: true, early: false };
    p = applyGrade(p, card, "read", "again", TODAY, sm2);
    expect(p.newToday).toEqual({ date: TODAY, counts: { read: 1 } });
    expect(isMistake(p.cards[cardKey("a", "read")])).toBe(true);
    p = applyGrade(p, { ...card, isNew: false }, "read", "good", TODAY, sm2);
    expect(p.newToday.counts.read).toBe(1);
    expect(isMistake(p.cards[cardKey("a", "read")])).toBe(true);
    p = applyGrade(p, { ...card, isNew: false }, "read", "good", TODAY, sm2);
    expect(isMistake(p.cards[cardKey("a", "read")])).toBe(false);
  });

  it("doesn't stretch the interval when a mistake is practised early", () => {
    const p = progressWith({ a: { everWrong: true, streak: 0, due: "2026-05-01", interval: 9 } });
    const next = applyGrade(p, { word: words[0], isNew: false, early: true }, "read", "easy", TODAY, sm2);
    expect(next.cards[cardKey("a", "read")]).toMatchObject({ due: "2026-05-01", interval: 9, streak: 1 });
    const wrong = applyGrade(p, { word: words[0], isNew: false, early: true }, "read", "again", TODAY, sm2);
    expect(wrong.cards[cardKey("a", "read")].due).toBe(TODAY);
  });

  it("requeues a card a few places later", () => {
    expect(requeue([1, 2, 3, 4, 5, 6], 0, 9)).toEqual([1, 2, 3, 4, 9, 5, 6]);
    expect(requeue([1, 2], 1, 9)).toEqual([1, 2, 9]);
  });

  it("summarizes due, new, mistakes and learned counts", () => {
    const p = progressWith({ a: { due: TODAY, everWrong: true, streak: 0 }, b: { due: "2026-04-01" } }, { newPerDay: 1 });
    expect(summarize(words, p, "read", TODAY)).toEqual({
      due: 1,
      newAvailable: 1,
      mistakes: 1,
      learned: 2,
      unseen: 2,
      reviewedToday: 2,
    });
  });

  it("gives an extra batch of new words beyond the daily limit", () => {
    const p = progressWith({ a: { due: TODAY } }, { newPerDay: 0 });
    expect(buildSession(words, p, { mode: "read", today: TODAY })).toHaveLength(1); // just the review
    const extra = buildSession(words, p, { mode: "read", today: TODAY, extraNew: 2 });
    expect(extra.map((c) => [c.word.id, c.isNew])).toEqual([
      ["b", true],
      ["c", true],
    ]);
  });

  it("re-drills today's reviewed cards as practice, without stretching intervals", () => {
    const p = progressWith({ a: { lastReviewed: TODAY, due: "2026-03-11" }, b: { lastReviewed: "2026-03-01", due: TODAY } });
    const s = buildSession(words, p, { mode: "read", today: TODAY, reviewedToday: true });
    expect(s.map((c) => [c.word.id, c.early])).toEqual([["a", true]]);
    const after = applyGrade(p, s[0], "read", "easy", TODAY, sm2);
    expect(after.cards[cardKey("a", "read")].due).toBe("2026-03-11");
  });
});
