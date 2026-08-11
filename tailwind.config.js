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
          DEFAULT: '#00FF24', // Abgefahrn neon green (brand CI)
          dark: '#00CC1D',
          light: '#00FF24',
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
