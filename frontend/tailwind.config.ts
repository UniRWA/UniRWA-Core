import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FF5C16',
          'orange-light': '#FFA680',
          purple: '#D075FF',
          'purple-light': '#EAC2FF',
          cream: '#FFF5F0',
          dark: '#0A0A0E',
          'dark-4': '#24242E',
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        heroIn: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%,100%': { opacity: '0.15' },
          '50%': { opacity: '0.25' },
        },
      },
      animation: {
        float: 'float 5s ease-in-out infinite',
        heroIn: 'heroIn 0.7s cubic-bezier(0.4,0,0.2,1) forwards',
        pulseSoft: 'pulseSoft 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
