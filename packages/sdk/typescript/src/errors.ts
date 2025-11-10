/**
 * Error thrown by API requests
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly cause?: unknown;

  constructor(message: string, status: number, code?: string, cause?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.cause = cause;
  }
}
