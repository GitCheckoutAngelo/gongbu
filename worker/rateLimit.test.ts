import { describe, expect, it, vi } from "vitest";
import type { Env } from "./config";
import { callerKey, rateLimitResponse } from "./rateLimit";

const req = (path: string, headers: Record<string, string> = {}, method = "POST") =>
  new Request(`https://app.test${path}`, { method, headers });

function limiter(success: boolean) {
  return { limit: vi.fn().mockResolvedValue({ success }) };
}

describe("rate limiting", () => {
  it("keys callers by Access email, then IP", () => {
    expect(callerKey(req("/", { "cf-access-authenticated-user-email": "a@b.c", "cf-connecting-ip": "1.2.3.4" }))).toBe(
      "a@b.c",
    );
    expect(callerKey(req("/", { "cf-connecting-ip": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(callerKey(req("/"))).toBe("anonymous");
  });

  it("uses the AI limiter for Claude endpoints and the TTS limiter for audio", async () => {
    const ai = limiter(true);
    const tts = limiter(true);
    const env = { AI_RATE_LIMITER: ai, TTS_RATE_LIMITER: tts } as unknown as Env;
    for (const path of ["/api/generate", "/api/words/suggest"])
      expect(await rateLimitResponse(req(path), env)).toBeNull();
    for (const path of ["/api/tts", "/api/tts/timed", "/api/tts/align"])
      expect(await rateLimitResponse(req(path), env)).toBeNull();
    expect(ai.limit).toHaveBeenCalledTimes(2);
    expect(tts.limit).toHaveBeenCalledTimes(3);
    expect(ai.limit).toHaveBeenCalledWith({ key: "AI_RATE_LIMITER:anonymous" });
  });

  it("returns 429 when over the limit", async () => {
    const env = { AI_RATE_LIMITER: limiter(false) } as unknown as Env;
    const res = await rateLimitResponse(req("/api/generate"), env);
    expect(res?.status).toBe(429);
  });

  it("skips free endpoints, GETs, and missing bindings", async () => {
    const ai = limiter(false);
    const env = { AI_RATE_LIMITER: ai } as unknown as Env;
    expect(await rateLimitResponse(req("/api/health", {}, "GET"), env)).toBeNull();
    expect(await rateLimitResponse(req("/api/tts"), env)).toBeNull(); // no TTS binding
    expect(ai.limit).not.toHaveBeenCalled();
  });
});
