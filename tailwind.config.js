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
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
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
          DEFAULT: "var(--danger)",
          hover: "var(--danger-hover)",
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
