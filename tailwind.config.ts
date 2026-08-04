import type { Config } from "tailwindcss";

type ColorWithOpacity = ({ opacityValue }: { opacityValue?: string }) => string;

const withAlpha = (variable: string): ColorWithOpacity =>
  ({ opacityValue }) =>
    opacityValue ? `rgb(var(${variable}) / ${opacityValue})` : `rgb(var(${variable}))`;

const config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: withAlpha("--color-bg"),
        surface: withAlpha("--color-surface"),
        "surface-alt": withAlpha("--color-surface-alt"),
        ink: withAlpha("--color-ink"),
        "ink-muted": withAlpha("--color-ink-muted"),
        "ink-faint": withAlpha("--color-ink-faint"),
        border: withAlpha("--color-border"),
        accent: withAlpha("--color-accent"),
        "accent-strong": withAlpha("--color-accent-strong"),
        "accent-soft": withAlpha("--color-accent-soft"),
        critical: withAlpha("--color-critical"),
        "critical-soft": withAlpha("--color-critical-soft"),
        high: withAlpha("--color-high"),
        "high-soft": withAlpha("--color-high-soft"),
        medium: withAlpha("--color-medium"),
        "medium-soft": withAlpha("--color-medium-soft"),
        low: withAlpha("--color-low"),
        "low-soft": withAlpha("--color-low-soft"),
        positive: withAlpha("--color-positive"),
        "positive-soft": withAlpha("--color-positive-soft"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(20 24 31 / 0.04), 0 1px 0 rgb(20 24 31 / 0.03)",
        panel: "0 1px 3px rgb(20 24 31 / 0.06), 0 8px 24px -12px rgb(20 24 31 / 0.10)",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-4%)" },
          "50%": { transform: "translateY(104%)" },
          "100%": { transform: "translateY(-4%)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        scan: "scan 2.4s cubic-bezier(0.65, 0, 0.35, 1) infinite",
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config as unknown as Config;
