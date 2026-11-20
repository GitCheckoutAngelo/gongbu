// Public, build-time configuration (VITE_* variables). Never put secrets here.
export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api",
  defaultTtsProvider: (import.meta.env.VITE_DEFAULT_TTS_PROVIDER as string | undefined) ?? "google_cloud",
  /** Spaced-repetition scheduler id (src/services/srs/schedulers/). */
  srsScheduler: (import.meta.env.VITE_SRS_SCHEDULER as string | undefined) ?? "sm2",
  /** Where Common Words progress is kept (src/services/progress/stores/): "cloud" (default) or "local". */
  progressStore: (import.meta.env.VITE_PROGRESS_STORE as string | undefined) ?? "cloud",
} as const;
