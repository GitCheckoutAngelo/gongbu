/**
 * Grammar → Sentence basics: how each Korean word on the page is read and what it means,
 * shown when you hover or tap it. Words not listed here are shown without a bubble.
 */
export interface GlossEntry {
  /** Revised Romanization, as the Reader shows it. */
  rom: string;
  en: string;
}

export const BASICS_GLOSSARY: Record<string, GlossEntry> = {
  // People and things
  저: { rom: "jeo", en: "I (polite)" },
  저는: { rom: "jeoneun", en: "I (저) + topic tag (는)" },
  제: { rom: "je", en: "my (polite)" },
  친구: { rom: "chingu", en: "friend" },
  친구가: { rom: "chinguga", en: "friend (친구) + subject tag (가)" },
  친구는: { rom: "chinguneun", en: "friend (친구) + topic tag (는)" },
  동생이: {
    rom: "dongsaengi",
    en: "younger sibling (동생) + subject tag (이)",
  },
  커피: { rom: "keopi", en: "coffee" },
  커피가: { rom: "keopiga", en: "coffee (커피) + subject tag (가)" },
  커피를: { rom: "keopireul", en: "coffee (커피) + object tag (를)" },
  책: { rom: "chaek", en: "book" },
  책은: { rom: "chaegeun", en: "book (책) + topic tag (은)" },
  책이: { rom: "chaegi", en: "book (책) + subject tag (이)" },
  책을: { rom: "chaegeul", en: "book (책) + object tag (을)" },
  학교: { rom: "hakgyo", en: "school" },
  학교에: { rom: "hakgyoe", en: "school (학교) + to (에)" },
  집에서: { rom: "jibeseo", en: "home (집) + at (에서)" },
  도서관에서: { rom: "doseogwaneseo", en: "library (도서관) + at (에서)" },
  학생: { rom: "haksaeng", en: "student" },
  의사: { rom: "uisa", en: "doctor" },
  비가: { rom: "biga", en: "rain (비) + subject tag (가)" },
  시간이: { rom: "sigani", en: "time (시간) + subject tag (이)" },
  음식: { rom: "eumsik", en: "food" },
  밥을: { rom: "babeul", en: "rice, a meal (밥) + object tag (을)" },
  날씨가: { rom: "nalssiga", en: "the weather (날씨) + subject tag (가)" },
  이것은: { rom: "igeoseun", en: "this (이것) + topic tag (은)" },
  방이: { rom: "bangi", en: "the room (방) + subject tag (이)" },
  한국어가: {
    rom: "hangugeoga",
    en: "the Korean language (한국어) + subject tag (가)",
  },
  오늘은: { rom: "oneureun", en: "today (오늘) + topic tag (은)" },
  오늘: { rom: "oneul", en: "today" },
  이건: { rom: "igeon", en: "this (이거) + topic tag (ㄴ, short for 은)" },
  아침에: { rom: "achime", en: "morning (아침) + at (에)" },
  카페에서: { rom: "kapeeseo", en: "café (카페) + at (에서)" },
  커피예요: { rom: "keopiyeyo", en: "is coffee: coffee (커피) + is (예요)" },
  지금: { rom: "jigeum", en: "now" },
  내일은: { rom: "naeireun", en: "tomorrow (내일) + topic tag (은)" },
  고양이가: { rom: "goyangiga", en: "cat (고양이) + subject tag (가)" },
  고양이를: { rom: "goyangireul", en: "cat (고양이) + object tag (를)" },
  고양이: { rom: "goyangi", en: "cat" },
  개: { rom: "gae", en: "dog" },
  곰: { rom: "gom", en: "bear" },

  주말에: { rom: "jumare", en: "weekend (주말) + at (에)" },
  영화를: { rom: "yeonghwareul", en: "movie (영화) + object tag (를)" },
  개가: { rom: "gaega", en: "dog (개) + subject tag (가)" },
  개를: { rom: "gaereul", en: "dog (개) + object tag (를)" },
  곰이: { rom: "gomi", en: "bear (곰) + subject tag (이)" },
  곰을: { rom: "gomeul", en: "bear (곰) + object tag (을)" },

  // Particles on their own: the bubble gives an example
  은: {
    rom: "eun",
    en: "topic tag, after a consonant: e.g. 책은 (chaegeun), as for the book",
  },
  는: {
    rom: "neun",
    en: "topic tag, after a vowel: e.g. 저는 (jeoneun), as for me",
  },
  이: {
    rom: "i",
    en: "subject tag, after a consonant: e.g. 책이 (chaegi), the book (does…)",
  },
  가: {
    rom: "ga",
    en: "subject tag, after a vowel: e.g. 비가 (biga), the rain (comes)",
  },
  을: {
    rom: "eul",
    en: "object tag, after a consonant: e.g. 책을 (chaegeul), the book (is read)",
  },
  를: {
    rom: "reul",
    en: "object tag, after a vowel: e.g. 커피를 (keopireul), the coffee (is drunk)",
  },
  에: {
    rom: "e",
    en: "to (a place) or at (a time): e.g. 학교에 (hakgyoe), to school",
  },
  에서: {
    rom: "eseo",
    en: "at, where an action happens: e.g. 집에서 (jibeseo), at home",
  },

  // Endings on their own
  어요: { rom: "eoyo", en: "now, polite ending" },
  아요: { rom: "ayo", en: "now, polite ending (after ㅏ or ㅗ)" },
  었어요: { rom: "eosseoyo", en: "past, polite ending" },

  // Dictionary forms
  가다: { rom: "gada", en: "to go: go (가) + dictionary ending (다)" },
  먹다: { rom: "meokda", en: "to eat: eat (먹) + dictionary ending (다)" },
  보다: {
    rom: "boda",
    en: "to see, to watch: see (보) + dictionary ending (다)",
  },
  맛있다: {
    rom: "masitda",
    en: "to be tasty: be tasty (맛있) + dictionary ending (다)",
  },
  싶다: {
    rom: "sipda",
    en: "to want: want (싶) + dictionary ending (다), used after -고",
  },
  먹: { rom: "meok", en: "eat: the stem of 먹다 (to eat)" },

  // Predicates
  "먹을 거예요": {
    rom: "meogeul geoyeyo",
    en: "will eat: eat (먹) + will (을 거예요)",
  },
  "먹고 싶어요": {
    rom: "meokgo sipeoyo",
    en: "want to eat: eat (먹) + want to (고 싶어요)",
  },
  "먹는 음식": {
    rom: "meongneun eumsik",
    en: "the food I eat: eat (먹) + before a noun (는) + food (음식)",
  },
  "먹고 마셔요": {
    rom: "meokgo masyeoyo",
    en: "eat and drink: eat (먹) + and (고) + drink (마셔요)",
  },
  읽어요: { rom: "ilgeoyo", en: "read(s): read (읽) + now, polite (어요)" },
  가요: {
    rom: "gayo",
    en: "go(es): go (가) + now, polite (아요, merges into 가요)",
  },
  와요: {
    rom: "wayo",
    en: "come(s): come (오) + now, polite (아요, merges into 와요)",
  },
  봐요: {
    rom: "bwayo",
    en: "see(s), watch(es): see (보) + now, polite (아요, merges into 봐요)",
  },
  마셔요: {
    rom: "masyeoyo",
    en: "drink(s): drink (마시) + now, polite (어요, merges into 셔요)",
  },
  먹어요: { rom: "meogeoyo", en: "eat(s): eat (먹) + now, polite (어요)" },
  먹었어요: {
    rom: "meogeosseoyo",
    en: "ate: eat (먹) + past, polite (었어요)",
  },
  먹고: {
    rom: "meokgo",
    en: "eat and…: eat (먹) + and (고), also used in 먹고 싶어요",
  },
  먹는: {
    rom: "meongneun",
    en: "that (someone) eats: eat (먹) + before a noun (는)",
  },
  먹을: { rom: "meogeul", en: "will eat: eat (먹) + will (을), with 거예요" },
  공부해요: {
    rom: "gongbuhaeyo",
    en: "study, studies: study (공부) + do, polite (해요)",
  },
  노래해요: {
    rom: "noraehaeyo",
    en: "sing(s): song (노래) + do, polite (해요)",
  },
  싶어요: { rom: "sipeoyo", en: "want to: want (싶) + now, polite (어요)" },
  맛있어요: {
    rom: "masisseoyo",
    en: "is tasty: be tasty (맛있) + now, polite (어요)",
  },
  맛있는: {
    rom: "masinneun",
    en: "tasty, before a noun: be tasty (맛있) + before a noun (는)",
  },
  좋아요: {
    rom: "joayo",
    en: "is good, is nice: be good (좋) + now, polite (아요)",
  },
  커요: {
    rom: "keoyo",
    en: "is big: be big (크) + now, polite (어요, merges into 커요)",
  },
  재미있어요: {
    rom: "jaemiisseoyo",
    en: "is fun: be fun (재미있) + now, polite (어요)",
  },
  있어요: {
    rom: "isseoyo",
    en: "there is, I have: exist (있) + now, polite (어요)",
  },
  없어요: {
    rom: "eopseoyo",
    en: "there isn't, I don't have: not exist (없) + now, polite (어요)",
  },
  학생이에요: {
    rom: "haksaengieyo",
    en: "am a student: student (학생) + is (이에요)",
  },
  의사예요: { rom: "uisayeyo", en: "is a doctor: doctor (의사) + is (예요)" },
  사과예요: { rom: "sagwayeyo", en: "is an apple: apple (사과) + is (예요)" },
  금요일이에요: {
    rom: "geumyoirieyo",
    en: "is Friday: Friday (금요일) + is (이에요)",
  },
  거예요: {
    rom: "geoyeyo",
    en: "will (after -(으)ㄹ): thing (거) + is (예요)",
  },
};
