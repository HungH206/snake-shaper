/**
 * Design tokens — single source of truth for the Snake Shaper palette.
 *
 * Mirrors the design system in `src/client/theme.css`. A Phaser canvas cannot
 * read CSS custom properties, so colors live here as values the scenes import
 * directly. Fills/strokes need numeric hex (0xRRGGBB); text styles need string
 * hex (#RRGGBB), so every color is exposed in both forms.
 */

function toCss(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** Numeric (0xRRGGBB) palette — use for rectangle/graphics fills & strokes. */
export const PALETTE = {
  background: 0x080810,
  backgroundAlt: 0x09090f,
  foreground: 0xe4e4f0,
  card: 0x10101e,
  cardForeground: 0xe4e4f0,
  primary: 0x39ff14,
  primaryForeground: 0x000000,
  secondary: 0x1a1a2e,
  secondaryForeground: 0xe4e4f0,
  muted: 0x141428,
  mutedForeground: 0x7a7a9a,
  accent: 0xffd700,
  accentForeground: 0x000000,
  destructive: 0xff4e6a,
  destructiveForeground: 0xffffff,
  purple: 0xbf5af2,
  cyan: 0x00e5ff,
  // Play-field specifics (not part of the shared token set).
  boardBg: 0x0b0b14,
  cellEmpty: 0x222233,
  cellBorder: 0x3b3b4f,
  target: 0xf5d547,
  overlayScrim: 0x050510,
} as const;

type PaletteKey = keyof typeof PALETTE;

/** String (#RRGGBB) form of every palette color, for text styles & CSS. */
export const CSS = Object.fromEntries(
  Object.entries(PALETTE).map(([key, value]) => [key, toCss(value)]),
) as Record<PaletteKey, string>;

/** Font-family strings for Phaser text styles (mirror --font-family-* tokens). */
export const FONT = {
  sans: 'Outfit, sans-serif',
  mono: '"JetBrains Mono", monospace',
} as const;
