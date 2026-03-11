/**
 * Tests for activateSessionWithHost in space.ts.
 */

import { describe, expect, it, mock, beforeEach } from "bun:test";
import { activateSessionWithHost } from "./space";

// =============================================================================
// Test Helpers
// =============================================================================

const TEST_HOST = "https://node.tinycloud.xyz";
const TEST_DELEGATION_HEADER = { Authorization: "Bearer ucan-delegation-token" };

function mockFetchResponse(body: any, init?: ResponseInit): Response {
  return new Response(
    typeof body === "string" ? body : JSON.stringify(body),
    init
  );
}

// =============================================================================
// activateSessionWithHost Tests
// =============================================================================

describe("activateSessionWithHost", () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    globalThis.fetch = mock() as any;
  });

  it("returns success with activated/skipped arrays on JSON response", async () => {
    const responseBody = {
      activated: ["space-1", "space-2"],
      skipped: ["space-3"],
    };
    (globalThis.fetch as any).mockResolvedValueOnce(
      mockFetchResponse(responseBody, { status: 200 })
    );

    const result = await activateSessionWithHost(TEST_HOST, TEST_DELEGATION_HEADER);

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.activated).toEqual(["space-1", "space-2"]);
    expect(result.skipped).toEqual(["space-3"]);
  });

  it("falls back gracefully for old servers returning non-JSON body", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(
      mockFetchResponse("bafy2bzacea...", { status: 200 })
    );

    const result = await activateSessionWithHost(TEST_HOST, TEST_DELEGATION_HEADER);

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.activated).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("returns failure on 404 response", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(
      mockFetchResponse("Space not found", { status: 404 })
    );

    const result = await activateSessionWithHost(TEST_HOST, TEST_DELEGATION_HEADER);

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Space not found");
  });

  it("returns failure on 500 response", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(
      mockFetchResponse("Internal server error", { status: 500 })
    );

    const result = await activateSessionWithHost(TEST_HOST, TEST_DELEGATION_HEADER);

    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("Internal server error");
  });

  it("falls back to statusText when body read fails on error response", async () => {
    const response = new Response(null, { status: 502, statusText: "Bad Gateway" });
    // Override text() to reject — use defineProperty since text is read-only
    Object.defineProperty(response, "text", {
      value: () => Promise.reject(new Error("body stream already read")),
    });
    (globalThis.fetch as any).mockResolvedValueOnce(response);

    const result = await activateSessionWithHost(TEST_HOST, TEST_DELEGATION_HEADER);

    expect(result.success).toBe(false);
    expect(result.status).toBe(502);
    expect(result.error).toBe("Bad Gateway");
  });

  it("sends POST to {host}/delegate with delegation header", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(
      mockFetchResponse({ activated: [], skipped: [] }, { status: 200 })
    );

    await activateSessionWithHost(TEST_HOST, TEST_DELEGATION_HEADER);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${TEST_HOST}/delegate`,
      {
        method: "POST",
        headers: TEST_DELEGATION_HEADER,
      }
    );
  });

  it("composes correct URL with localhost host", async () => {
    const localhostHost = "http://localhost:8000";
    (globalThis.fetch as any).mockResolvedValueOnce(
      mockFetchResponse({ activated: [], skipped: [] }, { status: 200 })
    );

    await activateSessionWithHost(localhostHost, TEST_DELEGATION_HEADER);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/delegate",
      {
        method: "POST",
        headers: TEST_DELEGATION_HEADER,
      }
    );
  });
});
