/**
 * Grammar page, "Sentence basics": how a Korean sentence is built, before any grammar pattern.
 * Each topic has a short explanation and example sentences broken into their parts.
 */

/** What a part of a sentence is doing (each has its own colour on the page). */
export type PartRole =
  | "topic"
  | "subject"
  | "object"
  | "place"
  | "time"
  | "verb"
  | "adjective"
  | "noun"
  | "stem"
  | "ending";

export interface SentencePart {
  ko: string;
  /** The particle at the end of `ko` (비가 → 가), shown apart so you can see the tag. */
  particle?: string;
  /** What the particle adds ("at (a time)"); `gloss` is then the noun's own meaning. */
  tag?: string;
  /** What it is, in a word or two ("topic", "is tasty"). */
  gloss: string;
  role: PartRole;
}

export interface BasicsExample {
  parts: SentencePart[];
  en: string;
  /** How the whole sentence is read (Revised Romanization, as the Reader shows it). */
  rom: string;
  /** The parts are pieces of one word (stem + ending): written together, without spaces. */
  oneWord?: boolean;
  /** A label above the example, e.g. "Doing". */
  heading?: string;
  /** The sentence's shape, e.g. "noun을/를 + verb". */
  pattern?: string;
}

export interface BasicsTopic {
  id: string;
  title: string;
  /** For the step row, e.g. "Word order". */
  short: string;
  ko: string;
  /** One or two plain sentences. */
  explain: string;
  examples: BasicsExample[];
  /** Small reference rows under the examples, e.g. the particles and when each form is used. */
  table?: {
    ko: string;
    label: string;
    /** A second, smaller line (e.g. which form goes after a consonant). */
    example?: string;
    /** One particle with several uses, listed under its label. */ uses?: string[];
    /** `ko` is an ending (-어요): shown as written, without word bubbles (its 을 isn't the tag). */
    ending?: boolean;
    /** How `ko` is read, shown small under it. */
    rom?: string;
  }[];
  /** A line above the table (e.g. which form goes after a consonant or a vowel). */
  tableIntro?: string;
  note?: string;
}

export const ROLE_LABELS: Record<PartRole, string> = {
  topic: "topic",
  subject: "subject",
  object: "object",
  place: "place",
  time: "time",
  verb: "action",
  adjective: "description",
  noun: 'noun + "is"',
  stem: "stem",
  ending: "ending",
};

export const SENTENCE_BASICS: BasicsTopic[] = [
  {
    id: "types",
    title: "Three kinds of sentences",
    short: "Sentence types",
    ko: "문장 유형",
    explain:
      'Every Korean sentence is one of these three types: doing, describing or identifying. The last word decides which: an action, a description, or a noun + "is". Korean adjectives have "is" built in: 맛있어요 alone means "is tasty". The tags in the patterns (을/를, 이/가, 은/는) come in step 2.',
    examples: [
      {
        heading: "Doing: what something does",
        pattern: "noun을/를 + verb",
        parts: [
          { ko: "저는", gloss: "I", role: "topic" },
          { ko: "커피를", gloss: "coffee", role: "object" },
          { ko: "마셔요", gloss: "drink", role: "verb" },
        ],
        en: "I drink coffee.",
        rom: "jeoneun keopireul masyeoyo",
      },
      {
        heading: "Describing: what something is like",
        pattern: "noun이/가 + adjective",
        parts: [
          {
            ko: "커피가",
            gloss: "the coffee",
            role: "subject",
          },
          { ko: "맛있어요", gloss: "is tasty", role: "adjective" },
        ],
        en: "The coffee is tasty.",
        rom: "keopiga masisseoyo",
      },
      {
        heading: "Identifying: what something is",
        pattern: "noun은/는 + noun이에요/예요",
        parts: [
          { ko: "이건", gloss: "this", role: "topic" },
          { ko: "커피예요", gloss: "is coffee", role: "noun" },
        ],
        en: "This is coffee.",
        rom: "igeon keopiyeyo",
      },
    ],
    note: "이에요 after a consonant (학생이에요), 예요 after a vowel (의사예요). 있어요 (there is, I have) and 없어요 (there isn't, I don't have) work like descriptions: 시간이 없어요, I don't have time.",
  },
  {
    id: "particles",
    title: "Particles: tags that show each noun's job",
    short: "Noun particles",
    ko: "조사",
    explain:
      'English shows each noun\'s job by its position: "the dog bites the man" isn\'t "the man bites the dog". Korean sticks a small tag, a particle, on the end of the noun instead: 커피를 is 커피 (coffee) + 를 (the thing acted on). The tag travels with the noun.',
    examples: [
      {
        parts: [
          {
            ko: "커피가",
            particle: "가",
            gloss: "coffee",
            tag: "subject tag",
            role: "subject",
          },
          { ko: "맛있어요", gloss: "is tasty", role: "adjective" },
        ],
        en: "The coffee is tasty.",
        rom: "keopiga masisseoyo",
      },
      {
        parts: [
          {
            ko: "아침에",
            particle: "에",
            gloss: "morning",
            tag: "at (a time)",
            role: "time",
          },
          {
            ko: "카페에서",
            particle: "에서",
            gloss: "café",
            tag: "at (doing something)",
            role: "place",
          },
          {
            ko: "커피를",
            particle: "를",
            gloss: "coffee",
            tag: "object tag",
            role: "object",
          },
          { ko: "마셔요", gloss: "drink", role: "verb" },
        ],
        en: "I drink coffee at a café in the morning.",
        rom: "achime kapeeseo keopireul masyeoyo",
      },
    ],
    table: [
      {
        ko: "은/는",
        rom: "eun / neun",
        label: 'topic: "as for…", what the sentence is about',
        example: "저는, as for me · after a consonant: 은 (책은)",
      },
      {
        ko: "이/가",
        rom: "i / ga",
        label: "subject: who does the action, or what is being described",
        example: "비가 와요, the rain comes · after a consonant: 이 (책이)",
      },
      {
        ko: "을/를",
        rom: "eul / reul",
        label: "object: what an action is done to",
        example: "커피를 마셔요, I drink coffee · after a consonant: 을 (책을)",
      },
      {
        ko: "에",
        rom: "e",
        label: "to a place, or at a time",
        example: "학교에 가요, I go to school · 3시에, at 3 o'clock",
      },
      {
        ko: "에서",
        rom: "eseo",
        label: "at: where an action happens",
        example: "집에서 공부해요, I study at home",
      },
    ],
    note: "은/는 or 이/가? 은/는 means \"as for…\" and sets the scene (저는 학생이에요, as for me, I'm a student). 이/가 points at who or what does or is something (비가 와요, it's raining). In casual speech tags are often dropped: 커피 마셔요.",
  },
  {
    id: "order",
    title: "The main word goes last",
    short: "Word order",
    ko: "어순",
    explain:
      "English puts the main word in the middle: I drink coffee. Korean saves it for the end: I coffee drink. Everything else comes first, so keep reading to the last word: it says what happens, and its ending says when.",
    examples: [
      {
        parts: [
          { ko: "저는", gloss: "I", role: "topic" },
          { ko: "커피를", gloss: "coffee", role: "object" },
          { ko: "마셔요", gloss: "drink", role: "verb" },
        ],
        en: "I drink coffee.",
        rom: "jeoneun keopireul masyeoyo",
      },
    ],
    note: 'The words before it can move around freely, because their tags (step 2) carry their jobs. Obvious words are often left out, even "I" and "you": 먹었어요? alone means "Did you eat?"',
  },
  {
    id: "stems",
    title: "Verbs keep their start and change their end",
    short: "Verb endings",
    ko: "어간과 어미",
    explain:
      'Like walk → walked, a Korean verb keeps its start (the stem) and changes its end. Drop 다 from the dictionary form 먹다 (to eat) to get the stem 먹, then add an ending for when, how polite, or extras like "want to". The grammar patterns below are these endings.',
    examples: [
      {
        parts: [
          { ko: "먹", gloss: "eat", role: "stem" },
          { ko: "어요", gloss: "now, polite", role: "ending" },
        ],
        en: "I eat.",
        rom: "meogeoyo",
        oneWord: true,
      },
      {
        parts: [
          { ko: "먹", gloss: "eat", role: "stem" },
          { ko: "었어요", gloss: "past, polite", role: "ending" },
        ],
        en: "I ate.",
        rom: "meogeosseoyo",
        oneWord: true,
      },
    ],
    tableIntro: "Each ending adds a meaning. Here they're on 먹 (eat):",
    note: "어요 or 아요? Look at the stem's last vowel: ㅏ or ㅗ takes 아요 (가다 → 가요, 보다 → 봐요), anything else takes 어요 (먹다 → 먹어요). Many endings pick their form by this same rule.",
    table: [
      {
        ending: true,
        ko: "-어요",
        rom: "-eoyo",
        label: "now, polite",
        example: "먹어요, I eat · after ㅏ or ㅗ: -아요 (가요, I go)",
      },
      {
        ending: true,
        ko: "-었어요",
        rom: "-eosseoyo",
        label: "past, polite",
        example: "먹었어요, I ate · after ㅏ or ㅗ: -았어요 (갔어요, I went)",
      },
      {
        ending: true,
        ko: "-을 거예요",
        rom: "-eul geoyeyo",
        label: "will",
        example:
          "먹을 거예요, I will eat · after a vowel: -ㄹ 거예요 (갈 거예요)",
      },
      {
        ending: true,
        ko: "-고 싶어요",
        rom: "-go sipeoyo",
        label: "want to",
        example: "먹고 싶어요, I want to eat",
      },
      {
        ending: true,
        ko: "-는",
        rom: "-neun",
        label: "lets the verb sit before a noun",
        example: "먹는 음식, the food I eat",
      },
      {
        ending: true,
        ko: "-고",
        rom: "-go",
        label: "and: links two actions (only the last one ends the sentence)",
        example: "먹고 마셔요, I eat and drink",
      },
    ],
  },
];
