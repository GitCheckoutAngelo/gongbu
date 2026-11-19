/**
 * Cloudflare Worker entry. Requests to /api/* come here (see `run_worker_first` in wrangler.jsonc);
 * everything else is served from the built frontend by Cloudflare's static assets.
 */
import { handleApi, servicesFromSettings } from "./api";
import { settingsFromEnv, type Env } from "./config";
import { rateLimitResponse } from "./rateLimit";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const limited = await rateLimitResponse(request, env);
    if (limited) return limited;
    const settings = settingsFromEnv(env);
    return handleApi(request, settings, servicesFromSettings(settings));
  },
} satisfies ExportedHandler<Env>;
