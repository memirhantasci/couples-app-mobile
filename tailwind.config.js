/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#E8002D",
        "primary-dark": "#B5001F",
        "primary-glow": "rgba(232, 0, 45, 0.4)",
        surface: "#0A0A0C",
        "surface-2": "#1C1C1E",
        "surface-3": "#2C2C2E",
        border: "rgba(255,255,255,0.12)",
        "text-primary": "#FFFFFF",
        "text-secondary": "rgba(255,255,255,0.7)",
        "text-tertiary": "rgba(255,255,255,0.4)",
        "accent-pink": "#E5B9C5",
        "accent-pink-bg": "#311822",
      },
    },
  },
  plugins: [],
};
