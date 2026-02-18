import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef9f2",
          500: "#2f855a",
          700: "#22543d"
        }
      }
    }
  },
  plugins: []
};

export default config;
