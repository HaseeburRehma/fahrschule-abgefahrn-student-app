/**
 * Design tokens from the Figma "Mobile App" design system (Fahrschule Abgefahrn).
 * Use these for values NativeWind classes can't express (icon colors, shadows, SVG strokes).
 */

export const C = {
  bg: '#060706',
  card: '#121412',
  sheet: '#141614',
  surface: '#1C1E1C',
  surface2: '#242724',
  line: '#2A2D2A',
  lineStrong: '#3B3F3B',
  lineGreen: '#1E3A22',
  tile: '#0C2A12',
  tileMap: '#0C140D',
  brand: '#00FF24',
  onBrand: '#040404',
  white: '#FFFFFF',
  muted: '#AEB4AE',
  dim: '#6E746C',
  danger: '#FF5A5A',
  dangerBg: '#2A1113',
  dangerInk: '#2A0A0A',
  dangerToast: '#1A0E0F',
  dangerLine: '#4A1A1C',
  successToast: '#0E1A10',
  overlay: 'rgba(0,0,0,0.65)',
} as const

export const F = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  xbold: 'Montserrat_800ExtraBold',
  black: 'Montserrat_900Black',
  blackItalic: 'Montserrat_900Black_Italic',
} as const

/** Typography styles (Figma text styles). */
export const TYPE = {
  displayXL: { fontFamily: F.black, fontSize: 44, lineHeight: 46, letterSpacing: -0.88 },
  emphasisXL: { fontFamily: F.blackItalic, fontSize: 44, lineHeight: 46, letterSpacing: -0.88 },
  displayL: { fontFamily: F.black, fontSize: 34, lineHeight: 38, letterSpacing: -0.68 },
  emphasisL: { fontFamily: F.blackItalic, fontSize: 26, lineHeight: 30, letterSpacing: -0.26 },
  headingXL: { fontFamily: F.xbold, fontSize: 26, lineHeight: 30, letterSpacing: -0.39 },
  headingL: { fontFamily: F.xbold, fontSize: 22, lineHeight: 26, letterSpacing: -0.22 },
  headingM: { fontFamily: F.bold, fontSize: 18, lineHeight: 22, letterSpacing: -0.09 },
  emphasisM: { fontFamily: F.blackItalic, fontSize: 18, lineHeight: 22, letterSpacing: -0.09 },
  titleM: { fontFamily: F.semibold, fontSize: 16, lineHeight: 20, letterSpacing: 0 },
  bodyL: { fontFamily: F.medium, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyM: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyS: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  labelL: { fontFamily: F.semibold, fontSize: 15, lineHeight: 18, letterSpacing: 0 },
  labelM: { fontFamily: F.semibold, fontSize: 13, lineHeight: 16, letterSpacing: 0.026 },
  caption: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.024 },
  nav: { fontFamily: F.semibold, fontSize: 11, lineHeight: 13, letterSpacing: 0.022 },
  button: { fontFamily: F.semibold, fontSize: 16, lineHeight: 20, letterSpacing: 0 },
} as const

export type TypeVariant = keyof typeof TYPE

/** Shadows / glows (Figma effects). On web these map to box-shadow. */
export const GLOW = {
  /** Glow/Green — primary buttons */
  button: {
    shadowColor: '#00FF24',
    shadowOpacity: 0.45,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  /** Highlighted card (e.g. "Deine Strecke") */
  card: {
    shadowColor: '#00FF24',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  /** Small green tiles (map pin, FAB) */
  tile: {
    shadowColor: '#00FF24',
    shadowOpacity: 0.45,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  /** Shadow/Nav — bottom navigation */
  nav: {
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  /** Toasts */
  toast: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
} as const
