import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        body: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        heading: ['"pragmatapro-fraktur"', "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
