import { describe, expect, it } from "vitest";
import { sm2 } from "../srs/schedulers/sm2";
import { BackupError, parseBackup, parseProgress, serializeBackup } from "./backup";
import { getProgressStore } from "./registry";
import { LocalStorageProgressStore, STORAGE_KEY, type KeyValueStorage } from "./stores/localStorage";
import { emptyProgress } from "./types";

function sampleProgress() {
  const p = emptyProgress();
  p.cards["학교|read"] = sm2.review(undefined, "good", "2026-03-10");
  p.newToday = { date: "2026-03-10", counts: { read: 1 } };
  p.settings.newPerDay = 15;
  p.addedWords.push({
    id: "added:공책",
    spelling: "공책",
    meaning: "notebook",
    pos: "noun",
    category: "home",
    level: 1,
    romanization: "gongchaek",
    source: "added",
  });
  return p;
}

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("backups", () => {
  it("round-trips through export and import", () => {
    const p = sampleProgress();
    expect(parseBackup(serializeBackup(p))).toEqual(p);
  });

  it("rejects files that aren't backups", () => {
    expect(() => parseBackup("not json")).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(BackupError);
  });

  it("drops invalid cards, modes and words but keeps the rest", () => {
    const p = sampleProgress();
    const raw = JSON.parse(JSON.stringify(p));
    raw.cards["x|read"] = { ease: "high" };
    raw.cards["학교|dance"] = raw.cards["학교|read"];
    raw.addedWords.push({ id: "bad", spelling: "hello", meaning: "x", pos: "noun", category: "home" });
    raw.settings.newPerDay = 10_000;
    const parsed = parseProgress(raw);
    expect(Object.keys(parsed.cards)).toEqual(["학교|read"]);
    expect(parsed.addedWords.map((w) => w.id)).toEqual(["added:공책"]);
    expect(parsed.settings.newPerDay).toBe(10);
  });
});

describe("local storage store", () => {
  it("saves and loads progress", () => {
    const storage = memoryStorage();
    const store = new LocalStorageProgressStore(() => storage);
    expect(store.load()).toEqual(emptyProgress());
    expect(store.save(sampleProgress())).toBe(true);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
    expect(store.load()).toEqual(sampleProgress());
  });

  it("starts fresh on damaged data and reports failed saves", () => {
    const storage = memoryStorage();
    storage.data.set(STORAGE_KEY, "{oops");
    expect(new LocalStorageProgressStore(() => storage).load()).toEqual(emptyProgress());
    const blocked = new LocalStorageProgressStore(() => ({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    }));
    expect(blocked.save(emptyProgress())).toBe(false);
    expect(new LocalStorageProgressStore(() => undefined).save(emptyProgress())).toBe(false);
  });

  it("the default store is the cloud-backed one (kept locally too)", () => {
    expect(getProgressStore().id).toBe("cloud");
  });
});

describe("merging progress from two devices", () => {
  it("keeps the most recent review of each card, every added word, and the newest settings", async () => {
    const { mergeProgress } = await import("./merge");
    const a = emptyProgress();
    const b = emptyProgress();
    a.cards["학교|read"] = sm2.review(undefined, "good", "2026-03-10");
    b.cards["학교|read"] = sm2.review(a.cards["학교|read"], "good", "2026-03-12");
    b.cards["사과|read"] = sm2.review(undefined, "again", "2026-03-12");
    a.addedWords.push(sampleProgress().addedWords[0]);
    a.settings.newPerDay = 5;
    a.settingsChangedAt = 2000;
    b.settings.newPerDay = 20;
    b.settingsChangedAt = 1000;
    a.newToday = { date: "2026-03-12", counts: { read: 2 } };
    b.newToday = { date: "2026-03-12", counts: { read: 1, listen: 3 } };

    const merged = mergeProgress(a, b);
    expect(merged.cards["학교|read"]).toEqual(b.cards["학교|read"]);
    expect(merged.cards["사과|read"]).toEqual(b.cards["사과|read"]);
    expect(merged.addedWords.map((w) => w.id)).toEqual(["added:공책"]);
    expect(merged.settings.newPerDay).toBe(5);
    expect(merged.newToday).toEqual({ date: "2026-03-12", counts: { read: 2, listen: 3 } });
    // Same result whichever side is "local".
    expect(mergeProgress(b, a).cards).toEqual(merged.cards);
  });
});
