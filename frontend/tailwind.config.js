/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: "#070b14",
        panel: "#0d1424",
        panel2: "#111b30",
        edge: "#1e2c47",
        accent: "#33e0c8",
        accent2: "#4d8dff",
        warn: "#ffb020",
        danger: "#ff5470",
      },
      keyframes: {
        radar: { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
        pulse2: { "0%,100%": { opacity: "0.25" }, "50%": { opacity: "1" } },
      },
      animation: {
        radar: "radar 4s linear infinite",
        pulse2: "pulse2 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
