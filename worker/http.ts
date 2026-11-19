import { ValidationError } from "./errors";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(message: string, status: number): Response {
  return json({ detail: message }, status);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new ValidationError("Invalid request: expected a JSON object");
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw new ValidationError(`Invalid ${field}: must be one of ${allowed.join(", ")}`);
}

export function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new ValidationError(`Invalid ${field}: must be text`);
  if (value.length > maxLength) throw new ValidationError(`Invalid ${field}: at most ${maxLength} characters`);
  return value;
}

export function requiredString(value: unknown, field: string, maxLength: number): string {
  const s = optionalString(value, field, maxLength);
  if (!s || !s.trim()) throw new ValidationError(`Invalid ${field}: required`);
  return s;
}

export function rateValue(value: unknown): number {
  if (value === undefined || value === null) return 1;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0.25 || value > 2) {
    throw new ValidationError("Invalid rate: must be a number from 0.25 to 2");
  }
  return value;
}

/** An optional list of short strings (e.g. spellings to exclude). */
export function stringList(value: unknown, field: string, maxItems: number, maxLength: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ValidationError(`Invalid ${field}: must be a list of at most ${maxItems} items`);
  }
  if (value.some((v) => typeof v !== "string" || v.length > maxLength)) {
    throw new ValidationError(`Invalid ${field}: every item must be text of at most ${maxLength} characters`);
  }
  return value as string[];
}

export function intInRange(value: unknown, field: string, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`Invalid ${field}: must be a whole number from ${min} to ${max}`);
  }
  return value;
}

export function wordList(value: unknown, maxWords: number, maxTotalChars: number): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxWords) {
    throw new ValidationError(`Invalid words: must be a list of 1–${maxWords} words`);
  }
  if (value.some((w) => typeof w !== "string" || !w.trim())) {
    throw new ValidationError("Invalid words: every word must be non-empty text");
  }
  const words = value as string[];
  if (words.reduce((n, w) => n + w.length + 1, 0) > maxTotalChars) {
    throw new ValidationError(`Invalid words: text is too long (max ${maxTotalChars} characters)`);
  }
  return words;
}
