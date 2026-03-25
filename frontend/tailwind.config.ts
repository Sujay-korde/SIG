import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "outline-variant": "#494847",
        "surface": "#0e0e0e",
        "surface-variant": "#262626",
        "surface-container": "#1a1919",
        "surface-container-low": "#131313",
        "surface-container-high": "#201f1f",
        "surface-container-highest": "#262626",
        "surface-container-lowest": "#000000",
        "on-surface": "#ffffff",
        "on-surface-variant": "#adaaaa",
        "primary": "#3adffa",
        "primary-container": "#00cbe6",
        "primary-dim": "#1ad0eb",
        "on-primary": "#004b56",
        "secondary": "#69f6b8",
        "secondary-dim": "#58e7ab",
        "tertiary": "#ff716a"
      },
      fontFamily: {
        headline: ["var(--font-space-grotesk)"],
        body: ["var(--font-inter)"],
        mono: ["var(--font-jetbrains-mono)"]
      },
      borderRadius: {
        DEFAULT: "0px",
        lg: "0px",
        xl: "0px",
        full: "9999px"
      },
      boxShadow: {
        ambient: "0 0 40px rgba(58, 223, 250, 0.06)",
        pulse: "0 0 15px rgba(58, 223, 250, 0.2)"
      },
      animation: {
        "dash": "dash 1s linear infinite",
        "sse-pulse": "sse-pulse 2.2s ease-in-out infinite"
      },
      keyframes: {
        dash: {
          to: { strokeDashoffset: "-8" }
        },
        "sse-pulse": {
          "0%, 100%": { boxShadow: "0 0 15px rgba(58,223,250,0.10)", opacity: "0.6" },
          "50%": { boxShadow: "0 0 15px rgba(58,223,250,0.28)", opacity: "1" }
        }
      }
    }
  },
  plugins: []
};

export default config;
