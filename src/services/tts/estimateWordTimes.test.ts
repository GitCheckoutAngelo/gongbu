import { describe, expect, it } from "vitest";
import { alignPauses, envelopeOf, estimateWordTimes, snapToSpeech, wordTimesFromEnvelope } from "./estimateWordTimes";

describe("estimateWordTimes (duration only)", () => {
  it("spreads the audio over syllables", () => {
    // 2 + 2 syllables over 4.2s of audio (0.05 lead, 0.15 tail → 4s spoken): second word at the midpoint.
    expect(estimateWordTimes(["저는", "학생"], 4.2)).toEqual([0.05, 2.05]);
  });

  it("adds a pause after punctuation", () => {
    const [, second, third] = estimateWordTimes(["가.", "나", "다"], 5.2);
    // 가 (1) + pause (2) before 나, then 나 (1): units 3 and 4 of 5.
    expect(second).toBeCloseTo(0.05 + (3 / 5) * 5, 5);
    expect(third).toBeCloseTo(0.05 + (4 / 5) * 5, 5);
  });

  it("is increasing, and handles empty input or unknown duration", () => {
    const t = estimateWordTimes(["저는", "매일", "아침에", "커피를", "마셔요."], 3);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
    expect(new Set(t).size).toBe(5);
    expect(estimateWordTimes([], 3)).toEqual([]);
    expect(estimateWordTimes(["a", "b"], NaN)).toEqual([0, 0]);
  });
});

/** A synthetic envelope: [silent|speech] runs in 10 ms frames. */
function env(runs: [kind: "s" | "v", frames: number][]) {
  const rms: number[] = [];
  for (const [kind, n] of runs) for (let i = 0; i < n; i++) rms.push(kind === "v" ? 1 : 0.001);
  return { rms, frame: 0.01 };
}

describe("wordTimesFromEnvelope (measured)", () => {
  it("uses the measured speech start and the real sentence pause", () => {
    // 0.2s lead, sentence 1 (1.0s), 0.6s pause, sentence 2 (0.8s), tail.
    const e = env([
      ["s", 20],
      ["v", 100],
      ["s", 60],
      ["v", 80],
      ["s", 30],
    ]);
    const t = wordTimesFromEnvelope(["저는", "학생이에요.", "학교에", "가요."], e)!;
    expect(t[0]).toBeCloseTo(0.2, 5); // speech start, not an assumed 0.05
    expect(t[1]).toBeCloseTo(0.2 + (2 / 7) * 1.0, 5); // 저는 = 2 of 7 syllables in sentence 1
    expect(t[2]).toBeCloseTo(1.8, 5); // sentence 2 starts after the real 0.6s pause
    expect(t[3]).toBeCloseTo(1.8 + (3 / 5) * 0.8, 5);
  });

  it("matches the longest gaps to sentence ends and ignores short in-word silences", () => {
    const e = env([
      ["v", 50],
      ["s", 5], // 50 ms: inside a word, not a pause
      ["v", 50],
      ["s", 20], // 200 ms: a comma-ish pause
      ["v", 50],
      ["s", 50], // 500 ms: the sentence pause
      ["v", 100],
    ]);
    const t = wordTimesFromEnvelope(["가나다", "라마바,", "사아자.", "차카타파하"], e)!;
    expect(t[3]).toBeCloseTo(2.25, 5); // after the 500 ms gap, not the 200 ms one
  });

  it("handles a comma pause longer than the sentence pause (Standard voices do this)", () => {
    // Real shape from ko-KR-Standard-A: comma pause 0.29s, sentence pauses 0.38s and 0.23s.
    // "어제는 비가 와서, 집에서 책을 읽었어요. 오후에는 친구가 놀러 왔어요. 우리는 같이 영화를 봤어요."
    const e = env([
      ["s", 3],
      ["v", 116], // 어제는 비가 와서,
      ["s", 29], // comma pause
      ["v", 148], // 집에서 책을 읽었어요.
      ["s", 38], // sentence pause
      ["v", 191], // 오후에는 친구가 놀러 왔어요.
      ["s", 23], // sentence pause
      ["v", 180], // 우리는 같이 영화를 봤어요.
      ["s", 20],
    ]);
    const words =
      "어제는 비가 와서, 집에서 책을 읽었어요. 오후에는 친구가 놀러 왔어요. 우리는 같이 영화를 봤어요.".split(" ");
    const t = wordTimesFromEnvelope(words, e)!;
    expect(t[3]).toBeCloseTo(1.48, 2); // 집에서: after the comma pause
    expect(t[6]).toBeCloseTo(3.34, 2); // 오후에는: after sentence 1's pause, not the comma's
    expect(t[10]).toBeCloseTo(5.48, 2); // 우리는: after sentence 2's (shorter) pause
  });

  it("aligns pauses by expected position, not just length", () => {
    const pairs = alignPauses(
      [
        { expected: 1.0, required: false },
        { expected: 3.0, required: true },
      ],
      [
        { start: 1.1, end: 1.5 }, // long, near the comma
        { start: 2.9, end: 3.1 }, // short, near the sentence end
      ],
    );
    expect(pairs).toEqual([
      { point: 0, gap: 0 },
      { point: 1, gap: 1 },
    ]);
  });

  it("falls back to the measured span when the pauses can't be found", () => {
    const e = env([
      ["s", 10],
      ["v", 200],
      ["s", 10],
    ]);
    const t = wordTimesFromEnvelope(["가.", "나."], e)!;
    expect(t[0]).toBeCloseTo(0.1, 5);
    expect(t[1]).toBeGreaterThan(0.1);
    expect(t[1]).toBeLessThan(2.1);
    expect(wordTimesFromEnvelope(["가"], env([["s", 50]]))).toBeNull(); // silence only
  });

  it("combines: pauses from the audio, plausible recognition times inside sentences", () => {
    // sentence 1: 0–1.0s, pause 1.0–1.6s, sentence 2: 1.6–2.6s
    const e = env([
      ["v", 100],
      ["s", 60],
      ["v", 100],
    ]);
    const words = ["저는", "친구들과", "함께.", "저녁에는", "먹어요."];
    // Recognition: word 3 impossibly soon after a 4-syllable word, word 4 inside the pause; word 5 fine.
    const recognized = [0, 0.2, 0.3, 1.0, 2.1];
    const t = wordTimesFromEnvelope(words, e, recognized)!;
    expect(t[0]).toBeCloseTo(0);
    expect(t[1]).toBeCloseTo(0.2); // plausible: used
    expect(t[2]).toBeGreaterThan(0.2 + 4 * 0.07 - 1e-9); // 0.1 s for "친구들과" is implausible: not 0.3
    expect(t[3]).toBeCloseTo(1.6); // sentence start comes from the measured pause, not 1.0
    expect(t[4]).toBeCloseTo(2.1); // plausible: used
  });

  it("doesn't let an extra pause after a conjunction steal the sentence pause (Kore: 그래서)", () => {
    // 피곤해요. (0–1.0) | sentence pause 1.0–1.4 | 그래서 (1.4–1.8) | unpunctuated pause 1.8–2.2 | rest
    const e = env([
      ["v", 100],
      ["s", 40],
      ["v", 40],
      ["s", 40],
      ["v", 120],
    ]);
    const words = ["피곤해요.", "그래서", "주말에는", "쉬어요."];
    // Recognition puts each word at the start of the silence before it.
    const t = wordTimesFromEnvelope(words, e, [0, 1.0, 1.8, 2.8])!;
    expect(t[1]).toBeCloseTo(1.4); // sentence starts where speech resumes after the *sentence* pause
    expect(t[2]).toBeCloseTo(2.2); // moved out of the 그래서 pause
    expect(t[3]).toBeCloseTo(2.8);
  });

  it("doesn't give a comma a pause that belongs to the next word (Kore: 있는데, 저는 [pause] 아직)", () => {
    // From the real failing recording, shifted to 0: 있는데, at 0, 저는 at 0.3, pause 0.61–0.96, 아직 after.
    const e = env([
      ["v", 61], // 있는데, 저는
      ["s", 35], // pause after 저는 (not after the comma)
      ["v", 80], // 아직 한 번도
    ]);
    const words = ["있는데,", "저는", "아직", "한번도."];
    // Recognition: 저는 right after the comma (no pause there), 아직 at the start of the pause.
    const t = wordTimesFromEnvelope(words, e, [0, 0.3, 0.6, 1.2])!;
    expect(t[1]).toBeCloseTo(0.3); // not pushed to the end of the later pause
    expect(t[2]).toBeCloseTo(0.96); // starts where speech resumes after the pause
  });

  it("snaps word starts that fall inside a silence to where speech resumes", () => {
    // speech 0–1.0s, silence 1.0–1.6s, speech 1.6–2.5s
    const e = env([
      ["v", 100],
      ["s", 60],
      ["v", 90],
    ]);
    // Recognition put word 2 at 1.0s (start of the pause); word 3 is mid-speech and stays.
    expect(snapToSpeech([0, 1.0, 2.0], e)).toEqual([0, 1.6, 2.0]);
    // Leading silence: the first word moves to the speech onset.
    expect(
      snapToSpeech(
        [0, 0.5],
        env([
          ["s", 20],
          ["v", 80],
        ]),
      ),
    ).toEqual([0.2, 0.5]);
  });

  it("builds an envelope from samples", () => {
    const samples = new Float32Array(1000).fill(0.5);
    const e = envelopeOf(samples, 1000, 0.01);
    expect(e.rms.length).toBe(100);
    expect(e.rms[0]).toBeCloseTo(0.5, 5);
    expect(e.frame).toBeCloseTo(0.01, 5);
  });
});
