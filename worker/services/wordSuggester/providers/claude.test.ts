import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { settingsFromEnv } from "../../../config";
import { ServiceError } from "../../../errors";
import { wordSuggesterRegistry } from "../index";
import { ClaudeWordSuggester, type MessagesClient } from "./claude";

const WORD = {
  spelling: "먹다",
  meaning: "to eat",
  pos: "verb",
  level: 1,
  pronounced: "먹따",
  rules: ["tensification"],
  letters: [],
  note: "",
};

function setup(reply: unknown, stop_reason = "end_turn") {
  const create = vi.fn().mockResolvedValue({
    stop_reason,
    content: [{ type: "text", text: typeof reply === "string" ? reply : JSON.stringify(reply) }],
  });
  return { create, suggester: new ClaudeWordSuggester({ messages: { create } } as unknown as MessagesClient, "m") };
}

const request = { category: "food" as const, band: "beginner" as const, count: 2, exclude: ["밥", "물"] };

describe("ClaudeWordSuggester", () => {
  it("returns validated words and sends the category, count and exclusions", async () => {
    const { create, suggester } = setup({ words: [WORD, { ...WORD, spelling: "밥" }] });
    expect(await suggester.suggest(request)).toEqual([{ ...WORD, note: undefined }]);
    const args = create.mock.calls[0][0];
    expect(args.output_config.format.type).toBe("json_schema");
    const prompt: string = args.messages[0].content;
    expect(prompt).toContain(`Suggest 2 words for the category "Food & drink" at beginner level (TOPIK 1-2)`);
    expect(prompt).toContain("밥, 물");
    expect(prompt).toContain("tensification =");
  });

  it("errors when nothing usable comes back", async () => {
    await expect(setup({ words: [{ ...WORD, spelling: "x" }] }).suggester.suggest(request)).rejects.toBeInstanceOf(
      ServiceError,
    );
    await expect(setup("not json").suggester.suggest(request)).rejects.toThrow("unreadable");
  });

  it("maps refusals and API errors to friendly messages", async () => {
    await expect(setup({ words: [] }, "refusal").suggester.suggest(request)).rejects.toMatchObject({ status: 422 });
    const create = vi.fn().mockRejectedValue(new Anthropic.APIConnectionError({ message: "offline" }));
    const s = new ClaudeWordSuggester({ messages: { create } } as unknown as MessagesClient, "m");
    await expect(s.suggest(request)).rejects.toThrow("Couldn't reach the word suggestion service");
  });

  it("is registered and needs an API key", () => {
    expect(() => wordSuggesterRegistry.create("claude", settingsFromEnv({}))).toThrow("ANTHROPIC_API_KEY");
    expect(wordSuggesterRegistry.create("claude", settingsFromEnv({ ANTHROPIC_API_KEY: "k" }))).toBeInstanceOf(
      ClaudeWordSuggester,
    );
  });
});
