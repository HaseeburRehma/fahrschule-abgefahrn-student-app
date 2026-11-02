/**
 * On iOS/Android NativeWind's css-interop drops a Pressable `style` written as a function,
 * so a `style={({ pressed }) => …}` on react-native's Pressable renders unstyled in the
 * release build (web hides the bug). Such Pressables must come from components/ds/pressable.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) return tsxFiles(p)
    return p.endsWith('.tsx') ? [p] : []
  })
}

describe('native Pressable styles', () => {
  it('function styles only on the design-system Pressable', () => {
    const offenders = [...tsxFiles(path.join(ROOT, 'app')), ...tsxFiles(path.join(ROOT, 'components'))]
      .filter((f) => !f.endsWith(path.join('ds', 'pressable.tsx')))
      .filter((f) => {
        const src = readFileSync(f, 'utf8')
        const rnImport = src.match(/import\s*\{([^}]*)\}\s*from\s*'react-native'/)
        const rnPressable = !!rnImport && /\bPressable\b/.test(rnImport[1])
        return rnPressable && /style=\{\(\s*\{?\s*pressed/.test(src)
      })
      .map((f) => path.relative(ROOT, f))
    expect(offenders).toEqual([])
  })
})
