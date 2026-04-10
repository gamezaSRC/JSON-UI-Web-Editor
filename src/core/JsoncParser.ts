/**
 * JSONC (JSON with Comments) parser for Minecraft Bedrock JSON UI files.
 * Handles:
 * - Single-line comments:  // ...
 * - Block comments:       /* ... *\/
 * - Trailing commas before } or ]
 */

export function parseJsonc(text: string): unknown {
  return JSON.parse(stripJsoncComments(text));
}

function stripJsoncComments(src: string): string {
  let out = '';
  let i = 0;
  const len = src.length;

  while (i < len) {
    const ch = src[i];
    // String literal: copy verbatim preserving escapes
    if (ch === '"') {
      out += ch;
      i++;
      while (i < len) {
        const sc = src[i];
        out += sc;
        if (sc === '\\') {
          i++;
          if (i < len) { out += src[i]; i++; }
          continue;
        }
        i++;
        if (sc === '"') break;
      }
      continue;
    }

    // Single-line comment
    if (ch === '/' && i + 1 < len && src[i + 1] === '/') {
      while (i < len && src[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (ch === '/' && i + 1 < len && src[i + 1] === '*') {
      i += 2;
      while (i + 1 < len && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2; // skip */
      continue;
    }

    out += ch;
    i++;
  }

  // Remove trailing commas before } or ]
  return out.replace(/,(\s*[}\]])/g, '$1');
}