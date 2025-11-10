import { describe, test, expect } from "bun:test";
import { ApiError } from "../src/errors";

describe("ApiError", () => {
  describe("Constructor", () => {
    test("should create error with message and status", () => {
      const error = new ApiError("Not found", 404);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe("Not found");
      expect(error.status).toBe(404);
      expect(error.name).toBe("ApiError");
    });

    test("should create error with optional code", () => {
      const error = new ApiError("Bad request", 400, "VALIDATION_ERROR");

      expect(error.message).toBe("Bad request");
      expect(error.status).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
    });

    test("should create error with optional cause", () => {
      const originalError = new Error("Original error");
      const error = new ApiError("Network error", 0, undefined, originalError);

      expect(error.message).toBe("Network error");
      expect(error.status).toBe(0);
      expect(error.cause).toBe(originalError);
    });

    test("should create error with all parameters", () => {
      const originalError = new Error("Original error");
      const error = new ApiError("Request failed", 500, "INTERNAL_ERROR", originalError);

      expect(error.message).toBe("Request failed");
      expect(error.status).toBe(500);
      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.cause).toBe(originalError);
    });
  });

  describe("Properties", () => {
    test("should have readonly status property", () => {
      const error = new ApiError("Error", 403);

      expect(error.status).toBe(403);
      // In TypeScript, readonly is compile-time only
      // The value can still be changed at runtime in JavaScript
    });

    test("should have readonly code property", () => {
      const error = new ApiError("Error", 400, "CODE");

      expect(error.code).toBe("CODE");
    });

    test("should have readonly cause property", () => {
      const cause = new Error("Cause");
      const error = new ApiError("Error", 500, undefined, cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe("HTTP Status Codes", () => {
    test("should handle 400 Bad Request", () => {
      const error = new ApiError("Bad request", 400);
      expect(error.status).toBe(400);
    });

    test("should handle 401 Unauthorized", () => {
      const error = new ApiError("Unauthorized", 401);
      expect(error.status).toBe(401);
    });

    test("should handle 403 Forbidden", () => {
      const error = new ApiError("Forbidden", 403);
      expect(error.status).toBe(403);
    });

    test("should handle 404 Not Found", () => {
      const error = new ApiError("Not found", 404);
      expect(error.status).toBe(404);
    });

    test("should handle 500 Internal Server Error", () => {
      const error = new ApiError("Internal server error", 500);
      expect(error.status).toBe(500);
    });

    test("should handle 502 Bad Gateway", () => {
      const error = new ApiError("Bad gateway", 502);
      expect(error.status).toBe(502);
    });

    test("should handle 503 Service Unavailable", () => {
      const error = new ApiError("Service unavailable", 503);
      expect(error.status).toBe(503);
    });

    test("should handle network error (status 0)", () => {
      const error = new ApiError("Network error", 0);
      expect(error.status).toBe(0);
    });
  });

  describe("Error Codes", () => {
    test("should handle validation error code", () => {
      const error = new ApiError("Validation failed", 400, "VALIDATION_ERROR");
      expect(error.code).toBe("VALIDATION_ERROR");
    });

    test("should handle authentication error code", () => {
      const error = new ApiError("Authentication failed", 401, "AUTH_ERROR");
      expect(error.code).toBe("AUTH_ERROR");
    });

    test("should handle not found error code", () => {
      const error = new ApiError("Resource not found", 404, "NOT_FOUND");
      expect(error.code).toBe("NOT_FOUND");
    });

    test("should handle undefined code", () => {
      const error = new ApiError("Error", 500);
      expect(error.code).toBeUndefined();
    });
  });

  describe("Stack Trace", () => {
    test("should have stack trace", () => {
      const error = new ApiError("Error", 500);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("ApiError");
    });

    test("should include error location in stack", () => {
      const error = new ApiError("Error", 500);
      expect(error.stack).toContain("api-error.test");
    });
  });

  describe("Error Throwing and Catching", () => {
    test("should be catchable as Error", () => {
      try {
        throw new ApiError("Test error", 400);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ApiError);
      }
    });

    test("should preserve properties when caught", () => {
      try {
        throw new ApiError("Test error", 404, "NOT_FOUND");
      } catch (error) {
        if (error instanceof ApiError) {
          expect(error.message).toBe("Test error");
          expect(error.status).toBe(404);
          expect(error.code).toBe("NOT_FOUND");
        } else {
          throw new Error("Should have been ApiError");
        }
      }
    });

    test("should be distinguishable from generic Error", () => {
      const apiError = new ApiError("API error", 500);
      const genericError = new Error("Generic error");

      expect(apiError instanceof ApiError).toBe(true);
      expect(genericError instanceof ApiError).toBe(false);
    });
  });

  describe("Error Messages", () => {
    test("should handle empty message", () => {
      const error = new ApiError("", 500);
      expect(error.message).toBe("");
    });

    test("should handle long message", () => {
      const longMessage = "A".repeat(1000);
      const error = new ApiError(longMessage, 500);
      expect(error.message).toBe(longMessage);
    });

    test("should handle message with special characters", () => {
      const message = 'Error: \n\t"Invalid" <input>';
      const error = new ApiError(message, 400);
      expect(error.message).toBe(message);
    });
  });

  describe("Serialization", () => {
    test("should serialize to JSON", () => {
      const error = new ApiError("Test error", 404, "NOT_FOUND");
      const json = JSON.stringify(error);

      // Error objects don't serialize message by default in JavaScript
      expect(json).toContain("404");
      expect(json).toContain("NOT_FOUND");
    });

    test("should preserve properties when manually serialized", () => {
      const error = new ApiError("Test error", 404, "NOT_FOUND");
      const serialized = {
        name: error.name,
        message: error.message,
        status: error.status,
        code: error.code,
      };

      expect(serialized).toEqual({
        name: "ApiError",
        message: "Test error",
        status: 404,
        code: "NOT_FOUND",
      });
    });
  });

  describe("Edge Cases", () => {
    test("should handle negative status code", () => {
      const error = new ApiError("Error", -1);
      expect(error.status).toBe(-1);
    });

    test("should handle very large status code", () => {
      const error = new ApiError("Error", 99999);
      expect(error.status).toBe(99999);
    });

    test("should handle null-like cause", () => {
      const error = new ApiError("Error", 500, undefined, null);
      expect(error.cause).toBe(null);
    });

    test("should handle object as cause", () => {
      const cause = { detail: "Something went wrong" };
      const error = new ApiError("Error", 500, undefined, cause);
      expect(error.cause).toBe(cause);
    });
  });
});
