/**
 * Normalized Levenshtein similarity between two strings.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function stringSimilarity(a: string, b: string): number {
  const sa = normalize(a);
  const sb = normalize(b);

  if (sa === sb) return 1;
  if (sa.length === 0 || sb.length === 0) return 0;

  const maxLen = Math.max(sa.length, sb.length);
  return 1 - levenshtein(sa, sb) / maxLen;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  if (a.length > b.length) [a, b] = [b, a];

  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  let curr = new Array(a.length + 1);

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,
        curr[i - 1] + 1,
        prev[i - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[a.length];
}
