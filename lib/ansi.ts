// Minimal ANSI SGR (select graphic rendition) parser for log rendering.
// Recognises the codes that sparkrun / `tracing` actually emit: reset,
// bold/dim/italic/underline, the 8 + 8 bright foreground colors, and the
// matching background colors. 256-color and truecolor are passed through
// (consumed without effect) so we don't render their numeric params as
// text. Unknown codes are ignored.

export type AnsiSegment = {
  text: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  // Foreground / background as ANSI color keys: "0".."7" (standard) or
  // "b0".."b7" (bright). Consumers map to their own palette.
  fg?: AnsiColor;
  bg?: AnsiColor;
};

export type AnsiColor =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "b0"
  | "b1"
  | "b2"
  | "b3"
  | "b4"
  | "b5"
  | "b6"
  | "b7";

type State = Omit<AnsiSegment, "text">;

const ESC = "\x1b[";

export function parseAnsi(input: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const state: State = {};
  let cursor = 0;

  while (cursor < input.length) {
    const escIdx = input.indexOf(ESC, cursor);
    if (escIdx === -1) {
      pushText(segments, state, input.slice(cursor));
      break;
    }
    if (escIdx > cursor) {
      pushText(segments, state, input.slice(cursor, escIdx));
    }
    const endIdx = input.indexOf("m", escIdx + ESC.length);
    if (endIdx === -1) {
      // Malformed — render the remainder verbatim and stop.
      pushText(segments, state, input.slice(escIdx));
      break;
    }
    const params = input
      .slice(escIdx + ESC.length, endIdx)
      .split(";")
      .map((p) => (p === "" ? 0 : Number(p)))
      .filter((n) => Number.isFinite(n));
    applySgr(state, params);
    cursor = endIdx + 1;
  }
  return segments;
}

function pushText(segments: AnsiSegment[], state: State, text: string) {
  if (!text) return;
  segments.push({ text, ...state });
}

function applySgr(state: State, params: number[]): void {
  let i = 0;
  while (i < params.length) {
    const code = params[i];
    switch (code) {
      case 0:
        state.bold = undefined;
        state.dim = undefined;
        state.italic = undefined;
        state.underline = undefined;
        state.fg = undefined;
        state.bg = undefined;
        break;
      case 1:
        state.bold = true;
        break;
      case 2:
        state.dim = true;
        break;
      case 3:
        state.italic = true;
        break;
      case 4:
        state.underline = true;
        break;
      case 22:
        state.bold = undefined;
        state.dim = undefined;
        break;
      case 23:
        state.italic = undefined;
        break;
      case 24:
        state.underline = undefined;
        break;
      case 38:
      case 48:
        // 38;5;n  → 256-color, 38;2;r;g;b → truecolor. Consume the
        // tail without applying; mapping into Tailwind is out of scope.
        if (params[i + 1] === 5) i += 2;
        else if (params[i + 1] === 2) i += 4;
        break;
      case 39:
        state.fg = undefined;
        break;
      case 49:
        state.bg = undefined;
        break;
      default:
        if (code >= 30 && code <= 37) state.fg = String(code - 30) as AnsiColor;
        else if (code >= 90 && code <= 97) state.fg = `b${code - 90}` as AnsiColor;
        else if (code >= 40 && code <= 47) state.bg = String(code - 40) as AnsiColor;
        else if (code >= 100 && code <= 107) state.bg = `b${code - 100}` as AnsiColor;
        break;
    }
    i++;
  }
}
