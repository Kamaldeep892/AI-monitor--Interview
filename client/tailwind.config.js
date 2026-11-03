/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        obsidian: {
          950: '#090612',
          900: '#0F0A1E',
          800: '#17112B',
          700: '#231A40',
        },
        brand: {
          500: '#7C3AED',
          600: '#6D28D9',
          400: '#A78BFA',
        },
      },
    },
  },
  plugins: [],
};
