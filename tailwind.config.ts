import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        pikol: {
          bg: "rgb(var(--pikol-bg-rgb) / <alpha-value>)",
          deep: "rgb(var(--pikol-deep-rgb) / <alpha-value>)",
          surface: "rgb(var(--pikol-surface-rgb) / <alpha-value>)",
          raised: "rgb(var(--pikol-raised-rgb) / <alpha-value>)",
          primary: "rgb(var(--pikol-primary-rgb) / <alpha-value>)",
          secondary: "rgb(var(--pikol-secondary-rgb) / <alpha-value>)",
          cyan: "rgb(var(--pikol-cyan-rgb) / <alpha-value>)",
          purple: "rgb(var(--pikol-purple-rgb) / <alpha-value>)",
          pink: "rgb(var(--pikol-pink-rgb) / <alpha-value>)",
          silver: "rgb(var(--pikol-silver-rgb) / <alpha-value>)",
          gold: "rgb(var(--pikol-gold-rgb) / <alpha-value>)",
          success: "rgb(var(--pikol-success-rgb) / <alpha-value>)",
          warning: "rgb(var(--pikol-warning-rgb) / <alpha-value>)",
          danger: "rgb(var(--pikol-danger-rgb) / <alpha-value>)",
          text: "rgb(var(--pikol-text-rgb) / <alpha-value>)",
          muted: "rgb(var(--pikol-muted-rgb) / <alpha-value>)",
          border: "rgb(var(--pikol-border-rgb) / <alpha-value>)",
          focus: "rgb(var(--pikol-focus-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      transitionTimingFunction: {
        retro: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      opacity: {
        12: "0.12",
        14: "0.14",
        35: "0.35",
        45: "0.45",
        55: "0.55",
        65: "0.65",
        85: "0.85",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
