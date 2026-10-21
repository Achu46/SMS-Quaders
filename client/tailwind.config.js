/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: '#ED7751',
          dark: '#D9603B',
          light: '#FBEAE3',
          glow: 'rgba(237, 119, 81, 0.35)',
          subtle: 'rgba(237, 119, 81, 0.08)',
        },
        cream: '#FFFDFB',
        charcoal: '#2B2926',
        grayText: '#6B6862',
        lightGray: '#F5F3F0',
        darkBg: '#181614',
        darkCard: '#22201D',
        darkBorder: 'rgba(237, 119, 81, 0.15)',
        primary: {
          50: '#FBEAE3',
          100: '#F7D5C9',
          200: '#F3B7A3',
          300: '#EE987D',
          400: '#EA8464',
          500: '#ED7751',
          600: '#D9603B',
          700: '#BF4C2A',
          800: '#9B3B1F',
          900: '#782D17',
          950: '#421609',
        }
      },
    },
  },
  plugins: [],
}
