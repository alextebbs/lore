import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        body: [
          '"IBM Plex Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
        display: ['"Sabbath Black"', "serif"],
        heading: ['"pragmatapro-fraktur"', "serif"],
        placeholder: ['"Viking"', "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
