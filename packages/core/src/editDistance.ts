/** Levenshtein distance with early exit above max. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Last path segment of a registry name: io.github.acme/filesystem -> filesystem. */
const leaf = (n: string) => n.split("/").pop()!.toLowerCase();

/** A name within edit distance 1-2 of a different claimed server is a typosquat. */
export function findTyposquat(name: string, claimedNames: string[]): string | null {
  const lname = leaf(name);
  for (const c of claimedNames) {
    if (c === name) continue;
    const d = editDistance(lname, leaf(c), 2);
    if (d >= 1 && d <= 2 && lname.length >= 5) return c;
  }
  return null;
}
