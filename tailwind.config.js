/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        board: {
          bg: "#0B1220",
          panel: "#111A2E",
          panel2: "#0F1830",
          line: "#243252",
          ink: "#E8E6DC",
          dim: "#8B96AE",
          gold: "#D4A94A",
          up: "#4FAE7A",
          down: "#C75450",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.2em",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        flip: {
          "0%": { opacity: "0.3", transform: "translateY(-2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        flip: "flip 0.25s ease-out",
        "fade-up": "fadeUp 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};
