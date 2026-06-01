import { describe, expect, it } from "vitest";
import { parseAnsi } from "./ansi";

const ESC = "\x1b[";

describe("parseAnsi", () => {
  it("passes plain text through as a single segment", () => {
    expect(parseAnsi("hello world")).toEqual([{ text: "hello world" }]);
  });

  it("returns no segments for an empty string", () => {
    expect(parseAnsi("")).toEqual([]);
  });

  it("applies dim and resets it", () => {
    const out = parseAnsi(`${ESC}2mfoo${ESC}0mbar`);
    expect(out).toEqual([{ text: "foo", dim: true }, { text: "bar" }]);
  });

  it("maps the 8 standard foreground colors and the 8 bright ones", () => {
    const out = parseAnsi(`${ESC}31ma${ESC}32mb${ESC}33mc${ESC}94md${ESC}0me`);
    expect(out).toEqual([
      { text: "a", fg: "1" },
      { text: "b", fg: "2" },
      { text: "c", fg: "3" },
      { text: "d", fg: "b4" },
      { text: "e" },
    ]);
  });

  it("combines modifiers in a single SGR sequence", () => {
    const out = parseAnsi(`${ESC}1;33mWARN${ESC}0m`);
    expect(out).toEqual([{ text: "WARN", bold: true, fg: "3" }]);
  });

  it("parses a real sparkrun log line", () => {
    const line =
      `${ESC}2m2026-06-01T00:07:05.418945Z${ESC}0m ` +
      `${ESC}32m INFO${ESC}0m ` +
      `${ESC}2mspark::scheduler${ESC}0m${ESC}2m:${ESC}0m Swap space: 3 GB`;
    const out = parseAnsi(line);
    expect(out).toEqual([
      { text: "2026-06-01T00:07:05.418945Z", dim: true },
      { text: " " },
      { text: " INFO", fg: "2" },
      { text: " " },
      { text: "spark::scheduler", dim: true },
      { text: ":", dim: true },
      { text: " Swap space: 3 GB" },
    ]);
  });

  it("consumes 256-color and truecolor params without rendering them as text", () => {
    const out = parseAnsi(`${ESC}38;5;208;48;2;10;20;30mhi${ESC}0m`);
    expect(out).toEqual([{ text: "hi" }]);
  });

  it("renders the leftover when the escape is malformed", () => {
    const out = parseAnsi(`ok${ESC}1;33`);
    expect(out).toEqual([{ text: "ok" }, { text: `${ESC}1;33` }]);
  });

  it("treats empty SGR (CSI m) as a reset", () => {
    const out = parseAnsi(`${ESC}31mred${ESC}mplain`);
    expect(out).toEqual([{ text: "red", fg: "1" }, { text: "plain" }]);
  });

  it("ignores codes it doesn't understand", () => {
    const out = parseAnsi(`${ESC}999mhi${ESC}0m`);
    expect(out).toEqual([{ text: "hi" }]);
  });
});
