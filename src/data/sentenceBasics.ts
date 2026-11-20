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
    example: string;
    /** One particle with several uses, listed under its label. */ uses?: string[];
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
  verb: "verb",
  adjective: "adjective",
  noun: "noun",
  ending: "ending",
};

export const SENTENCE_BASICS: BasicsTopic[] = [
  {
    id: "order",
    title: "The verb goes last",
    short: "Word order",
    ko: "어순",
    explain:
      "English puts the action in the middle: I drink coffee. Korean saves it for the very end: I coffee drink. You first hear who, where and what, and only the last word tells you what happens. So when you listen or read, keep going to the end: that last word is the action, and its ending says when it happened and whether it's a question.",
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
      {
        parts: [
          { ko: "친구가", gloss: "my friend", role: "subject" },
          { ko: "도서관에서", gloss: "at the library", role: "place" },
          { ko: "책을", gloss: "a book", role: "object" },
          { ko: "읽어요", gloss: "reads", role: "verb" },
        ],
        en: "My friend reads a book at the library.",
        rom: "chinguga doseogwaneseo chaegeul ilgeoyo",
      },
    ],
    note: "The words before the verb can swap places: 커피를 저는 마셔요 still means \"I drink coffee\". That works because each noun wears a little tag (a particle, step 2) saying what its job is. Only the verb has a fixed seat, at the end. Words that are obvious are simply left out, even \"I\" and \"you\": 먹었어요? alone means \"Did you eat?\". Often the verb is the whole sentence.",
  },
  {
    id: "particles",
    title: "Particles: tags that show each noun's job",
    short: "Particles",
    ko: "조사",
    explain:
      "In English, position tells you the job: \"the dog bites the man\" and \"the man bites the dog\" are different stories. Korean sticks a small label, a particle, onto the end of each noun instead. 커피를 is 커피 (coffee) + 를, a label meaning \"this is what gets done to\". The label travels with the noun, so the meaning stays the same wherever the noun sits in the sentence.",
    examples: [
      {
        parts: [
          {
            ko: "비가",
            particle: "가",
            gloss: "rain",
            tag: "subject marker",
            role: "subject",
          },
          { ko: "와요", gloss: "comes", role: "verb" },
        ],
        en: "It's raining.",
        rom: "biga wayo",
      },
      {
        parts: [
          {
            ko: "주말에",
            particle: "에",
            gloss: "weekend",
            tag: "at (a time)",
            role: "time",
          },
          {
            ko: "집에서",
            particle: "에서",
            gloss: "home",
            tag: "at (doing something)",
            role: "place",
          },
          {
            ko: "영화를",
            particle: "를",
            gloss: "movie",
            tag: "object marker",
            role: "object",
          },
          { ko: "봐요", gloss: "watch", role: "verb" },
        ],
        en: "I watch movies at home at the weekend.",
        rom: "jumare jibeseo yeonghwareul bwayo",
      },
    ],
    tableIntro:
      "Some particles come in pairs (은/는, 이/가, 을/를), and the noun's last sound picks one. Ends in a consonant (책 book): use the first form, which starts with a vowel, 책은. Ends in a vowel (저 I): use the second, which starts with a consonant, 저는. Either way the sounds alternate, so it's easy to say.",
    table: [
      {
        ko: "은/는",
        label: 'topic: "as for…", what the sentence is about',
        example: "책은 (책 ends in ㄱ) · 저는 (저 ends in a vowel)",
      },
      {
        ko: "이/가",
        label: "subject: who or what does the verb (비가 와요: the rain comes)",
        example: "책이 (ends in ㄱ) · 비가 (ends in a vowel)",
      },
      {
        ko: "을/를",
        label:
          "object: what the verb is done to (커피를 마셔요: coffee is what's drunk)",
        example: "책을 (ends in ㄱ) · 커피를 (ends in a vowel)",
      },
      {
        ko: "에",
        label: "one particle, two uses:",
        uses: [
          "to: where you go (학교에 가요: I go to school)",
          "at / on: when something happens (3시에: at 3 o'clock)",
        ],
        example: "학교에 · 3시에",
      },
      {
        ko: "에서",
        label: "where the verb happens (집에서 공부해요: study at home)",
        example: "집에서 공부해요",
      },
    ],
    note: "은/는 or 이/가? Think of 은/는 as \"as for…\": it sets the scene for what you're about to say (저는 학생이에요, as for me, I'm a student). 이/가 points a finger at who or what is doing something, often something new (비가 와요, rain is coming). When in doubt, use 저는 for yourself and 이/가 for things that happen. In casual speech particles are often dropped when it's obvious: 커피 마셔요.",
  },
  {
    id: "types",
    title: "Three kinds of sentences",
    short: "Sentence types",
    ko: "문장 유형",
    explain:
      'Every sentence ends by doing, describing or identifying. Korean adjectives have "is" built in: 맛있다 means "to be tasty", so 커피가 맛있어요 is literally "coffee is-tasty".',
    examples: [
      {
        heading: "Doing: what someone does",
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
          { ko: "커피가", gloss: "the coffee", role: "subject" },
          { ko: "맛있어요", gloss: "is tasty", role: "adjective" },
        ],
        en: "The coffee is tasty.",
        rom: "keopiga masisseoyo",
      },
      {
        heading: "Identifying: what something is",
        pattern: "noun은/는 + noun이에요/예요",
        parts: [
          { ko: "저는", gloss: "I", role: "topic" },
          { ko: "학생이에요", gloss: "am a student", role: "noun" },
        ],
        en: "I'm a student.",
        rom: "jeoneun haksaengieyo",
      },
    ],
    note: "이에요 after a consonant (학생이에요), 예요 after a vowel (의사예요). 있어요 / 없어요 (there is, have / there isn't, don't have) work like describing words: 시간이 없어요, I don't have time. To put a describing word before a noun, change its ending: 맛있어요 → 맛있는 커피 (tasty coffee). More in step 4.",
  },
  {
    id: "stems",
    title: "Verbs keep their start and change their end",
    short: "Verb endings",
    ko: "어간과 어미",
    explain:
      "In English, walk becomes walked or walking: the start stays and the end changes. Korean verbs all work like this. Take the dictionary form 먹다 (to eat), drop the 다, and you have the stem 먹, which never changes. Then snap an ending onto it. The ending says when it happens, how polite you are, and extras like \"want to\". Each grammar pattern further down is one of these endings.",
    examples: [
      {
        parts: [
          { ko: "먹", gloss: "eat (stem)", role: "verb" },
          { ko: "어요", gloss: "now, polite", role: "ending" },
        ],
        en: "I eat.",
        rom: "meogeoyo",
        oneWord: true,
      },
      {
        parts: [
          { ko: "먹", gloss: "eat (stem)", role: "verb" },
          { ko: "었어요", gloss: "past, polite", role: "ending" },
        ],
        en: "I ate.",
        rom: "meogeosseoyo",
        oneWord: true,
      },
    ],
    tableIntro: "Same stem 먹, different endings, different meaning:",
    note: "어요 or 아요? Look at the stem's last vowel: ㅏ or ㅗ takes 아요 (가다 → 가요, 보다 → 봐요), anything else takes 어요 (먹다 → 먹어요). Many endings pick their form by this same rule.",
    table: [
      { ko: "먹어요", label: "eat (polite, now)", example: "-아요/어요" },
      { ko: "먹었어요", label: "ate", example: "-았/었-" },
      { ko: "먹을 거예요", label: "will eat", example: "-(으)ㄹ 거예요" },
      { ko: "먹고 싶어요", label: "want to eat", example: "-고 싶다" },
      {
        ko: "먹는 음식",
        label: "the food I eat: lets the verb sit before a noun (맛있는 커피, tasty coffee)",
        example: "-는",
      },
      {
        ko: "먹고 마셔요",
        label: "eat and drink: links two actions, only the last one ends the sentence",
        example: "-고",
      },
    ],
  },
];
