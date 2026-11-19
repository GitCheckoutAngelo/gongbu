/**
 * Map what speech recognition heard onto our words. Recognition may split, merge or spell words
 * differently ("8시" vs "여덟 시", a missing particle), so the match is done character by character
 * (longest common subsequence over Hangul/letters/digits). Each of our words starts at the time of
 * its first matched character; words with no match are interpolated between their neighbours.
 */
import type { RecognizedWord } from "./types";

/** Characters that carry the match: Hangul syllables, letters, digits. */
const KEEP = /[\p{L}\p{N}]/u;

/** Below this share of our characters matched, the result isn't trustworthy. */
export const MIN_MATCHED = 0.6;

interface Char {
  ch: string;
  /** Index of the word this character belongs to. */
  word: number;
  /** Position of the character within its word's kept characters. */
  pos: number;
}

function charsOf(words: string[]): Char[] {
  const out: Char[] = [];
  words.forEach((w, word) => {
    let pos = 0;
    for (const ch of w) if (KEEP.test(ch)) out.push({ ch, word, pos: pos++ });
  });
  return out;
}

/** Pairs (i in a, j in b) of a longest common subsequence of two character lists. */
function lcsPairs(a: string[], b: string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) pairs.push([i++, j++]);
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** One start time per word of `words`, or null if too little of the text was recognized. */
export function matchWords(words: string[], heard: RecognizedWord[]): number[] | null {
  if (words.length === 0 || heard.length === 0) return null;
  const ours = charsOf(words);
  const theirs = charsOf(heard.map((h) => h.word));
  if (ours.length === 0 || theirs.length === 0) return null;
  // Characters per recognized word, to place a character inside its word's time span.
  const lengths = heard.map((h) => [...h.word].filter((c) => KEEP.test(c)).length || 1);

  const pairs = lcsPairs(
    ours.map((c) => c.ch),
    theirs.map((c) => c.ch),
  );
  if (pairs.length / ours.length < MIN_MATCHED) return null;

  // Time at which a recognized character is spoken: its word's span, split evenly by characters.
  const timeOf = (j: number) => {
    const c = theirs[j];
    const h = heard[c.word];
    return h.start + (c.pos / lengths[c.word]) * Math.max(0, h.end - h.start);
  };

  // Each of our words: the time of its first matched character, moved back by the characters before it
  // (at that recognized word's pace).
  const times: (number | null)[] = words.map(() => null);
  for (const [i, j] of pairs) {
    const c = ours[i];
    if (times[c.word] !== null) continue;
    const h = heard[theirs[j].word];
    const perChar = Math.max(0, h.end - h.start) / lengths[theirs[j].word];
    times[c.word] = Math.max(0, timeOf(j) - c.pos * perChar);
  }

  // Fill words with no match by interpolating between the nearest known neighbours.
  const known = times.map((t, i) => (t === null ? -1 : i)).filter((i) => i >= 0);
  if (known.length === 0) return null;
  const filled = times.map((t, i) => {
    if (t !== null) return t;
    const before = [...known].reverse().find((k) => k < i);
    const after = known.find((k) => k > i);
    if (before === undefined) return times[after!]!;
    if (after === undefined) return times[before]!;
    return times[before]! + ((i - before) / (after - before)) * (times[after]! - times[before]!);
  });

  // Never go backwards in time.
  for (let i = 1; i < filled.length; i++) filled[i] = Math.max(filled[i], filled[i - 1]);
  return filled;
}
