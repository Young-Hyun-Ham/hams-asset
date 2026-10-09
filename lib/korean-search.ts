const INITIALS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const SYLLABLES_PER_INITIAL = 21 * 28;

function compact(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

export function getKoreanInitials(value: string) {
  return Array.from(compact(value), (character) => {
    const code = character.charCodeAt(0);
    if (code < HANGUL_START || code > HANGUL_END) return character;
    return INITIALS[Math.floor((code - HANGUL_START) / SYLLABLES_PER_INITIAL)];
  }).join("");
}

export function matchesKoreanSearch(value: string, query: string) {
  const normalizedValue = compact(value);
  const normalizedQuery = compact(query);
  if (!normalizedQuery) return true;
  return normalizedValue.includes(normalizedQuery)
    || getKoreanInitials(normalizedValue).includes(normalizedQuery);
}
