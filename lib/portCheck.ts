import { createConnection } from "node:net";

export function probePort(host: string, port: number, timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

export async function probePortsParallel(
  hosts: string[],
  port: number,
): Promise<{ host: string; inUse: boolean }[]> {
  return Promise.all(hosts.map(async (host) => ({ host, inUse: await probePort(host, port) })));
}
