/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Fahrschule Abgefahrn brand — neon green on near-black (Figma "Mobile App" design system).
        brand: {
          DEFAULT: '#00FF24',
          dark: '#00CC1D',
          light: '#00FF24',
        },
        ink: {
          DEFAULT: '#040404', // text on green
          soft: '#171717',
        },
        // Design-system surfaces & lines
        bg: '#060706',
        card: '#121412',
        sheet: '#141614',
        surface: { DEFAULT: '#1C1E1C', 2: '#242724' },
        line: { DEFAULT: '#2A2D2A', strong: '#3B3F3B', green: '#1E3A22' },
        tile: { DEFAULT: '#0C2A12', map: '#0C140D' },
        muted: '#AEB4AE',
        dim: '#6E746C',
        danger: { DEFAULT: '#FF5A5A', bg: '#2A1113', ink: '#2A0A0A', toast: '#1A0E0F', line: '#4A1A1C' },
        success: { toast: '#0E1A10' },
      },
      fontFamily: {
        sans: ['Montserrat_500Medium'],
        'm-regular': ['Montserrat_400Regular'],
        'm-medium': ['Montserrat_500Medium'],
        'm-semibold': ['Montserrat_600SemiBold'],
        'm-bold': ['Montserrat_700Bold'],
        'm-xbold': ['Montserrat_800ExtraBold'],
        'm-black': ['Montserrat_900Black'],
        'm-blackitalic': ['Montserrat_900Black_Italic'],
      },
      borderRadius: {
        tile: '14px',
        input: '16px',
        toast: '18px',
        card: '20px',
        'card-lg': '24px',
        btn: '28px',
        sheet: '30px',
      },
    },
  },
  plugins: [],
}
