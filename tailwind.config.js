/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Fahrschule Abgefahrn brand — neon green on near-black.
        brand: {
          DEFAULT: '#22C55E', // green-500
          dark: '#15803D', // green-700
          light: '#DCFCE7', // green-100
        },
        ink: {
          DEFAULT: '#0A0A0A', // near-black surfaces
          soft: '#171717', // neutral-900
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
}
