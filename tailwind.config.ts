import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        body: ['"Roboto Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        display: ['"Sabbath Black"', "serif"],
        heading: ['"pragmatapro-fraktur"', "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
