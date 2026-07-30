const MOJIBAKE_HINT = /(?:Ã|Â|â|ð|å|ä|æ|ç|ï|\uFFFD|[\u0080-\u009f])/u;
const CJK_TEXT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function mojibakeScore(value) {
  return Array.from(String(value ?? "")).reduce(
    (score, character) =>
      score +
      (MOJIBAKE_HINT.test(character) ? 2 : 0) +
      (character === "\uFFFD" ? 4 : 0),
    0,
  );
}

function latin1Bytes(value) {
  const codePoints = Array.from(value, (character) => character.codePointAt(0));
  if (codePoints.some((codePoint) => codePoint > 255)) return null;
  return Uint8Array.from(codePoints);
}

export function recoverUtf8Filename(value) {
  const original = String(value ?? "");
  if (!original || !MOJIBAKE_HINT.test(original)) return original;

  const bytes = latin1Bytes(original);
  if (!bytes) return original;

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!decoded || decoded === original) return original;

    const clearlyRecoveredCjk = CJK_TEXT.test(decoded) && !CJK_TEXT.test(original);
    const scoreImproved = mojibakeScore(decoded) + 1 < mojibakeScore(original);
    return clearlyRecoveredCjk || scoreImproved ? decoded : original;
  } catch {
    return original;
  }
}
