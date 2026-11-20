/**
 * Estimated start time of each word in a recording, for when the TTS can't report real timings
 * (Google's Korean voices return 0 for every word, Chirp 3 HD voices return none).
 *
 * Korean is syllable-timed: each syllable takes roughly the same time. So within a stretch of speech,
 * a word's share is proportional to its syllables.
 *
 * Two levels:
 * - `estimateWordTimes(words, duration)`: from the duration alone (assumed lead/tail silence and
 *   sentence pauses). Used until the audio has been analysed.
 * - `wordTimesFromEnvelope(words, envelope)`: from the audio's loudness over time. It finds where speech
 *   really starts and ends and where the sentence pauses are, so it adapts to each voice (Chirp voices
 *   pause ~2.5x longer between sentences than Standard ones, measured).
 */

const HANGUL = /[가-힣]/g;
const OTHER = /[A-Za-z0-9]/g;
const SENTENCE_END = /[.!?。…]["'”’)]*$/;
const CLAUSE_END = /[,;:]["'”’)]*$/;

/** Relative length of one word: Hangul syllables count 1, Latin letters and digits ½. */
function weight(word: string): number {
  return (word.match(HANGUL)?.length ?? 0) + 0.5 * (word.match(OTHER)?.length ?? 0) || 1;
}

/** Pause after a word, in syllable units (used when the real pauses aren't known). */
function pauseAfter(word: string): number {
  if (SENTENCE_END.test(word)) return 2;
  if (CLAUSE_END.test(word)) return 1;
  return 0;
}

/** Spread `words` over [from, to] seconds by syllable weight (with `pauses` units after each word). */
function spread(words: string[], from: number, to: number, pauses: (w: string, last: boolean) => number): number[] {
  const units = words.map((w, i) => weight(w) + pauses(w, i === words.length - 1));
  const total = units.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0, to - from);
  const times: number[] = [];
  let before = 0;
  for (const u of units) {
    times.push(from + (before / total) * span);
    before += u;
  }
  return times;
}

/** Silence Google adds before the first and after the last word (seconds), when not measured. */
const LEAD = 0.05;
const TAIL = 0.15;

export function estimateWordTimes(words: string[], durationSeconds: number): number[] {
  if (words.length === 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return words.map(() => 0);
  return spread(words, LEAD, Math.max(LEAD + 0.1, durationSeconds - TAIL), (w, last) => (last ? 0 : pauseAfter(w)));
}

/** Loudness over time: one RMS value per frame. */
export interface Envelope {
  rms: ArrayLike<number>;
  /** Frame length in seconds (e.g. 0.01). */
  frame: number;
}

/** A frame counts as speech above this share of the loudest frame. */
const VOICED = 0.05;
/** Below this RMS (samples are -1…1) the whole recording is treated as silent. */
const MIN_LOUDNESS = 0.005;
/** Silences shorter than this are inside words (stop consonants), not pauses. */
const MIN_PAUSE = 0.12;

/** Loudness envelope of mono samples, in `frame`-second frames. */
export function envelopeOf(samples: ArrayLike<number>, sampleRate: number, frame = 0.01): Envelope {
  const hop = Math.max(1, Math.round(sampleRate * frame));
  const n = Math.floor(samples.length / hop);
  const rms = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) sum += samples[i] * samples[i];
    rms[f] = Math.sqrt(sum / hop);
  }
  return { rms, frame: hop / sampleRate };
}

/**
 * Word start times from the audio itself. Speech start/end and the sentence pauses are measured; the
 * longest pauses are matched to the sentence ends, and each sentence's words are spread over its own
 * stretch of speech. Returns null if the audio can't be read that way (the duration estimate is used).
 */
export function wordTimesFromEnvelope(
  words: string[],
  { rms, frame }: Envelope,
  /** Optional word starts from speech recognition, used inside sentences where they're plausible. */
  recognized?: number[] | null,
): number[] | null {
  if (words.length === 0 || rms.length === 0) return null;
  let max = 0;
  for (let i = 0; i < rms.length; i++) max = Math.max(max, rms[i]);
  // Nothing louder than near-silence (samples are -1…1): no speech to measure.
  if (max < MIN_LOUDNESS) return null;
  const voiced = (i: number) => rms[i] > VOICED * max;

  let first = 0;
  while (first < rms.length && !voiced(first)) first++;
  let last = rms.length - 1;
  while (last > first && !voiced(last)) last--;
  if (first >= last) return null;

  // Silent runs inside the speech that are long enough to be pauses.
  const gaps: { start: number; end: number }[] = [];
  for (let i = first; i <= last;) {
    if (voiced(i)) {
      i++;
      continue;
    }
    const start = i;
    while (i <= last && !voiced(i)) i++;
    if ((i - start) * frame >= MIN_PAUSE) gaps.push({ start, end: i });
  }

  const speechStart = first * frame;
  const speechEnd = (last + 1) * frame;
  const assumed = (w: string, isLast: boolean) => (isLast ? 0 : pauseAfter(w));

  // Possible pause points: after each word ending in punctuation (not the last word). Where each is
  // expected: with speech recognition, where it heard the next word start (it puts that at the start of
  // the silence, which is exactly what's compared with each gap's start); without it, an even-pace guess.
  const heard = recognized?.length === words.length ? recognized : null;
  const rough = spread(words, speechStart, speechEnd, assumed);
  const points = words
    .map((w, i) => ({ after: i, kind: SENTENCE_END.test(w) ? "sentence" : CLAUSE_END.test(w) ? "clause" : null }))
    .filter((p): p is { after: number; kind: "sentence" | "clause" } => p.kind !== null && p.after < words.length - 1)
    .map((p) => ({
      ...p,
      expected: heard && Number.isFinite(heard[p.after + 1]) ? heard[p.after + 1] : rough[p.after + 1],
    }));

  // Fix 2: recognition counts a pause as part of the next word; move its starts out of silences first.
  const snappedHeard = heard ? snapToSpeech(heard, { rms, frame }) : null;

  const matched = alignPauses(
    points.map((p) => ({ expected: p.expected, required: p.kind === "sentence" })),
    gaps.map((g) => ({ start: g.start * frame, end: g.end * frame })),
    heard ? "recognized" : "estimated",
  );

  // Split the words at matched pauses; each stretch of speech gets its own words, spread by syllables
  // (with assumed pauses only for punctuation that had no measured gap).
  const times: number[] = [];
  let segStartWord = 0;
  let segStartTime = speechStart;
  const segments = matched.map((m) => ({ after: points[m.point].after, gap: gaps[m.gap] }));
  for (const seg of [...segments, null]) {
    const endWord = seg ? seg.after + 1 : words.length;
    const endTime = seg ? seg.gap.start * frame : speechEnd;
    const segWords = words.slice(segStartWord, endWord);
    const base = spread(segWords, segStartTime, endTime, assumed);
    times.push(
      ...(snappedHeard
        ? withinSegment(segWords, base, snappedHeard.slice(segStartWord, endWord), segStartTime, endTime)
        : base),
    );
    if (seg) {
      segStartWord = endWord;
      segStartTime = seg.gap.end * frame;
    }
  }
  return times;
}

/**
 * A recognized start is plausible if the word before it took between these multiples of the stretch's
 * own average time per syllable (measured: the stretch's length / its syllables). Speakers vary their
 * pace within a sentence, but not by more than this; recognition errors usually do.
 */
const MIN_PACE = 0.4;
const MAX_PACE = 2.5;

/**
 * Inside one stretch of speech (between measured pauses), use recognized word starts where they're
 * plausible: inside the stretch, in order, and implying a sensible length for the word before. The
 * stretch's first word always starts where the speech does (recognition puts it inside the pause).
 * Anything implausible falls back to the syllable spread.
 */
function withinSegment(words: string[], base: number[], recognized: number[], from: number, to: number): number[] {
  const out: number[] = [];
  const totalSyllables = words.reduce((n, w) => n + weight(w), 0) || 1;
  const pace = Math.max(0.02, (to - from) / totalSyllables); // seconds per syllable in this stretch
  words.forEach((_, j) => {
    if (j === 0) {
      out.push(from);
      return;
    }
    const prev = out[j - 1];
    const syllables = weight(words[j - 1]);
    const t = recognized[j];
    const gap = t - prev;
    const plausible =
      Number.isFinite(t) &&
      t > from &&
      t < to &&
      gap >= MIN_PACE * pace * syllables &&
      gap <= MAX_PACE * pace * syllables;
    out.push(plausible ? t : Math.max(base[j], prev + MIN_PACE * pace * syllables));
  });
  return out;
}

/** Speech recognition reports times in 0.1 s steps, so a start can land just before the silence it marks. */
const RECOGNITION_STEP = 0.1;

/**
 * Speech recognition counts a pause as part of the *next* word (its start time is when the silence
 * begins). Move any word start that falls inside a measured silence to where speech resumes. A start
 * up to one recognition step before a real pause (>= MIN_PAUSE) also belongs to that pause; shorter
 * dips (inside words) only count when the start is actually inside them.
 */
export function snapToSpeech(times: number[], { rms, frame }: Envelope): number[] {
  let max = 0;
  for (let i = 0; i < rms.length; i++) max = Math.max(max, rms[i]);
  if (max < MIN_LOUDNESS) return times;
  const voiced = (i: number) => rms[i] > VOICED * max;
  // Silent runs (any length here: even a short one before a word means it hasn't started yet).
  const silences: { start: number; end: number }[] = [];
  for (let i = 0; i < rms.length;) {
    if (voiced(i)) {
      i++;
      continue;
    }
    const start = i;
    while (i < rms.length && !voiced(i)) i++;
    silences.push({ start: start * frame, end: i * frame });
  }
  const snapped = times.map((t) => {
    const s = silences.find(
      (g) => t < g.end && (t >= g.start || (g.end - g.start >= MIN_PAUSE && t >= g.start - RECOGNITION_STEP)),
    );
    return s && s.end < rms.length * frame ? s.end : t;
  });
  for (let i = 1; i < snapped.length; i++) snapped[i] = Math.max(snapped[i], snapped[i - 1]);
  return snapped;
}

/**
 * Match pause points (in order) to measured gaps (in order) so the gaps fall where the points are
 * expected. Sentence ends should get a gap (skipping one is costly); commas may or may not have one;
 * stray gaps (a breath, a long stop consonant) can be left unmatched. Dynamic programming over both
 * lists; returns the matched (point, gap) index pairs in order.
 */
export function alignPauses(
  points: { expected: number; required: boolean }[],
  gaps: { start: number; end: number }[],
  /**
   * Where the expected positions came from. "estimated" (an even-pace guess) is rough, so a point may
   * sit ~0.5 s from its real pause and still be matched. "recognized" (speech recognition heard it,
   * 0.1 s steps) is precise, so a point only claims a pause within ~0.2 s; a pause further away is a
   * pause somewhere else in the sentence (e.g. after a topic word like 저는), not this point's.
   */
  expectedFrom: "estimated" | "recognized" = "estimated",
): { point: number; gap: number }[] {
  // Seconds of position error that skipping a point is worth.
  const SKIP_REQUIRED = expectedFrom === "recognized" ? 0.6 : 1.5;
  const SKIP_OPTIONAL = expectedFrom === "recognized" ? 0.2 : 0.5;
  const P = points.length;
  const G = gaps.length;
  // cost[p][g]: best cost having handled the first p points and first g gaps.
  const cost: number[][] = Array.from({ length: P + 1 }, () => new Array<number>(G + 1).fill(Infinity));
  const move: ("match" | "skipPoint" | "skipGap")[][] = Array.from({ length: P + 1 }, () => new Array(G + 1));
  cost[0][0] = 0;
  for (let p = 0; p <= P; p++) {
    for (let g = 0; g <= G; g++) {
      const c = cost[p][g];
      if (c === Infinity) continue;
      if (p < P && g < G) {
        // A gap's start is where the speech before the pause ends: compare it with the expected time.
        const m = c + Math.abs(gaps[g].start - points[p].expected);
        if (m < cost[p + 1][g + 1]) {
          cost[p + 1][g + 1] = m;
          move[p + 1][g + 1] = "match";
        }
      }
      if (p < P) {
        const s = c + (points[p].required ? SKIP_REQUIRED : SKIP_OPTIONAL);
        if (s < cost[p + 1][g]) {
          cost[p + 1][g] = s;
          move[p + 1][g] = "skipPoint";
        }
      }
      if (g < G && c < cost[p][g + 1]) {
        cost[p][g + 1] = c;
        move[p][g + 1] = "skipGap";
      }
    }
  }
  const pairs: { point: number; gap: number }[] = [];
  for (let p = P, g = G; p > 0 || g > 0;) {
    const m = move[p][g];
    if (m === "match") pairs.unshift({ point: --p, gap: --g });
    else if (m === "skipPoint") p--;
    else g--;
  }
  return pairs;
}
