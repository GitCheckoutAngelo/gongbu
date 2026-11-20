/**
 * Per-caller rate limits for the endpoints that spend money (Claude, Google TTS), using Cloudflare's
 * built-in Rate Limiting bindings (wrangler.jsonc "ratelimits"). No binding configured → no limit
 * (unit tests). This is a backstop against abuse; Cloudflare Access (README §9) is the real lock.
 */
import type { Env } from "./config";
import { errorResponse } from "./http";

import { USER_DATA_PATH } from "./userDataApi";

type LimiterName = "AI_RATE_LIMITER" | "TTS_RATE_LIMITER" | "DATA_RATE_LIMITER";

const LIMITED_PATHS: Record<string, LimiterName> = {
  "/api/generate": "AI_RATE_LIMITER",
  "/api/words/suggest": "AI_RATE_LIMITER",
  "/api/tts": "TTS_RATE_LIMITER",
  "/api/tts/timed": "TTS_RATE_LIMITER",
  "/api/tts/align": "TTS_RATE_LIMITER",
};

/** Who is calling: the Cloudflare Access user if Access is on, otherwise the client IP. */
export function callerKey(request: Request): string {
  return (
    request.headers.get("cf-access-authenticated-user-email") ?? request.headers.get("cf-connecting-ip") ?? "anonymous"
  );
}

/** Which limiter applies: the paid POST routes, and every write to per-learner data. */
function limiterFor(request: Request): LimiterName | undefined {
  const path = new URL(request.url).pathname;
  if (request.method === "POST" && LIMITED_PATHS[path]) return LIMITED_PATHS[path];
  if (request.method !== "GET" && USER_DATA_PATH.test(path.replace(/^\/api/, ""))) return "DATA_RATE_LIMITER";
  return undefined;
}

/** Returns a 429 response when the caller is over the limit for this path, otherwise null. */
export async function rateLimitResponse(request: Request, env: Env): Promise<Response | null> {
  const name = limiterFor(request);
  const limiter = name && env[name];
  if (!limiter) return null;
  const { success } = await limiter.limit({ key: `${name}:${callerKey(request)}` });
  return success ? null : errorResponse("Too many requests. Please wait a minute and try again.", 429);
}
