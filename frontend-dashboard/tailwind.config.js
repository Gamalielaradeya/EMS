/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--color-border)",
        input: "var(--color-border-strong)",
        ring: "var(--color-focus)",
        background: "var(--color-paper)",
        foreground: "var(--color-ink)",
        primary: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          foreground: "var(--color-accent-ink)",
        },
        secondary: {
          DEFAULT: "var(--color-surface-strong)",
          foreground: "var(--color-ink)",
        },
        muted: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-muted)",
        },
        accent: {
          DEFAULT: "var(--color-accent-soft)",
          foreground: "var(--color-accent-strong)",
        },
        destructive: {
          DEFAULT: "var(--color-danger)",
          foreground: "var(--color-danger-ink)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          soft: "var(--color-success-soft)",
          foreground: "var(--color-success-ink)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          soft: "var(--color-warning-soft)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          soft: "var(--color-danger-soft)",
        },
        neutral: {
          soft: "var(--color-neutral-soft)",
        },
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-ink)",
        },
        sidebar: {
          DEFAULT: "var(--color-sidebar)",
          foreground: "var(--color-sidebar-ink)",
          muted: "var(--color-sidebar-muted)",
          active: "var(--color-sidebar-active)",
          raised: "var(--color-sidebar-raised)",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        floating: "var(--shadow-floating)",
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
}
