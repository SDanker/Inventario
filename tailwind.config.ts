import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff1f0",
          100: "#ffe1de",
          200: "#ffc4be",
          300: "#ff9a90",
          400: "#ff6759",
          500: "#e63329",
          600: "#c81f17",
          700: "#a31912",
          800: "#80140e",
          900: "#5c0e0a",
        },
      },
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
