/** What the search box matches against. Kept free of three.js so it runs in unit tests. */
export interface Searchable { id: string; name: string; category: string; tags?: string[]; variants: { label: string }[] }

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/**
 * Every whitespace-separated term must appear somewhere in the element's name, category, tags or variant labels.
 * Name matches rank first, then name-prefix matches within those; ties keep registry order.
 */
export function searchElements<T extends Searchable>(elements: T[], query: string): T[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return elements;
  const scored: { e: T; score: number; i: number }[] = [];
  elements.forEach((e, i) => {
    const name = fold(e.name), hay = [name, e.category, e.id, ...(e.tags ?? []), ...e.variants.map(v => v.label)].map(fold).join(' ');
    if (!terms.every(t => hay.includes(t))) return;
    const words = name.split(/[\s-]+/), score = terms.reduce((n, t) => n + (words.some(w => w.startsWith(t)) ? 3 : name.includes(t) ? 2 : 0), 0);
    scored.push({ e, score, i });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map(s => s.e);
}
