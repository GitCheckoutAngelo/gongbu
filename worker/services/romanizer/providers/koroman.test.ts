import { describe, expect, it } from "vitest";
import { romanizerRegistry } from "../index";
import { KoromanRomanizer, stripPunctuation } from "./koroman";
import { settingsFromEnv } from "../../../config";

const r = new KoromanRomanizer();

describe("KoromanRomanizer", () => {
  it("romanizes simple words, one per input in order", () => {
    expect(r.romanizeWords(["안녕하세요", "한국어를", "학교에"])).toEqual(["annyeonghaseyo", "hangugeoreul", "hakgyoe"]);
  });

  it("applies pronunciation rules that the old Python package missed", () => {
    expect(r.romanizeWords(["국물", "신라", "같이", "종로", "합니다"])).toEqual([
      "gungmul",
      "silla",
      "gachi",
      "jongno",
      "hamnida",
    ]);
  });

  it("strips punctuation before romanizing", () => {
    expect(r.romanizeWords(["좋아요.", '"서울"', "정말?!", "「책」"])).toEqual(["joayo", "seoul", "jeongmal", "chaek"]);
  });

  it("returns an empty string for punctuation-only words and handles an empty list", () => {
    expect(r.romanizeWords(["...", "—", "!"])).toEqual(["", "", ""]);
    expect(r.romanizeWords([])).toEqual([]);
  });

  it("is lowercase", () => {
    expect(r.romanizeWords(["한국"])).toEqual(["hanguk"]);
  });

  it("strips punctuation and symbols but keeps letters and digits", () => {
    expect(stripPunctuation("좋아요.")).toBe("좋아요");
    expect(stripPunctuation("(학교)")).toBe("학교");
    expect(stripPunctuation("3,000원")).toBe("3000원");
  });

  it("is selected by the registry", () => {
    expect(romanizerRegistry.create("koroman", settingsFromEnv({}))).toBeInstanceOf(KoromanRomanizer);
  });
});
