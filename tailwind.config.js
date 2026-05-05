/** @type {import('tailwindcss').Config} */
// Keep in sync with constants/designTokens.ts (Tailwind runs in plain Node).
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      borderRadius: {
        pill: 9999,
      },
      colors: {
        background: "#0F0F0F",
        card: "#1A1A1A",
        accent: "#A5E8FD",
        "accent-fg": "#163843",
        heading: "#2A6174",
        income: "#8AE2FB",
        text: "#FFFFFF",
        muted: "#9CA3AF",
      },
    },
  },
  plugins: [],
};
