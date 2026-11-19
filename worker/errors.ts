/** A failure whose message is safe and friendly enough to show to the user. */
export class ServiceError extends Error {
  constructor(
    readonly userMessage: string,
    readonly status = 502,
  ) {
    super(userMessage);
    this.name = "ServiceError";
  }
}

/** Invalid request input (sent back as 422). */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
