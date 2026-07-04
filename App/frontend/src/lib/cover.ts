// Deterministic procedural cover styling from a book's slug.
// Two muted palette families — earth (browns/ochres/rust) and depth (navy/teal/forest).
// We pick one based on hash, then choose accent + spine color within it.

const earth = [
  { base: "#3a261a", accent: "#c9933a", spine: "#1c110b", ink: "#f1e3c4" },
  { base: "#42261f", accent: "#a55a3b", spine: "#22110b", ink: "#f1ddc4" },
  { base: "#3b2e1c", accent: "#b88a3a", spine: "#1a1308", ink: "#efe1bc" },
  { base: "#2f2418", accent: "#d7a45a", spine: "#150f08", ink: "#f3e6c8" },
];

const depth = [
  { base: "#1c2a30", accent: "#5b7a8c", spine: "#0d1518", ink: "#dde5e8" },
  { base: "#1f2a24", accent: "#6f8a55", spine: "#0e1410", ink: "#dde4d7" },
  { base: "#22202e", accent: "#7a6f9b", spine: "#100f1a", ink: "#dedae6" },
  { base: "#2a1d24", accent: "#a55a3b", spine: "#140a10", ink: "#e6d6dd" },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export interface CoverStyle {
  base: string;
  accent: string;
  spine: string;
  ink: string;
  /** Random-but-stable rotation in degrees for ornamental rules. */
  ornament: number;
  /** Roman numeral derived from slug for the small volume label. */
  volume: string;
}

export function coverFor(slug: string): CoverStyle {
  const h = hash(slug);
  const family = h % 2 === 0 ? earth : depth;
  const palette = family[h % family.length];
  const ornament = ((h >> 4) % 7) - 3; // -3..3 deg
  const volume = toRoman((h % 12) + 1);
  return { ...palette, ornament, volume };
}

function toRoman(num: number): string {
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, sym] of map) {
    while (num >= v) {
      out += sym;
      num -= v;
    }
  }
  return out;
}
