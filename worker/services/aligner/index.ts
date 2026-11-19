// Auto-discover providers: each file in ./providers registers itself on import.
import.meta.glob(["./providers/*.ts", "!./providers/*.test.ts"], { eager: true });

export * from "./types";
export * from "./matchWords";
