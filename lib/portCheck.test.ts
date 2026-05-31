import { createServer, type Server } from "node:net";
import { describe, expect, it, afterEach } from "vitest";
import { probePort } from "./portCheck";

let servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r()))));
  servers = [];
});

async function listen(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    servers.push(s);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      if (addr && typeof addr === "object") resolve(addr.port);
    });
  });
}

describe("probePort", () => {
  it("returns true when a port is open", async () => {
    const port = await listen();
    const inUse = await probePort("127.0.0.1", port);
    expect(inUse).toBe(true);
  });

  it("returns false for a closed port", async () => {
    // Pick a high port unlikely to be in use
    const port = 1; // privileged — connection will refuse
    const inUse = await probePort("127.0.0.1", port);
    expect(inUse).toBe(false);
  });

  it("returns false on timeout", async () => {
    // Black-hole route: 192.0.2.0/24 (TEST-NET-1) won't respond
    const start = Date.now();
    const inUse = await probePort("192.0.2.1", 9999, 150);
    expect(inUse).toBe(false);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
