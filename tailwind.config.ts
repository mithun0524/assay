import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        'logo-exit': 'logo-exit 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'loader-fade-out': 'loader-fade-out 0.8s ease-out forwards',
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};

export default config;