/**
 * Generates each letter's "How its sound changes" tables from the structured `changes` data in
 * rules.ts (+ BASIC_CHANGES). Nothing here is hand-written per letter.
 */
import { JAMO, jamoByChar } from "./hangul";
import { BASIC_CHANGES, RULES } from "./rules";
import type { ChangePosition, Jamo, PronunciationRule, SoundChange } from "./types";
import { lookupWord, type Word, type WordKey } from "./words";

export interface ChangeRow {
  position: ChangePosition;
  when: string;
  becomes: string;
  note?: string;
  example: Word & { spelling: WordKey };
  frequency: 1 | 2 | 3;
  /** The rule card this row comes from (links to /rules#id), or undefined for basic sounds. */
  rule?: PronunciationRule;
  /** Shown instead of a rule link for rows without a rule card. */
  reference?: string;
}

interface Source {
  change: SoundChange;
  rule?: PronunciationRule;
  reference?: string;
  order: number;
}

// Basic sounds first, then rules in learning order; within the same frequency this keeps rows sensible.
const SOURCES: Source[] = [
  ...BASIC_CHANGES.map((change, i) => ({ change, reference: change.reference, order: i })),
  ...RULES.flatMap((rule, r) =>
    rule.changes.map((change, i) => ({ change, rule, order: 100 + r * 10 + i })),
  ),
];

export function changeRowsFor(char: string): Record<ChangePosition, ChangeRow[]> {
  const rows: Record<ChangePosition, (ChangeRow & { order: number })[]> = { initial: [], final: [], vowel: [] };
  for (const { change, rule, reference, order } of SOURCES) {
    const target = change.targets[char];
    if (!target) continue;
    rows[change.position].push({
      position: change.position,
      when: change.when,
      becomes: target.becomes,
      note: target.note,
      example: lookupWord(target.example),
      frequency: change.frequency,
      rule,
      reference,
      order,
    });
  }
  const sort = (list: (ChangeRow & { order: number })[]) =>
    list.sort((a, b) => a.frequency - b.frequency || a.order - b.order);
  return { initial: sort(rows.initial), final: sort(rows.final), vowel: sort(rows.vowel) };
}

/** True if every row is a basic sound (no rule changes it): the table collapses to one line. */
export function onlyBasic(rows: ChangeRow[]): boolean {
  return rows.every((r) => !r.rule && !r.reference) && rows.length <= 1;
}

/**
 * Rules this letter is involved in without being changed itself: it triggers the change (e.g. ㅣ in
 * palatalization) or is the result of it (e.g. ㄸ in tensification).
 */
export function alsoInvolvedRules(char: string): PronunciationRule[] {
  const own = new Set(
    Object.values(changeRowsFor(char))
      .flat()
      .map((r) => r.rule?.id)
      .filter(Boolean),
  );
  return RULES.filter(
    (rule) =>
      !own.has(rule.id) &&
      rule.changes.some(
        (c) =>
          c.neighbors?.includes(char) || Object.values(c.targets).some((t) => t?.result === char),
      ),
  );
}

/** Every letter a rule touches: affected letters, triggering neighbors and results. For the Rules page. */
export function relatedJamoForRule(rule: PronunciationRule): Jamo[] {
  const chars = new Set<string>();
  for (const change of rule.changes) {
    for (const [char, target] of Object.entries(change.targets)) {
      chars.add(char);
      if (target?.result) chars.add(target.result);
    }
    change.neighbors?.forEach((n) => chars.add(n));
  }
  return JAMO.filter((j) => chars.has(j.char));
}

export { jamoByChar };
