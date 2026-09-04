/**
 * accent/danger are stored as "R G B" CSS custom properties (see
 * src/index.css) so this can build a proper rgb(var(...) / <alpha-value>)
 * function - the plain `var(--accent)` string Tailwind used before couldn't
 * be combined with opacity modifiers like `bg-accent/[0.12]` or
 * `ring-accent/50`, so those utilities silently failed to generate and fell
 * back to Tailwind's own defaults (e.g. the ring utility's built-in blue).
 */
function withOpacity(cssVar) {
  return ({ opacityValue }) =>
    opacityValue === undefined ? `rgb(var(${cssVar}))` : `rgb(var(${cssVar}) / ${opacityValue})`;
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        system: [
          "-apple-system",
          "BlinkMacSystemFont",
          "\"SF Pro Text\"",
          "\"Segoe UI\"",
          "Inter",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        accent: {
          DEFAULT: withOpacity("--accent-rgb"),
          hover: withOpacity("--accent-hover-rgb"),
        },
        surface: {
          bg: "var(--surface-bg)",
          sidebar: "var(--surface-sidebar)",
          content: "var(--surface-content)",
          card: "var(--surface-card)",
          "card-hover": "var(--surface-card-hover)",
          modal: "var(--surface-modal)",
          border: "var(--surface-border)",
        },
        label: {
          primary: "var(--label-primary)",
          secondary: "var(--label-secondary)",
          tertiary: "var(--label-tertiary)",
        },
        danger: {
          DEFAULT: withOpacity("--danger-rgb"),
          hover: withOpacity("--danger-hover-rgb"),
        },
      },
      borderRadius: {
        apple: "12px",
        "apple-lg": "16px",
        "apple-sm": "8px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        modal: "var(--shadow-modal)",
        popover: "var(--shadow-popover)",
      },
      backdropBlur: {
        apple: "20px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "scale-in": "scale-in 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
