import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchServedModel } from "./chat";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

describe("fetchServedModel", () => {
  it("returns the first model id from /v1/models", async () => {
    mockFetch(async (input) => {
      expect(String(input)).toBe("http://h:8000/v1/models");
      return new Response(
        JSON.stringify({
          object: "list",
          data: [
            { id: "qwen3.6", object: "model" },
            { id: "other", object: "model" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    expect(await fetchServedModel("http://h:8000")).toBe("qwen3.6");
  });

  it("returns null when /v1/models is empty", async () => {
    mockFetch(
      async () => new Response(JSON.stringify({ object: "list", data: [] }), { status: 200 }),
    );
    expect(await fetchServedModel("http://h:8000")).toBeNull();
  });

  it("returns null when /v1/models responds with an error status", async () => {
    mockFetch(async () => new Response("nope", { status: 500 }));
    expect(await fetchServedModel("http://h:8000")).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    mockFetch(async () => {
      throw new Error("connection refused");
    });
    expect(await fetchServedModel("http://h:8000")).toBeNull();
  });

  it("forwards the abort signal to fetch", async () => {
    const ac = new AbortController();
    mockFetch(async (_input, init) => {
      expect(init?.signal).toBe(ac.signal);
      return new Response(JSON.stringify({ data: [{ id: "m" }] }), { status: 200 });
    });
    await fetchServedModel("http://h:8000", ac.signal);
  });
});
