import { describe, expect, it } from "vitest";
import { emptyProgress } from "../src/services/progress/types";
import { sm2 } from "../src/services/srs/schedulers/sm2";
import { MemoryUserDataStore } from "./services/userData";
import { handleApi, servicesFromSettings } from "./api";
import { settingsFromEnv } from "./config";
import { MAX_SAVED_PARAGRAPHS } from "./userDataApi";

const KEY = "a".repeat(32);
const OTHER = "b".repeat(32);

function call(store: MemoryUserDataStore, method: string, path: string, body?: unknown, key: string | null = KEY) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["X-Sync-Key"] = key;
  const request = new Request(`https://app.test/api${path}`, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const settings = settingsFromEnv({});
  // Through the full API handler, so errors become the same status codes as in production.
  return handleApi(request, settings, { ...servicesFromSettings(settings), userData: () => store });
}

// The routes return JSON of several shapes; the tests check them field by field.
const body = async (res: Response) => (await res.json()) as any;

const paragraph = {
  paragraph: "저는 학생이에요.",
  translation: "I'm a student.",
  sentences: [{ english: "I'm a student.", start: 0, end: 2 }],
  words: [
    { korean: "저는", romanized: "jeoneun", english: "I" },
    { korean: "학생이에요.", romanized: "haksaeng-ieyo.", english: "am a student" },
  ],
};
const settings = { difficulty: "beginner", length: "short", topic: "학교" };

describe("saved paragraphs", () => {
  it("saves, lists, opens and deletes, only for the same sync key", async () => {
    const store = new MemoryUserDataStore();
    const created = await call(store, "POST", "/paragraphs", { settings, paragraph });
    expect(created.status).toBe(201);
    const { saved } = await body(created);
    expect(saved).toMatchObject({
      difficulty: "beginner",
      length: "short",
      topic: "학교",
      preview: "저는 학생이에요.",
    });

    const list = await body(await call(store, "GET", "/paragraphs"));
    expect(list.paragraphs.map((p: { id: string }) => p.id)).toEqual([saved.id]);
    expect((await body(await call(store, "GET", "/paragraphs", undefined, OTHER))).paragraphs).toEqual([]);

    const opened = await body(await call(store, "GET", `/paragraphs/${saved.id}`));
    expect(opened.paragraph).toEqual(paragraph);
    expect(opened.settings).toEqual(settings);
    expect((await call(store, "GET", `/paragraphs/${saved.id}`, undefined, OTHER)).status).toBe(404);

    expect((await call(store, "DELETE", `/paragraphs/${saved.id}`, undefined, OTHER)).status).toBe(404);
    expect((await call(store, "DELETE", `/paragraphs/${saved.id}`)).status).toBe(200);
    expect((await body(await call(store, "GET", "/paragraphs"))).paragraphs).toEqual([]);
  });

  it("rejects a missing sync key and malformed paragraphs", async () => {
    const store = new MemoryUserDataStore();
    expect((await call(store, "GET", "/paragraphs", undefined, null)).status).toBe(422);
    expect((await call(store, "GET", "/paragraphs", undefined, "short")).status).toBe(422);
    expect((await call(store, "POST", "/paragraphs", { settings, paragraph: { paragraph: "x" } })).status).toBe(422);
  });

  it("keeps only known fields", async () => {
    const store = new MemoryUserDataStore();
    const extra = { ...paragraph, secret: "x", words: paragraph.words.map((w) => ({ ...w, html: "<b>" })) };
    const { saved } = await body(await call(store, "POST", "/paragraphs", { settings, paragraph: extra }));
    const opened = await body(await call(store, "GET", `/paragraphs/${saved.id}`));
    expect(opened.paragraph).toEqual(paragraph);
  });

  it("caps how many paragraphs one key can keep", async () => {
    const store = new MemoryUserDataStore();
    for (let i = 0; i < MAX_SAVED_PARAGRAPHS; i++) {
      await store.addParagraph(KEY, {
        id: `p${i}`,
        createdAt: i,
        difficulty: "beginner",
        length: "short",
        topic: "",
        preview: "",
        data: "{}",
      });
    }
    expect((await call(store, "POST", "/paragraphs", { settings, paragraph })).status).toBe(409);
  });
});

describe("progress sync", () => {
  it("starts empty, then merges each upload with what was saved", async () => {
    const store = new MemoryUserDataStore();
    expect((await body(await call(store, "GET", "/progress"))).progress).toBeNull();

    const phone = emptyProgress();
    phone.cards["학교|read"] = sm2.review(undefined, "good", "2026-03-10");
    await call(store, "PUT", "/progress", { progress: phone });

    const laptop = emptyProgress();
    laptop.cards["사과|read"] = sm2.review(undefined, "good", "2026-03-11");
    const merged = (await body(await call(store, "PUT", "/progress", { progress: laptop }))).progress;
    expect(Object.keys(merged.cards).sort()).toEqual(["사과|read", "학교|read"]);

    const fetched = (await body(await call(store, "GET", "/progress"))).progress;
    expect(fetched).toEqual(merged);
    expect((await body(await call(store, "GET", "/progress", undefined, OTHER))).progress).toBeNull();
  });

  it("rejects something that isn't progress", async () => {
    const store = new MemoryUserDataStore();
    expect((await call(store, "PUT", "/progress", { progress: { version: 9 } })).status).toBe(422);
  });
});
