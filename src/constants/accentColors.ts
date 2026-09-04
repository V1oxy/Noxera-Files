export type AccentColorKey =
  | "green"
  | "blue"
  | "teal"
  | "purple"
  | "pink"
  | "red"
  | "orange"
  | "amber"
  | "indigo"
  | "graphite";

interface AccentColorShades {
  /** "R G B" - fed into rgb(var(...) / <alpha>) so Tailwind opacity modifiers keep working. */
  rgb: string;
  hoverRgb: string;
}

interface AccentColorPreset {
  key: AccentColorKey;
  /** Representative swatch color for the picker UI. */
  swatch: string;
  light: AccentColorShades;
  dark: AccentColorShades;
}

/**
 * Each shade was picked by holding the preset's hue/saturation fixed and
 * solving for a lightness that gives ~4.3:1 contrast against white in light
 * mode (matching WCAG AA for the white button labels drawn on top of it),
 * with a mildly darker hover shade and a lighter, less contrast-constrained
 * pair for dark mode - the same approach used to tune the original green.
 */
export const ACCENT_COLOR_PRESETS: AccentColorPreset[] = [
  {
    key: "green",
    swatch: "#518722",
    light: { rgb: "81 135 34", hoverRgb: "59 99 25" },
    dark: { rgb: "110 179 49", hoverRgb: "124 201 57" },
  },
  {
    key: "blue",
    swatch: "#1378e5",
    light: { rgb: "19 120 229", hoverRgb: "15 98 187" },
    dark: { rgb: "97 165 238", hoverRgb: "136 187 242" },
  },
  {
    key: "teal",
    swatch: "#278783",
    light: { rgb: "39 135 131", hoverRgb: "29 100 96" },
    dark: { rgb: "56 180 174", hoverRgb: "70 197 191" },
  },
  {
    key: "purple",
    swatch: "#8c64d2",
    light: { rgb: "140 100 210", hoverRgb: "114 65 200" },
    dark: { rgb: "174 146 221", hoverRgb: "197 177 231" },
  },
  {
    key: "pink",
    swatch: "#d53b90",
    light: { rgb: "213 59 144", hoverRgb: "187 40 121" },
    dark: { rgb: "228 140 188", hoverRgb: "235 173 207" },
  },
  {
    key: "red",
    swatch: "#dc4238",
    light: { rgb: "220 66 56", hoverRgb: "195 45 34" },
    dark: { rgb: "231 142 136", hoverRgb: "238 175 170" },
  },
  {
    key: "orange",
    swatch: "#bd6015",
    light: { rgb: "189 96 21", hoverRgb: "147 75 16" },
    dark: { rgb: "228 133 55", hoverRgb: "232 153 88" },
  },
  {
    key: "amber",
    swatch: "#9e720d",
    light: { rgb: "158 114 13", hoverRgb: "116 84 9" },
    dark: { rgb: "209 153 22", hoverRgb: "231 171 30" },
  },
  {
    key: "indigo",
    swatch: "#686ddf",
    light: { rgb: "104 109 223", hoverRgb: "66 73 215" },
    dark: { rgb: "140 144 228", hoverRgb: "173 176 235" },
  },
  {
    key: "graphite",
    swatch: "#797979",
    light: { rgb: "121 121 121", hoverRgb: "99 99 99" },
    dark: { rgb: "164 164 164", hoverRgb: "185 185 185" },
  },
];

export const DEFAULT_ACCENT_COLOR: AccentColorKey = "green";

export function isAccentColorKey(value: string): value is AccentColorKey {
  return ACCENT_COLOR_PRESETS.some((p) => p.key === value);
}

export function getAccentColorPreset(key: AccentColorKey): AccentColorPreset {
  return ACCENT_COLOR_PRESETS.find((p) => p.key === key) ?? ACCENT_COLOR_PRESETS[0];
}
