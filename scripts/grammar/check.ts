/**
 * Checks on one grammar pattern card (used by buildSeed.ts and the grammar test). Learners memorize these,
 * so anything malformed is caught here rather than shown.
 */
import { GRAMMAR_GROUP_IDS, PATTERN_REGISTER_IDS, type GrammarPattern } from "../../src/data/grammarMeta";

const HANGUL = /[가-힣]/;
/** A form: Korean, with the textbook notation (hyphens, brackets, slashes, N/V/A placeholders, ?, ~, spaces). */
const FORM = /^[-가-힣ㄱ-ㅎㅏ-ㅣ()/?~ .,NVA]+$/;

export function grammarProblems(p: GrammarPattern): string[] {
  const problems: string[] = [];
  if (!p.id || !p.form || !FORM.test(p.form) || !HANGUL.test(p.form.replace(/[ㄱ-ㅎ]/g, "가"))) {
    problems.push(`form "${p.form}" isn't in textbook notation`);
  }
  if (!p.meaning || p.meaning.length > 120) problems.push("meaning missing or too long");
  if (!p.title || p.title.length > 60) problems.push("plain title missing or too long");
  if (!p.explain || p.explain.length > 260) problems.push("plain explanation missing or too long");
  if (!HANGUL.test(p.sample?.ko ?? "") || /[a-zA-Z]/.test(p.sample.ko) || !p.sample.en) {
    problems.push(`sample isn't a Korean chunk with English: ${p.sample?.ko}`);
  }
  if (
    /(particle|marker|suffix|stem|conjugat|clause|auxiliary|declarative|connective)/i.test(p.title + " " + p.explain)
  ) {
    problems.push("plain text uses grammar terms");
  }
  if (![1, 2, 3, 4, 5, 6].includes(p.level)) problems.push(`level ${p.level}`);
  if (!(GRAMMAR_GROUP_IDS as string[]).includes(p.group)) problems.push(`group ${p.group}`);
  if (!(PATTERN_REGISTER_IDS as string[]).includes(p.register)) problems.push(`register ${p.register}`);
  if (!p.attaches || p.attaches.length > 400) problems.push("attaches missing or too long");
  if (p.examples.length !== 2) problems.push(`${p.examples.length} examples (want 2)`);
  for (const e of p.examples) {
    if (!HANGUL.test(e.ko) || /[a-zA-Z]/.test(e.ko)) problems.push(`example isn't Korean: ${e.ko}`);
    if (!e.en) problems.push(`example has no translation: ${e.ko}`);
    if (!e.part || !e.ko.includes(e.part)) problems.push(`marked part "${e.part}" isn't in "${e.ko}"`);
  }
  if (p.similar.includes(p.id)) problems.push("lists itself as similar");
  return problems;
}
