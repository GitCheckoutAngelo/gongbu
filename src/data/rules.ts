/**
 * Pronunciation rules, in learning order. Edit freely; the UI reads everything from here.
 *
 * - Prose, formulas and `examples` drive the Rules page cards.
 * - `changes` is structured data: which letters a rule changes, in which position, and what neighbor
 *   triggers it. Each letter's "How its sound changes" tables (Hangul chart) are generated from it,
 *   and so are the "Related letters" on the Rules page. Don't hand-write per-letter tables.
 * - Words are keys into words.ts (pronunciation and romanization live there, once).
 * - Pronunciations follow 표준 발음법 (Standard Korean Pronunciation).
 */
import type { BasicSoundChange, PronunciationRule, RuleId } from "./types";

/** Finals that sound like [ㄱ], [ㄷ] or [ㅂ] (unreleased k/t/p). */
const KTP_FINALS = ["ㄱ", "ㄲ", "ㅋ", "ㄷ", "ㅅ", "ㅆ", "ㅈ", "ㅊ", "ㅌ", "ㅂ", "ㅍ"];
const ALL_FINALS = [...KTP_FINALS, "ㄴ", "ㄹ", "ㅁ", "ㅇ", "ㅎ"];

export const RULES: PronunciationRule[] = [
  {
    id: "block-structure",
    title: "Syllable block structure",
    koreanTitle: "음절 구조",
    explanation:
      "Hangul letters are grouped into square syllable blocks. Every block has an initial consonant and a vowel, and may have a final consonant (받침) at the bottom. If a syllable starts with a vowel sound, the silent ㅇ fills the initial slot. Tall vowels (ㅏ ㅓ ㅣ…) go to the right of the initial consonant; flat vowels (ㅗ ㅜ ㅡ…) go below it; combined vowels (ㅘ ㅝ ㅢ…) wrap around it.",
    formulas: ["initial consonant + vowel (+ final consonant)", "ㄱ + ㅏ + ㅇ → 강"],
    examples: [
      { word: "아", note: "silent ㅇ + ㅏ" },
      { word: "가", note: "ㄱ + ㅏ" },
      { word: "강", note: "ㄱ + ㅏ + ㅇ" },
      { word: "한글", note: "two blocks" },
      { word: "닭", note: "double final ㄺ" },
    ],
    changes: [
      {
        position: "initial",
        when: "start of a word, or a vowel",
        frequency: 1,
        targets: { ㅇ: { becomes: "silent (placeholder)", example: "아이" } },
      },
    ],
  },
  {
    id: "final-sounds",
    title: "The 7 final-consonant sounds",
    koreanTitle: "받침의 대표음",
    reference: "표준 발음법 제8–9항",
    explanation:
      "At the end of a syllable (before another consonant or at the end of a word), only seven sounds are possible: ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅇ. Every other final consonant is pronounced as one of these. ㄱ, ㄷ and ㅂ are unreleased — your mouth closes the sound off without letting air out.",
    formulas: ["ㄱ ㄲ ㅋ → [ㄱ]", "ㄷ ㅅ ㅆ ㅈ ㅊ ㅌ (ㅎ) → [ㄷ]", "ㅂ ㅍ → [ㅂ]", "ㄴ ㄹ ㅁ ㅇ stay the same"],
    examples: [{ word: "부엌" }, { word: "밖" }, { word: "옷" }, { word: "꽃" }, { word: "앞" }],
    notes: [
      "This only applies when no vowel follows. Before a vowel, the original consonant moves to the next syllable instead (옷이 [오시]) — see Linking.",
      "A final ㅎ is a special case: it usually changes the next sound instead (see Aspiration and ㅎ dropping). It's [ㄷ] only in cases like the letter name 히읗 [히읃].",
    ],
    changes: [
      {
        position: "final",
        when: "end of a word, or most consonants",
        frequency: 1,
        targets: {
          ㄱ: { becomes: "unreleased k", example: "책", note: "the back of the tongue closes the sound; no air comes out" },
          ㄲ: { becomes: "[ㄱ] unreleased k", result: "ㄱ", example: "밖" },
          ㅋ: { becomes: "[ㄱ] unreleased k", result: "ㄱ", example: "부엌" },
          ㄴ: { becomes: "n", example: "눈" },
          ㄷ: { becomes: "unreleased t", example: "곧", note: "the tongue tip stays on the ridge behind the teeth" },
          ㄹ: { becomes: "l (never the tap)", example: "물" },
          ㅁ: { becomes: "m", example: "사람" },
          ㅂ: { becomes: "unreleased p", example: "밥", note: "the lips close and stay closed" },
          ㅅ: { becomes: "[ㄷ] unreleased t", result: "ㄷ", example: "옷" },
          ㅆ: { becomes: "[ㄷ] unreleased t", result: "ㄷ", example: "있다" },
          ㅇ: { becomes: "ng", example: "강" },
          ㅈ: { becomes: "[ㄷ] unreleased t", result: "ㄷ", example: "낮" },
          ㅊ: { becomes: "[ㄷ] unreleased t", result: "ㄷ", example: "꽃" },
          ㅌ: { becomes: "[ㄷ] unreleased t", result: "ㄷ", example: "밭" },
          ㅍ: { becomes: "[ㅂ] unreleased p", result: "ㅂ", example: "앞" },
        },
      },
      {
        position: "final",
        when: "end of a word",
        frequency: 3,
        targets: {
          ㅎ: {
            becomes: "[ㄷ] unreleased t",
            result: "ㄷ",
            example: "히읗",
            note: "mostly in letter names; usually ㅎ changes the next sound instead",
          },
        },
      },
    ],
  },
  {
    id: "double-finals",
    title: "Double final consonants",
    koreanTitle: "겹받침",
    reference: "표준 발음법 제10–11항",
    explanation:
      "Some syllables end in two different consonants. Before a consonant or at the end of a word, only one of them is pronounced. For ㄳ ㄵ ㄼ ㄽ ㄾ ㅄ the first (left) one is pronounced; for ㄺ ㄻ ㄿ the second (right) one is. Before a vowel, both are pronounced: the second one moves to the next syllable.",
    formulas: ["ㄳ → [ㄱ], ㄵ → [ㄴ], ㄼ ㄽ ㄾ → [ㄹ], ㅄ → [ㅂ]", "ㄺ → [ㄱ], ㄻ → [ㅁ], ㄿ → [ㅂ]"],
    examples: [
      { word: "닭" },
      { word: "값" },
      { word: "앉다", note: "also tensified" },
      { word: "여덟" },
      { word: "밟다", note: "exception: ㄼ → [ㅂ]" },
    ],
    notes: [
      "Exceptions: 밟- is always [밥] (밟다 [밥따], 밟고 [밥꼬]), and 넓- is [넙] in 넓죽하다 [넙쭈카다] and 넓둥글다 [넙뚱글다]. Otherwise ㄼ is [ㄹ]: 넓다 [널따].",
      "In verb and adjective stems, ㄺ is pronounced [ㄹ] before ㄱ: 읽고 [일꼬], 맑게 [말께] (but 읽다 [익따]).",
      "ㄶ and ㅀ (e.g. 많다, 싫다) follow the ㅎ rules — see Aspiration and ㅎ dropping.",
    ],
    changes: [
      {
        position: "final",
        when: "in a double final, before a consonant or at the end",
        frequency: 2,
        targets: {
          ㄹ: { becomes: "silent in ㄺ ㄻ ㄿ", example: "닭" },
          ㅅ: { becomes: "silent in ㄳ ㅄ", example: "값" },
          ㅈ: { becomes: "silent in ㄵ", example: "앉다" },
          ㅂ: { becomes: "silent in ㄼ (usually)", example: "여덟", note: "exception: 밟다 [밥따]" },
          ㄱ: { becomes: "silent in ㄺ before ㄱ (verb stems)", example: "읽고" },
        },
      },
    ],
  },
  {
    id: "linking",
    title: "Linking",
    koreanTitle: "연음",
    reference: "표준 발음법 제13–14항",
    explanation:
      "When a syllable ending in a consonant is followed by a syllable starting with the silent ㅇ, the final consonant moves over and is pronounced as the start of the next syllable. With a double final, only the second consonant moves.",
    formulas: ["final consonant + ㅇ → (moves to) next syllable", "음 + 악 → [으막]"],
    examples: [{ word: "음악" }, { word: "한국어" }, { word: "옷이" }, { word: "읽어요" }, { word: "앉아요" }],
    notes: [
      "A final ㅇ never moves: 강아지 [강아지].",
      "A final ㅎ disappears instead of moving: 좋아요 [조아요] — see ㅎ dropping.",
      "ㄷ/ㅌ before the ending 이 become ㅈ/ㅊ: 같이 [가치] — see Palatalization.",
      "If the next part is a separate word (not an ending), the final is first changed to its representative sound and then moves: 겉옷 [거돋], 맛없다 [마덥따]. 맛있다 and 멋있다 allow both [마딛따/마싣따] and [머딛따/머싣따].",
    ],
    changes: [
      {
        position: "final",
        when: "a vowel (next syllable starts with silent ㅇ)",
        neighbors: ["ㅇ"],
        frequency: 1,
        targets: {
          ㄱ: { becomes: "moves over → g", example: "한국어" },
          ㄲ: { becomes: "moves over → kk", example: "밖에" },
          ㅋ: { becomes: "moves over → k", example: "부엌에" },
          ㄴ: { becomes: "moves over → n", example: "눈이" },
          ㄷ: { becomes: "moves over → d", example: "받아요" },
          ㄹ: { becomes: "moves over → r (tap)", example: "물이" },
          ㅁ: { becomes: "moves over → m", example: "사람이" },
          ㅂ: { becomes: "moves over → b", example: "밥이" },
          ㅅ: { becomes: "moves over → s", example: "옷이" },
          ㅆ: { becomes: "moves over → ss", example: "있어요" },
          ㅈ: { becomes: "moves over → j", example: "낮에" },
          ㅊ: { becomes: "moves over → ch", example: "꽃이" },
          ㅌ: { becomes: "moves over → t", example: "밭을", note: "before the ending 이 it becomes ㅊ (palatalization)" },
          ㅍ: { becomes: "moves over → p", example: "앞에" },
          ㅇ: { becomes: "stays ng (doesn't move)", example: "강아지" },
        },
      },
      {
        position: "initial",
        when: "a consonant final (except ㅇ, ㅎ)",
        neighbors: ALL_FINALS.filter((c) => c !== "ㅇ" && c !== "ㅎ"),
        frequency: 1,
        targets: { ㅇ: { becomes: "filled by that consonant", example: "음악" } },
      },
    ],
  },
  {
    id: "nasalization",
    title: "Nasalization",
    koreanTitle: "비음화",
    reference: "표준 발음법 제18–19항",
    explanation:
      "Final sounds [ㄱ], [ㄷ], [ㅂ] become the nasal sounds [ㅇ], [ㄴ], [ㅁ] when the next syllable starts with ㄴ or ㅁ. Also, ㄹ after ㅁ or ㅇ is pronounced [ㄴ], and after ㄱ or ㅂ, both sounds change.",
    formulas: ["[ㄱ ㄷ ㅂ] + ㄴ/ㅁ → [ㅇ ㄴ ㅁ] + ㄴ/ㅁ", "ㅁ/ㅇ + ㄹ → ㅁ/ㅇ + [ㄴ]", "ㄱ/ㅂ + ㄹ → [ㅇ/ㅁ] + [ㄴ]"],
    examples: [{ word: "국물" }, { word: "합니다" }, { word: "거짓말" }, { word: "종로" }, { word: "국립" }],
    notes: [
      "The rule applies to the final sound, not the spelling: 거짓말 has ㅅ, which is [ㄷ] as a final, so it becomes [ㄴ].",
      "Very common in everyday endings: 감사합니다 [감사함니다], 먹는 [멍는].",
    ],
    changes: [
      {
        position: "final",
        when: "ㄴ or ㅁ",
        neighbors: ["ㄴ", "ㅁ"],
        frequency: 1,
        targets: {
          ㄱ: { becomes: "[ㅇ] ng", result: "ㅇ", example: "국물" },
          ㄲ: { becomes: "[ㅇ] ng", result: "ㅇ", example: "깎는" },
          ㅋ: { becomes: "[ㅇ] ng", result: "ㅇ", example: "부엌만" },
          ㄷ: { becomes: "[ㄴ] n", result: "ㄴ", example: "닫는" },
          ㅅ: { becomes: "[ㄴ] n", result: "ㄴ", example: "거짓말" },
          ㅆ: { becomes: "[ㄴ] n", result: "ㄴ", example: "있는" },
          ㅈ: { becomes: "[ㄴ] n", result: "ㄴ", example: "맞는" },
          ㅊ: { becomes: "[ㄴ] n", result: "ㄴ", example: "쫓는" },
          ㅌ: { becomes: "[ㄴ] n", result: "ㄴ", example: "붙는" },
          ㅂ: { becomes: "[ㅁ] m", result: "ㅁ", example: "합니다" },
          ㅍ: { becomes: "[ㅁ] m", result: "ㅁ", example: "앞마당" },
        },
      },
      {
        position: "final",
        when: "ㄹ",
        neighbors: ["ㄹ"],
        frequency: 2,
        targets: {
          ㄱ: { becomes: "[ㅇ] ng, and the ㄹ becomes [ㄴ]", result: "ㅇ", example: "국립" },
          ㅂ: { becomes: "[ㅁ] m, and the ㄹ becomes [ㄴ]", result: "ㅁ", example: "협력" },
        },
      },
      {
        position: "initial",
        when: "ㅁ or ㅇ",
        neighbors: ["ㅁ", "ㅇ"],
        frequency: 1,
        targets: { ㄹ: { becomes: "[ㄴ] n", result: "ㄴ", example: "종로" } },
      },
      {
        position: "initial",
        when: "ㄱ or ㅂ",
        neighbors: ["ㄱ", "ㅂ"],
        frequency: 2,
        targets: { ㄹ: { becomes: "[ㄴ] n, and the final becomes nasal", result: "ㄴ", example: "국립" } },
      },
    ],
  },
  {
    id: "liquidization",
    title: "ㄹ assimilation",
    koreanTitle: "유음화",
    reference: "표준 발음법 제20항",
    explanation: "When ㄴ and ㄹ meet, in either order, the ㄴ is usually pronounced as [ㄹ], giving a clear double l.",
    formulas: ["ㄴ + ㄹ → [ㄹ + ㄹ]", "ㄹ + ㄴ → [ㄹ + ㄹ]"],
    examples: [{ word: "신라" }, { word: "연락" }, { word: "난로" }, { word: "설날" }, { word: "한라산" }],
    notes: [
      "Exception: in some compound words, ㄴ + ㄹ becomes [ㄴ + ㄴ] instead: 의견란 [의견난], 생산량 [생산냥], 결단력 [결딴녁]. These have to be learned word by word.",
    ],
    changes: [
      {
        position: "final",
        when: "ㄹ",
        neighbors: ["ㄹ"],
        frequency: 1,
        targets: { ㄴ: { becomes: "[ㄹ] l", result: "ㄹ", example: "신라" } },
      },
      {
        position: "initial",
        when: "ㄹ",
        neighbors: ["ㄹ"],
        frequency: 1,
        targets: { ㄴ: { becomes: "[ㄹ] l", result: "ㄹ", example: "설날" } },
      },
      {
        position: "initial",
        when: "ㄴ",
        neighbors: ["ㄴ"],
        frequency: 1,
        targets: { ㄹ: { becomes: "l (the ㄴ before it becomes [ㄹ] too)", example: "연락" } },
      },
      {
        position: "final",
        when: "ㄴ",
        neighbors: ["ㄴ"],
        frequency: 1,
        targets: { ㄹ: { becomes: "l (the ㄴ after it becomes [ㄹ])", example: "설날" } },
      },
      {
        position: "initial",
        when: "ㄴ, in some compound words",
        neighbors: ["ㄴ"],
        frequency: 3,
        targets: { ㄹ: { becomes: "[ㄴ] n (exception)", result: "ㄴ", example: "생산량" } },
      },
    ],
  },
  {
    id: "tensification",
    title: "Tensification",
    koreanTitle: "경음화",
    reference: "표준 발음법 제23–28항",
    explanation:
      "After the final sounds [ㄱ], [ㄷ], [ㅂ], a following ㄱ, ㄷ, ㅂ, ㅅ or ㅈ becomes tense: ㄲ, ㄸ, ㅃ, ㅆ, ㅉ. This happens almost every time, so it's worth making automatic.",
    formulas: ["[ㄱ ㄷ ㅂ] + ㄱ ㄷ ㅂ ㅅ ㅈ → [ㄱ ㄷ ㅂ] + ㄲ ㄸ ㅃ ㅆ ㅉ"],
    examples: [
      { word: "학교" },
      { word: "식당" },
      { word: "잡지" },
      { word: "책상" },
      { word: "갈등", note: "Sino-Korean ㄹ + ㄷ (제26항)" },
    ],
    notes: [
      "Revised Romanization doesn't show tensification: 학교 is written hakgyo, not hakkkyo.",
      "Tensification also happens in other places: after verb stems ending in ㄴ/ㅁ (신고 [신꼬] “wearing (shoes)”, 앉다 [안따]); after ㄹ in Sino-Korean words before ㄷ/ㅅ/ㅈ (갈등 [갈뜽], 발달 [발딸]); after the future/adnominal -(으)ㄹ (할 수 [할쑤]); and in many compound words (문고리 [문꼬리]). These cases are less predictable — a dictionary shows the pronunciation.",
    ],
    changes: [
      {
        position: "initial",
        when: "a k/t/p-sounding final (ㄱ, ㄷ, ㅂ types)",
        neighbors: KTP_FINALS,
        frequency: 1,
        targets: {
          ㄱ: { becomes: "[ㄲ] tense", result: "ㄲ", example: "학교" },
          ㄷ: { becomes: "[ㄸ] tense", result: "ㄸ", example: "식당" },
          ㅂ: { becomes: "[ㅃ] tense", result: "ㅃ", example: "국밥" },
          ㅅ: { becomes: "[ㅆ] tense", result: "ㅆ", example: "책상" },
          ㅈ: { becomes: "[ㅉ] tense", result: "ㅉ", example: "잡지" },
        },
      },
      {
        position: "final",
        when: "ㄱ ㄷ ㅂ ㅅ ㅈ",
        neighbors: ["ㄱ", "ㄷ", "ㅂ", "ㅅ", "ㅈ"],
        frequency: 1,
        targets: {
          ㄱ: { becomes: "unreleased k; next sound becomes tense", example: "학교" },
          ㄲ: { becomes: "[ㄱ]; next sound becomes tense", result: "ㄱ", example: "깎다" },
          ㅋ: { becomes: "[ㄱ]; next sound becomes tense", result: "ㄱ", example: "부엌도" },
          ㄷ: { becomes: "unreleased t; next sound becomes tense", example: "듣고" },
          ㅅ: { becomes: "[ㄷ]; next sound becomes tense", result: "ㄷ", example: "옷걸이" },
          ㅆ: { becomes: "[ㄷ]; next sound becomes tense", result: "ㄷ", example: "갔다" },
          ㅈ: { becomes: "[ㄷ]; next sound becomes tense", result: "ㄷ", example: "낮잠" },
          ㅊ: { becomes: "[ㄷ]; next sound becomes tense", result: "ㄷ", example: "꽃집" },
          ㅌ: { becomes: "[ㄷ]; next sound becomes tense", result: "ㄷ", example: "밭도" },
          ㅂ: { becomes: "unreleased p; next sound becomes tense", example: "잡지" },
          ㅍ: { becomes: "[ㅂ]; next sound becomes tense", result: "ㅂ", example: "앞길" },
        },
      },
      {
        position: "initial",
        when: "ㄴ or ㅁ ending a verb stem",
        neighbors: ["ㄴ", "ㅁ"],
        frequency: 2,
        targets: {
          ㄱ: { becomes: "[ㄲ] tense", result: "ㄲ", example: "신고" },
          ㄷ: { becomes: "[ㄸ] tense", result: "ㄸ", example: "껴안다" },
        },
      },
      {
        position: "initial",
        when: "ㄹ, in Sino-Korean words",
        neighbors: ["ㄹ"],
        frequency: 2,
        targets: {
          ㄷ: { becomes: "[ㄸ] tense", result: "ㄸ", example: "갈등" },
          ㅅ: { becomes: "[ㅆ] tense", result: "ㅆ", example: "일시" },
          ㅈ: { becomes: "[ㅉ] tense", result: "ㅉ", example: "발전" },
        },
      },
      {
        position: "initial",
        when: "the ending -(으)ㄹ (future/modifier)",
        neighbors: ["ㄹ"],
        frequency: 3,
        targets: {
          ㄱ: { becomes: "[ㄲ] tense", result: "ㄲ", example: "할 것을" },
          ㄷ: { becomes: "[ㄸ] tense", result: "ㄸ", example: "갈 데가" },
          ㅂ: { becomes: "[ㅃ] tense", result: "ㅃ", example: "할 바를" },
          ㅅ: { becomes: "[ㅆ] tense", result: "ㅆ", example: "할 수는" },
          ㅈ: { becomes: "[ㅉ] tense", result: "ㅉ", example: "할 적에" },
        },
      },
    ],
  },
  {
    id: "aspiration",
    title: "Aspiration",
    koreanTitle: "격음화 (거센소리되기)",
    reference: "표준 발음법 제12항",
    explanation:
      "When ㅎ meets ㄱ, ㄷ, ㅂ or ㅈ (in either order), they merge into the aspirated consonant: ㅋ, ㅌ, ㅍ, ㅊ.",
    formulas: ["ㅎ + ㄱ/ㄷ/ㅈ → [ㅋ/ㅌ/ㅊ]", "ㄱ/ㄷ/ㅂ/ㅈ + ㅎ → [ㅋ/ㅌ/ㅍ/ㅊ]"],
    examples: [
      { word: "좋다" },
      { word: "많다", note: "ㄶ + ㄷ" },
      { word: "놓고" },
      { word: "잡혀요" },
      { word: "입학", note: "noun: RR keeps the h" },
    ],
    notes: [
      "Romanization: in nouns, RR writes ㅎ after ㄱ/ㄷ/ㅂ as h even though it's pronounced aspirated (입학 iphak, 묵호 Mukho). In verbs and adjectives the aspiration is written (좋다 jota, 잡혀 japyeo).",
      "Very common in everyday verb forms: 축하해요 [추카해요], 못해요 [모태요] (ㅅ → [ㄷ], then + ㅎ → [ㅌ]).",
    ],
    changes: [
      {
        position: "initial",
        when: "ㅎ (also ㄶ, ㅀ)",
        neighbors: ["ㅎ"],
        frequency: 1,
        targets: {
          ㄱ: { becomes: "[ㅋ] aspirated", result: "ㅋ", example: "좋고" },
          ㄷ: { becomes: "[ㅌ] aspirated", result: "ㅌ", example: "좋다" },
          ㅈ: { becomes: "[ㅊ] aspirated", result: "ㅊ", example: "좋지" },
        },
      },
      {
        position: "initial",
        when: "ㄱ, ㄷ, ㅂ, ㅈ (and ㅅ-type) finals",
        neighbors: ["ㄱ", "ㄷ", "ㅂ", "ㅈ", "ㅅ"],
        frequency: 1,
        targets: { ㅎ: { becomes: "merges: ㄱ→ㅋ, ㄷ→ㅌ, ㅂ→ㅍ, ㅈ→ㅊ", example: "잡혀요" } },
      },
      {
        position: "final",
        when: "ㅎ",
        neighbors: ["ㅎ"],
        frequency: 1,
        targets: {
          ㄱ: { becomes: "[ㅋ] (merges with the ㅎ)", result: "ㅋ", example: "착하다" },
          ㅂ: { becomes: "[ㅍ] (merges with the ㅎ)", result: "ㅍ", example: "잡혀요" },
          ㅅ: { becomes: "[ㅌ] (merges with the ㅎ)", result: "ㅌ", example: "못해요" },
          ㅈ: { becomes: "[ㅊ] (merges with the ㅎ)", result: "ㅊ", example: "꽂히다" },
        },
      },
      {
        position: "final",
        when: "ㄱ ㄷ ㅈ",
        neighbors: ["ㄱ", "ㄷ", "ㅈ"],
        frequency: 1,
        targets: { ㅎ: { becomes: "merges: next becomes ㅋ/ㅌ/ㅊ", example: "좋다" } },
      },
    ],
  },
  {
    id: "palatalization",
    title: "Palatalization",
    koreanTitle: "구개음화",
    reference: "표준 발음법 제17항",
    explanation:
      "A final ㄷ or ㅌ followed by a grammatical ending or particle starting with 이 is pronounced [ㅈ] or [ㅊ]. With ㄷ + 히, the result is [ㅊ].",
    formulas: ["ㄷ + 이 → [지]", "ㅌ + 이 → [치]", "ㄷ + 히 → [치]"],
    examples: [{ word: "같이" }, { word: "굳이" }, { word: "해돋이" }, { word: "밭이" }, { word: "닫히다" }],
    notes: [
      "It only happens when 이/히 is an ending, suffix or particle — not inside a single word: 잔디 and 마디 keep [디].",
    ],
    changes: [
      {
        position: "final",
        when: "the ending or particle 이",
        neighbors: ["ㅣ"],
        frequency: 1,
        targets: {
          ㄷ: { becomes: "[ㅈ] j", result: "ㅈ", example: "굳이" },
          ㅌ: { becomes: "[ㅊ] ch", result: "ㅊ", example: "같이" },
        },
      },
      {
        position: "final",
        when: "the suffix 히",
        neighbors: ["ㅎ", "ㅣ"],
        frequency: 2,
        targets: { ㄷ: { becomes: "[ㅊ] ch (merges with the ㅎ)", result: "ㅊ", example: "닫히다" } },
      },
    ],
  },
  {
    id: "h-dropping",
    title: "ㅎ dropping and weakening",
    koreanTitle: "ㅎ 탈락",
    reference: "표준 발음법 제12항",
    explanation:
      "A final ㅎ (including in ㄶ and ㅀ) is silent when the next syllable starts with a vowel. Before ㄴ, a final ㅎ is pronounced [ㄴ]; before ㅅ, it turns the ㅅ into [ㅆ].",
    formulas: ["ㅎ + vowel → ㅎ silent", "ㅎ + ㄴ → [ㄴ + ㄴ]", "ㅎ + ㅅ → [ㅆ]"],
    examples: [{ word: "좋아요" }, { word: "많아요" }, { word: "싫어요" }, { word: "괜찮아요" }, { word: "놓는" }],
    notes: [
      "With ㄶ/ㅀ before ㄴ, the ㅎ is simply dropped: 않네 [안네], 뚫네 [뚤레] (then ㄹ assimilation).",
      "Weakening: in casual speech, ㅎ between voiced sounds often becomes very faint (전화 can sound like [저놔], 은행 like [으냉]). The standard pronunciation keeps the ㅎ: [전화], [은행].",
    ],
    changes: [
      {
        position: "final",
        when: "a vowel (next syllable starts with silent ㅇ)",
        neighbors: ["ㅇ"],
        frequency: 1,
        targets: { ㅎ: { becomes: "silent", example: "좋아요" } },
      },
      {
        position: "initial",
        when: "ㅎ (also ㄶ, ㅀ)",
        neighbors: ["ㅎ"],
        frequency: 1,
        targets: { ㅇ: { becomes: "stays silent; the ㅎ drops", example: "좋아요" } },
      },
      {
        position: "final",
        when: "ㄴ",
        neighbors: ["ㄴ"],
        frequency: 2,
        targets: { ㅎ: { becomes: "[ㄴ] n", result: "ㄴ", example: "놓는" } },
      },
      {
        position: "final",
        when: "ㅅ",
        neighbors: ["ㅅ"],
        frequency: 2,
        targets: { ㅎ: { becomes: "silent; the ㅅ becomes [ㅆ]", example: "좋습니다" } },
      },
      {
        position: "initial",
        when: "ㅎ",
        neighbors: ["ㅎ"],
        frequency: 2,
        targets: { ㅅ: { becomes: "[ㅆ] tense", result: "ㅆ", example: "좋습니다" } },
      },
      {
        position: "initial",
        when: "a vowel or ㄴ ㅁ ㅇ ㄹ (casual speech)",
        neighbors: ["ㄴ", "ㅁ", "ㅇ", "ㄹ"],
        frequency: 3,
        targets: {
          ㅎ: {
            becomes: "often faint",
            example: "전화",
            note: "standard keeps [ㅎ]; casually it can sound like [저놔]",
          },
        },
      },
    ],
  },
];

/**
 * Context-dependent sounds that aren't one of the rule cards above: the basic (allophonic) sounds of
 * plain consonants, and vowel variants from 표준 발음법 제5항. Also used to generate the tables.
 */
export const BASIC_CHANGES: BasicSoundChange[] = [
  {
    position: "initial",
    when: "start of a word",
    frequency: 1,
    targets: {
      ㄱ: { becomes: "light k (little breath)", example: "가방" },
      ㄷ: { becomes: "light t (little breath)", example: "다리" },
      ㅂ: { becomes: "light p (little breath)", example: "바다" },
      ㅈ: { becomes: "light ch (little breath)", example: "자다" },
    },
  },
  {
    position: "initial",
    when: "a vowel, or ㄴ ㅁ ㅇ ㄹ",
    neighbors: ["ㄴ", "ㅁ", "ㅇ", "ㄹ"],
    frequency: 1,
    targets: {
      ㄱ: { becomes: "g (voiced)", example: "아기" },
      ㄷ: { becomes: "d (voiced)", example: "구두" },
      ㅂ: { becomes: "b (voiced)", example: "두부" },
      ㅈ: { becomes: "j (voiced)", example: "여자" },
    },
  },
  {
    position: "initial",
    when: "a vowel",
    frequency: 1,
    targets: { ㄹ: { becomes: "r (quick tap)", example: "사랑" } },
  },
  {
    position: "initial",
    when: "ㄹ",
    neighbors: ["ㄹ"],
    frequency: 1,
    targets: { ㄹ: { becomes: "l (ㄹㄹ is a clear l)", example: "빨리" } },
  },
  {
    position: "initial",
    when: "start of a word (mostly loanwords)",
    frequency: 2,
    targets: { ㄹ: { becomes: "r/l", example: "라면" } },
  },
  {
    // Letters whose first sound doesn't change: one baseline row each (shown as a one-line summary).
    position: "initial",
    when: "start of a word, or a vowel",
    frequency: 1,
    targets: {
      ㄴ: { becomes: "n", example: "나무" },
      ㅁ: { becomes: "m", example: "마음" },
      ㅅ: { becomes: "s", example: "사과" },
      ㅊ: { becomes: "ch (strong breath)", example: "차" },
      ㅋ: { becomes: "k (strong breath)", example: "코" },
      ㅌ: { becomes: "t (strong breath)", example: "토끼" },
      ㅍ: { becomes: "p (strong breath)", example: "파" },
      ㅎ: { becomes: "h", example: "하나" },
      ㄲ: { becomes: "kk (tense)", example: "까치" },
      ㄸ: { becomes: "tt (tense)", example: "딸" },
      ㅃ: { becomes: "pp (tense)", example: "빵" },
      ㅆ: { becomes: "ss (tense)", example: "싸다" },
      ㅉ: { becomes: "jj (tense)", example: "짜다" },
    },
  },
  // ---- vowels (표준 발음법 제5항)
  {
    position: "vowel",
    when: "first syllable, with no consonant before it",
    frequency: 1,
    reference: "표준 발음법 제5항",
    targets: { ㅢ: { becomes: "[의] ui", example: "의사" } },
  },
  {
    position: "vowel",
    when: "after a consonant",
    frequency: 1,
    reference: "표준 발음법 제5항",
    targets: {
      ㅢ: { becomes: "[ㅣ] i", result: "ㅣ", example: "희망" },
      ㅖ: { becomes: "[ㅖ] or [ㅔ]", example: "시계", note: "except after ㄹ (례 is always [례])" },
    },
  },
  {
    position: "vowel",
    when: "the particle 의 (“of”)",
    frequency: 1,
    reference: "표준 발음법 제5항",
    targets: { ㅢ: { becomes: "[의] or [에]", example: "우리의" } },
  },
  {
    position: "vowel",
    when: "a later syllable (not the first)",
    frequency: 2,
    reference: "표준 발음법 제5항",
    targets: { ㅢ: { becomes: "[의] or [이]", example: "주의" } },
  },
  {
    position: "vowel",
    when: "with silent ㅇ (예) or after ㄹ (례)",
    frequency: 1,
    reference: "표준 발음법 제5항",
    targets: { ㅖ: { becomes: "always [ㅖ] ye", example: "차례" } },
  },
];

export function ruleById(id: string): PronunciationRule | undefined {
  return RULES.find((r) => r.id === id);
}

export const RULE_IDS = RULES.map((r) => r.id) as RuleId[];
