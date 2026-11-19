# 공부 Gongbu

Generate a Korean paragraph at your level, read it with optional romanization shown above each word
and an optional English translation, and listen to it read aloud. Memorize ~600 common beginner words
with spaced-repetition drills, and look up letters and pronunciation rules.

- **Frontend:** Vite + React + TypeScript (`src/`)
- **Backend:** a Cloudflare Worker in TypeScript (`worker/`), built and run by the same Vite
  project. One `npm run dev` runs both locally; one `npm run deploy` publishes both to Cloudflare.
- **Services:** paragraph generation and word suggestions (Claude), romanization (`koroman`),
  text-to-speech (browser Web Speech API or Google Cloud TTS), spaced-repetition scheduling (SM-2) and
  progress storage (this browser). Each one is a swappable provider.

API keys are Worker secrets: `.dev.vars` locally (git-ignored) and `wrangler secret put` in
production. The browser never sees them.

---

## 1. Prerequisites

- Node.js 20+
- An Anthropic API key (see §3)
- A free Cloudflare account, to deploy (see §9). Not needed to run locally.
- *Optional:* a Google Cloud project for the "Google Cloud" voice (see §4). The "Browser" voice needs
  no setup beyond having a Korean voice installed (see §6).

## 2. Setup

```bash
npm install
cp .dev.vars.example .dev.vars    # Windows: copy .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set `ANTHROPIC_API_KEY`, plus `GOOGLE_TTS_API_KEY` if you use the
Google voice. This file holds **local** secrets for the Worker and is git-ignored.

Non-secret settings (which providers to use, the Claude model, the Google voice) are under `vars` in
`wrangler.jsonc`.

`.env` (optional, see `.env.example`) only holds public browser settings
(`VITE_DEFAULT_TTS_PROVIDER`). **Never put keys in it or in any `VITE_` variable**, because those are
bundled into the browser code.

## 3. Getting an Anthropic API key

1. Sign in at <https://console.anthropic.com>.
2. Add billing/credits under **Settings → Billing** (the API is pay-as-you-go).
3. Open **Settings → API Keys → Create Key** and copy the key (it starts with `sk-ant-`).
4. Put it in `.dev.vars` (`ANTHROPIC_API_KEY=sk-ant-...`) for local use, and set it as a
   Worker secret when you deploy (§9).
5. Recommended: set a monthly **spend limit** under **Settings → Limits** so costs can't run away.

The model defaults to `claude-haiku-5-5` (Claude's cheapest current model). Each paragraph is a single
short request. To use a different Claude model, change `ANTHROPIC_MODEL` in `wrangler.jsonc`.

## 4. Setting up Google Cloud Text-to-Speech (optional)

Skip this section if the Browser voice is enough for you.

### 4.1 Create a project and enable the API

1. Go to <https://console.cloud.google.com> and create a project (or pick an existing one).
2. **Billing → Link a billing account.** Google requires one even if you stay inside the free tier.
3. **APIs & Services → Library**, search for **Cloud Text-to-Speech API**, and click **Enable**.

### 4.2 Create an API key

1. **APIs & Services → Credentials → Create credentials → API key.**
2. Click the new key, and under **API restrictions** choose **Restrict key → Cloud Text-to-Speech API**.
   Then if the key ever leaks, it can't be used for anything else.
3. Put it in `.dev.vars` (`GOOGLE_TTS_API_KEY=your-key-here`) and restart `npm run dev`.
   When you deploy, set it as a Worker secret too (§9).

The key stays in the Worker; the browser never sees it. (The Worker calls Google's REST API with the
key, so it needs an API key; it can't use gcloud logins or service-account files.)

### 4.3 Choose a voice

`GOOGLE_TTS_VOICE` (in `wrangler.jsonc`) is the default voice, `ko-KR-Standard-A`. You can also pick a
voice in the app: open the voice chip at the top right, choose **Google Cloud**, then a type and a voice,
and press **Preview**. Your pick is remembered in this browser.

Google has 41 Korean voices in four types:

| Type | Voices | Sound | Cost |
| --- | --- | --- | --- |
| Standard | A, B (♀), C, D (♂) | Basic | Cheapest, largest free tier |
| WaveNet | A, B (♀), C, D (♂) | Smoother | More |
| Neural2 | A, B (♀), C (♂) | Natural | More |
| Chirp 3 HD | 30 named voices (Kore, Puck…) | Most natural | Most |

Check current prices and free tiers on the [pricing page](https://cloud.google.com/text-to-speech/pricing).
The server only accepts Korean voices (`ko-KR-…`), so the voice option can't be used for anything else.

### 4.4 Exact word highlighting (optional: Speech-to-Text)

Google's Korean voices don't report when each word is spoken, so for highlighting the app runs
**Google Speech-to-Text** on the generated audio once (cached) to get exact word times. Without it, the app
estimates them from the audio's pauses and syllable counts, which is close but not exact.

1. **APIs & Services → Library → Cloud Speech-to-Text API → Enable** (same project as Text-to-Speech).
2. **APIs & Services → Credentials →** your API key **→ API restrictions →** also tick
   **Cloud Speech-to-Text API → Save.** (Or create a separate key restricted to Speech-to-Text and set it as
   `GOOGLE_STT_API_KEY` in `.dev.vars` / `npx wrangler secret put GOOGLE_STT_API_KEY`.)

Cost: one recognition per paragraph you play (replays are cached), roughly 10–60 s of audio each. Check the
free monthly minutes on the [Speech-to-Text pricing page](https://cloud.google.com/speech-to-text/pricing).
To turn it off, set `"ALIGNER_PROVIDER": "none"` in `wrangler.jsonc`.

### 4.5 Protect yourself from surprise charges

Do **both** of these:

**a) Cap the API quota** (limits how fast usage can grow)

1. **APIs & Services → Enabled APIs → Cloud Text-to-Speech API → Quotas & System Limits.**
2. Select the per-minute request quota, click **Edit quota**, and set it low (e.g. `10` requests per
   minute). That's plenty for one person practising.
3. If a characters-per-minute quota is listed, lower that too.

Quotas are per-minute rate limits, so they slow down runaway usage but don't set a monthly total.

**b) Add a budget alert** (tells you when spending starts)

1. **Billing → Budgets & alerts → Create budget.**
2. Scope it to this project. Set the amount to something small, e.g. **$1**.
3. Add alert thresholds at 50%, 90% and 100%, and keep email alerts on for billing admins.

A budget **notifies** you but does not stop spending by itself. If you want a hard stop, Google
documents how to [disable billing automatically when a budget is hit](https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications).
At minimum, act on the first alert email by switching the app to the Browser voice or disabling the API.

The app also limits its own usage. Audio is cached in the browser per paragraph and speed, so replaying
doesn't call the API again, and the Worker rejects text longer than 1,500 characters.

## 5. Running locally

```bash
npm run dev
```

Open <http://localhost:5173>. This runs the app **and** the Worker together. Cloudflare's Vite plugin
runs the Worker in the real Workers runtime (workerd), so `/api/*` behaves as it will in production.
Secrets come from `.dev.vars`. To try it on your phone on the same Wi-Fi, run
`npm run dev -- --host` and open the "Network" URL it prints.

Check the API with <http://localhost:5173/api/health>.

`npm run preview` builds everything and serves the production build locally, still in the Workers
runtime.

### Tests

```bash
npm test               # Worker + frontend logic/data tests (Vitest); Claude and Google are mocked, no keys needed
npm run typecheck      # type-checks the app and the Worker
npm run words:romanize # regenerate Common Words romanizations after editing the word list
```

## 6. Using the app

- Pick **difficulty**, **length** and an optional **topic**, then press **Generate**.
- **Show romanized** displays Revised Romanization above each word. Press it again to hide it.
- **Translation** shows the English. Hover a Korean sentence (or tap an English one) to highlight its
  matching sentence in the other language; during playback the sentence being read is underlined.
- **Play / Stop** reads the paragraph aloud. **Speed** goes from 0.5x to 1.25x.
- The **voice chip** at the top right (e.g. `🔊 Google Cloud · 1x`) opens the voice settings: **Google Cloud**
  (the default) or **Browser**, and the speed. Your choices apply on every page; the voice is remembered. An orange dot
  on the chip means the selected voice has a problem (e.g. no Korean voice installed).

### Hangul chart (`/hangul`) and pronunciation rules (`/rules`)

- **Hangul**: every jamo (14 basic consonants, 5 double consonants, 10 basic vowels, 11 compound vowels).
  Tap one to see its name, romanization (start vs final), sound description, IPA, audio, final-consonant
  behaviour, example words, and links to related rules. Each letter has its own URL, e.g. `/hangul#giyeok`.
- **Rules**: ten pronunciation rules in learning order, each with a formula, examples (spelling → actual
  pronunciation → romanization) and audio. Use the search box, or link to a rule directly, e.g.
  `/rules#nasalization`.
- Audio uses the same voice and speed settings as the reader. A lone letter would be read as its name,
  so the chart plays example syllables instead (가, 악, 아…).
- Each letter's panel has a **How its sound changes** section: one table for the letter at the start
  of a syllable (what comes before changes it) and one for it as a final consonant (what comes after
  changes it). Vowels whose sound depends on context (ㅢ, ㅖ) get one table.
- The content lives in typed data files, so you can fix or extend it without touching the UI:
  - `src/data/words.ts`: every example word, stored once (pronunciation, romanization, meaning).
  - `src/data/hangul.ts`: letters and syllable-block examples.
  - `src/data/rules.ts`: rule cards, plus structured `changes` data saying which letters each
    rule affects, in which position, and what neighbor triggers it. `BASIC_CHANGES` covers context
    sounds that aren't a rule card (light k vs g, ㅢ/ㅖ variants).
  - The per-letter tables and the Rules page's "Related letters" are generated from `changes` by
    `src/data/soundChanges.ts`. To add a row, add a target to a rule's `changes`; don't edit
    the panel.
- Pronunciations follow 표준 발음법 (Standard Korean Pronunciation). Romanizations are hand-checked
  Revised Romanization and are stored in the data, so they're exact even where an automatic romanizer
  slips. Remember that RR doesn't show tensification (학교 [학꾜] → `hakgyo`).

### Common Words (`/words`)

About 600 high-frequency beginner words (TOPIK I, 1급–2급), each with meaning, part of speech,
category, level, romanization and audio. Where the pronunciation differs from the spelling, the
pronounced form is shown with links to the rules that explain it (학교 [학꾜] → Tensification).

- **Today**: pick a drill and press **Start**. You get the cards due today, then a few new words
  (10 per day per drill by default; change it under **Progress & backup**).
  - **Read → meaning**: see the Hangul, recall the meaning.
  - **English → Korean**: see the English (plus part of speech and category), recall the Korean.
  - **Listen → meaning**: hear the word, recall the meaning.

  Press **Show answer**, then grade yourself: **Again** (forgot; it comes back later in the session),
  **Hard**, **Good** or **Easy**. Each button shows when you'll see the card next. Each drill keeps
  its own schedule, since recognizing 사과 doesn't mean you can produce it from "apple".
  Filter by **category**, or tick **Only my mistakes** to drill words you've answered **Again** and
  haven't yet got right twice in a row. Practising a mistake early doesn't push its next review
  further out.
  When you're done, **Want more?** offers **+10 new words** (an extra batch beyond the daily limit)
  and **Practise today's cards again** (practice only: right answers don't change the schedule).
- **Browse**: search Hangul, romanization or English; filter by category, level or part of speech.
  Each word shows its audio, pronunciation and review status.
- **Add words**: pick a category and a level (Beginner TOPIK 1–2, Intermediate 3–4 or Advanced 5–6, the
  same bands as the Reader), and Claude suggests new words (with meaning, part of speech, exact level and
  pronunciation). The built-in list is TOPIK I (1–2); higher levels come from words you add. Nothing is added until you tick it and press **Add**. You can edit the meaning
  first. Added words are marked "unverified", because unlike the built-in list they aren't checked.
- **Progress & backup**: progress is saved in this browser (localStorage). **Export backup** downloads
  a JSON file. **Import backup** restores it, on this or another device, and replaces the current
  progress. Clearing site data deletes progress, so export now and then.

Scheduling is SM-2 (the algorithm classic Anki uses): Good gives 1 day, then 6 days, then the
interval × the card's ease (starting at 2.5). Again resets the card; Hard and Easy give a shorter or
longer step and lower or raise the ease.

**How the word list is checked.** The list is in `src/data/commonWords.ts`, and
`src/data/commonWords.test.ts` checks it:
- A rule detector finds every spot where 표준 발음법 *must* change a sound (an obstruent final before
  ㄱㄷㅂㅅㅈ, a final before ㅇ, ㅎ next to ㄱㄷㅂㅈ, ㅢ after a consonant…). Those words must have a
  pronunciation with the matching rule links. A pronunciation where nothing could change also fails.
- Each pronunciation (tensification aside) must agree with `koroman`'s pronunciation rules, which
  are an independent implementation. The known `koroman` mistakes are listed in the test, with reasons.
- Pronunciations must keep the spelling's syllables and spaces. Meanings must be unique (so an
  English → Korean card has one answer). Words that are also in `words.ts` must agree with it.
- Romanization is generated by `npm run words:romanize` (`koroman` plus hand-checked fixes in
  `scripts/commonWordsRomanizer.ts`), and a test fails if it's out of date.

What the tests can't decide is tensification that depends on the word itself (compounds like
물고기 [물꼬기], Sino-Korean ㄹ + ㄷㅅㅈ like 열심히 [열씸히], verb stems like 신다 [신따]). Those were
checked by hand. Levels (1급/2급) are estimates: there's no single official TOPIK word list.

**Getting a Korean voice for the Browser option.** If the app says no Korean voice is installed:
- **Windows:** Settings → Time & language → Speech → *Add voices* → Korean, then restart the browser.
  Chrome and Edge also include online Korean voices.
- **macOS:** System Settings → Accessibility → Spoken Content → System voice → *Manage Voices* →
  Korean (e.g. Yuna).
- **Android / iOS:** usually installed already. Otherwise add Korean in the system text-to-speech
  settings.
- Or switch to **Google Cloud**.

**Known limitations**
- The reader's romanization comes from `koroman`, which applies the pronunciation rules (국물 →
  `gungmul`, 같이 → `gachi`). It scored 211 of the 216 hand-checked words; the misses are exceptions
  that need word-level knowledge: ㅅ + ㅎ (못해요 → `mothaeyo`, should be `motaeyo`), the ㄺ verb-stem
  rule (읽고), nouns keeping ㅎ (입학 → `ipak`, RR says `iphak`), and some exception words (난로,
  생산량). Treat romanization as a guide.
- Word highlighting during playback with **Google Cloud**: Google's Korean voices report 0 seconds for every
  word (checked against the live API), so timings come from, in order of preference:
  1. **Measured pauses + Speech-to-Text** (best): the browser decodes the audio and finds where speech
     starts/ends and where each pause is, matched to the punctuation; this fixes every sentence/clause start
     exactly. Inside each sentence, word starts come from Speech-to-Text (see §4.4) where they're
     plausible. Recognition alone is coarse (0.1 s steps) and was measured up to ~0.9 s off on Chirp audio
     (it counts a pause as part of the next word), so implausible times fall back to the syllable spread.
  2. **Measured pauses only** (Speech-to-Text unavailable): words spread by syllable count between pauses.
  3. **Duration only**: the same spread over the whole audio, if the audio can't be analysed.

  Playback starts right away on the best timings available, and switches to better ones as they arrive. With **Browser**, it works only if the voice reports word
  positions. Windows (Microsoft) and macOS voices usually do; Chrome's online "Google 한국의" voice
  usually doesn't, so nothing is highlighted rather than the wrong word.

## 7. Project layout

```
gongbu/                     (project root)
  wrangler.jsonc            Cloudflare config: Worker entry, static assets, non-secret vars
  .dev.vars                 Local Worker secrets (git-ignored; copy from .dev.vars.example)
  worker/                   The API (Cloudflare Worker)
    index.ts                Worker entry
    api.ts                  Routes: /api/health, /api/generate, /api/tts, /api/tts/timed, /api/words/suggest
    rateLimit.ts            Per-caller limits for the endpoints that cost money
    config.ts               Env (vars + secrets) → Settings
    registry.ts             Generic provider registry
    services/
      paragraph/            types.ts (ParagraphGenerator), providers/claude.ts
      romanizer/            types.ts (Romanizer), providers/koroman.ts
      tts/                  types.ts (TtsService), providers/googleCloud.ts
      wordSuggester/        types.ts (WordSuggester), validate.ts, providers/claude.ts
    *.test.ts               Vitest unit tests
  src/
    App.tsx                 Routes: / (home), /hangul, /rules, /words (lazy-loaded), /reader
    router.tsx              Tiny History-API router + <Link> (no dependency)
    pages/                  HomePage, ReaderPage, HangulChartPage, RulesPage, WordsPage
    components/             UI (Layout, SpeakButton, hangul/…, words/…)
    data/                   hangul.ts, rules.ts, words.ts, commonWords.ts, vocabularyMeta.ts: all learning content
    tts/TtsContext.tsx      Shared voice/speed/playback state for every page
    api/client.ts           Calls the backend
    services/tts/
      TtsProvider.ts        TtsProvider interface
      registry.ts           Auto-discovers providers/*.ts
      providers/            BrowserTtsProvider.ts, GoogleCloudTtsProvider.ts
    services/srs/           Scheduler interface, schedulers/sm2.ts, session.ts (daily queue, grading)
    services/progress/      ProgressStore interface, stores/localStorage.ts, backup.ts (export/import)
  scripts/                  romanize-common-words.ts (regenerates the word list's romanization)
  public/                   favicon.svg / favicon.ico / apple-touch-icon.png / icon-512.png, site.webmanifest
```

### API

All routes are under `/api`.

| Method | Path        | Body                                          | Returns                                        |
| ------ | ----------- | --------------------------------------------- | ---------------------------------------------- |
| POST   | `/api/generate` | `{ difficulty, length, topic? }`          | `{ paragraph, translation, sentences: [{ english, start, end }], words: [{ korean, romanized, english }] }` (each sentence covers words `start`–`end - 1`) |
| POST   | `/api/tts`      | `{ text, rate, voice? }` (rate 0.25–2.0)  | `audio/mpeg` bytes                              |
| GET    | `/api/tts/voices` |                                         | `{ voices: [{ name, gender, family }], default }` |
| POST   | `/api/tts/align`  | `{ audio_base64, words: [...] }`          | `{ word_times }`: exact start time per word via Speech-to-Text, or `null` if unavailable |
| POST   | `/api/tts/timed` | `{ words: [...], rate, voice? }`        | `{ audio_base64, mime_type, word_times }` (start of each word in seconds; `null` if the TTS provider can't report timings) |
| POST   | `/api/words/suggest` | `{ category, band? (beginner/intermediate/advanced), count? (1–10), exclude?: [spellings] }` | `{ words: [{ spelling, meaning, pos, level, pronounced?, rules, letters, note?, romanization }] }` (validated: Hangul only, known rule ids, no duplicates) |
| GET    | `/api/health`   |                                           | Active providers                               |

Errors are returned as `{ "detail": "<friendly message>" }`, and the UI displays that message.

## 8. Adding a new provider

Each service has a **registry** that auto-imports every module in its folder. Adding a provider means
**one new file plus one config value**, with no edits anywhere else.

### Worker (paragraph, romanizer, or TTS)

Example: a paragraph generator backed by some other API.

1. Create `worker/services/paragraph/providers/myProvider.ts`:

   ```ts
   import { paragraphRegistry, type ParagraphGenerator } from "../types";

   class MyParagraphGenerator implements ParagraphGenerator {
     constructor(private readonly apiKey: string) {}
     async generate(difficulty, length, topic) {
       return "…"; // Korean text only
     }
   }

   paragraphRegistry.register("my_provider", (settings) => new MyParagraphGenerator(/* key from settings */));
   ```

2. In `wrangler.jsonc`, set `"PARAGRAPH_PROVIDER": "my_provider"`. If it needs a key, add it
   to `Env`/`Settings` in `worker/config.ts`, put it in `.dev.vars`, and run
   `npx wrangler secret put MY_PROVIDER_API_KEY` for production.

It works the same way for the other services:

| Service     | Folder (under `worker/services/`) | Registry            | Method to implement                         | Config value         |
| ----------- | --------------------------------- | ------------------- | ------------------------------------------- | -------------------- |
| Paragraph   | `paragraph/providers/`            | `paragraphRegistry` | `generate(difficulty, length, topic)` → `Promise<string>` | `PARAGRAPH_PROVIDER` |
| Romanizer   | `romanizer/providers/`            | `romanizerRegistry` | `romanizeWords(words)` → `string[]`         | `ROMANIZER_PROVIDER` |
| TTS         | `tts/providers/`                  | `ttsRegistry`       | `synthesize(text, rate)` → MP3 bytes; optional `synthesizeTimed(words, rate)` for highlighting | `TTS_PROVIDER` |
| Word suggester | `wordSuggester/providers/`     | `wordSuggesterRegistry` | `suggest({ category, count, exclude })` → `Promise<SuggestedWord[]>` (pass the result through `validateSuggestions`) | `WORD_SUGGESTER_PROVIDER` |

Notes:
- Every `.ts` file in a `providers/` folder is imported automatically (except `*.test.ts`).
- Throw `ServiceError("friendly message", status)` (from `worker/errors.ts`) for failures the user
  should see.
- Accept the API client (or `fetch`) in the constructor, as the Claude and Google providers do, so
  tests can pass a mock.

### Frontend (TTS)

1. Create `src/services/tts/providers/MyTtsProvider.ts`:

   ```ts
   import { registerTtsProvider } from "../providerStore";
   import type { TtsProvider } from "../TtsProvider";

   class MyTtsProvider implements TtsProvider {
     async speak(text: string, rate: number): Promise<void> { /* ... resolve when done */ }
     stop(): void { /* ... */ }
     isAvailable(): boolean { return true; }
   }

   registerTtsProvider({ id: "my_tts", label: "My TTS", create: () => new MyTtsProvider() });
   ```

2. It appears in the voice settings (the chip at the top right) automatically. To make it the default, set
   `VITE_DEFAULT_TTS_PROVIDER=my_tts` in `.env`.

If the new frontend provider needs server-side synthesis, add a matching Worker TTS provider and
select it with `TTS_PROVIDER`. The existing `/api/tts` endpoint will use it.

### Frontend (spaced-repetition scheduler, progress store)

Same pattern, selected in `.env`:
- **Scheduler**: add `src/services/srs/schedulers/myScheduler.ts` implementing `Scheduler`
  (`review(prev, grade, today)` → next `CardState`) and call `registerScheduler(...)` from
  `../schedulerStore`. Select it with `VITE_SRS_SCHEDULER=my_scheduler`.
- **Progress store** (e.g. sync through the Worker): add `src/services/progress/stores/myStore.ts`
  implementing `ProgressStore` (`load()`, `save(progress)`) and call `registerProgressStore(...)` from
  `../storeRegistry`. Use `parseProgress` from `backup.ts` to validate what you load. Select it with
  `VITE_PROGRESS_STORE=my_store`.

## 9. Deploying to Cloudflare

Everything (app + API) deploys as one Cloudflare Worker. The free plan is plenty for personal use.
Time spent waiting on Claude or Google doesn't count toward the Worker's CPU limit.

1. **Log in once:** `npx wrangler login` (from the project root)
2. **Deploy:** `npm run deploy`. This type-checks, builds the app and the Worker, and uploads both. It
   prints your URL, e.g. `https://gongbu.<your-subdomain>.workers.dev`.
3. **Lock it down before adding keys (required).** The keys are hidden, but `/api/generate`,
   `/api/words/suggest` and `/api/tts` spend your Anthropic and Google credit, and anyone who finds
   the URL could call them. Put **Cloudflare Access** in front of the whole app so only you can open it:
   - In the Cloudflare dashboard, open your Worker → **Settings → Domains & Routes**, and enable
     **Cloudflare Access** for the `workers.dev` URL. Or, in **Zero Trust → Access → Applications**,
     add a self-hosted application for the URL.
   - Use a policy that allows only your email address (login by one-time code).
   - Access is free for small teams.
   - Check it: open the URL in a private window. You should get the Access login, not the app.
4. **Add the secrets** (each command prompts for the value; they're stored encrypted and only the
   Worker can read them):
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put GOOGLE_TTS_API_KEY
   ```
   Until they're set, the app shows a friendly "not set up" message instead of failing.

   Two backstops stay on even with Access:
   - **Rate limits** (`ratelimits` in `wrangler.jsonc`, enforced in `worker/rateLimit.ts`): 20
     Claude calls (paragraphs + word suggestions) and 60 TTS calls per minute per user (the Access
     email, or the IP without Access). Over the limit, the API answers 429 "Too many requests". Change
     `limit` there. Each `namespace_id` must be unique in your Cloudflare account.
   - The Anthropic spend limit (§3) and the Google quota cap and budget alert (§4.5).
5. **Change settings** (providers, model, voice) under `vars` in `wrangler.jsonc`, then
   `npm run deploy` again.

Logs: `npx wrangler tail`, or the Worker's **Logs** tab in the dashboard (observability is enabled in
`wrangler.jsonc`).
