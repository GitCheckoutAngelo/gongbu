import Anthropic from "@anthropic-ai/sdk";
import { ServiceError } from "../errors";

/** Turn an Anthropic SDK error into a friendly ServiceError (other errors are rethrown unchanged). */
export function anthropicServiceError(err: unknown, what: string): unknown {
  if (err instanceof Anthropic.AuthenticationError) {
    return new ServiceError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.", 500);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ServiceError("Too many requests right now. Please wait a moment and try again.", 429);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ServiceError(`Couldn't reach the ${what} service. Please try again.`);
  }
  if (err instanceof Anthropic.APIError) {
    return new ServiceError(`The ${what} service returned an error (${err.status}). Please try again.`);
  }
  return err;
}

/** The server needs ANTHROPIC_API_KEY for any Claude-backed service. */
export function missingAnthropicKey(): ServiceError {
  return new ServiceError(
    "The server is missing ANTHROPIC_API_KEY. Set it with `wrangler secret put ANTHROPIC_API_KEY` (or in .dev.vars locally).",
    500,
  );
}
