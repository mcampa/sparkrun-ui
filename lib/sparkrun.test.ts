import { describe, expect, it } from "vitest";
import { targetArgs } from "./sparkrun";

describe("targetArgs", () => {
  it("returns empty array when no target", () => {
    expect(targetArgs(undefined)).toEqual([]);
    expect(targetArgs({})).toEqual([]);
  });

  it("prefers cluster when both provided", () => {
    expect(targetArgs({ cluster: "mylab", hosts: ["a", "b"] })).toEqual(["--cluster", "mylab"]);
  });

  it("emits --hosts with comma-joined list", () => {
    expect(targetArgs({ hosts: ["a", "b", "c"] })).toEqual(["--hosts", "a,b,c"]);
  });

  it("ignores empty hosts array", () => {
    expect(targetArgs({ hosts: [] })).toEqual([]);
  });
});
