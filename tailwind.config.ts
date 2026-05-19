import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: "#0b6e3a",
        feltDark: "#074d28",
        rail: "#3b1d0a",
      },
    },
  },
  plugins: [],
};
export default config;
