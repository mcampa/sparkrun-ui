import { describe, expect, it } from "vitest";
import { parseWorkloadUptime } from "./workloadStatus";

describe("parseWorkloadUptime", () => {
  it("returns null when status is missing", () => {
    expect(parseWorkloadUptime(undefined)).toBeNull();
    expect(parseWorkloadUptime("")).toBeNull();
  });

  it("extracts uptime from docker 'Up X' strings", () => {
    expect(parseWorkloadUptime("Up 12 minutes")).toBe("12 minutes");
    expect(parseWorkloadUptime("Up About a minute")).toBe("About a minute");
    expect(parseWorkloadUptime("Up 3 hours")).toBe("3 hours");
    expect(parseWorkloadUptime("Up 5 days")).toBe("5 days");
  });

  it("strips trailing health annotation", () => {
    expect(parseWorkloadUptime("Up 3 hours (healthy)")).toBe("3 hours");
    expect(parseWorkloadUptime("Up 2 minutes (health: starting)")).toBe("2 minutes");
  });

  it("returns null for non-running statuses", () => {
    expect(parseWorkloadUptime("Exited (0) 4 seconds ago")).toBeNull();
    expect(parseWorkloadUptime("Restarting (1) 3 seconds ago")).toBeNull();
    expect(parseWorkloadUptime("Created")).toBeNull();
  });
});
