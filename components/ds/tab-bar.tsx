/**
 * Figma "BottomNav" (1269:1271): #121412, 1px top line, 5 items, green 22×3 indicator,
 * 26px Phosphor icon (fill + glow when active), Nav label.
 */

import React from 'react'
import { Pressable, View } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots'
import { ChartLineUp } from 'phosphor-react-native/src/icons/ChartLineUp'
import { House } from 'phosphor-react-native/src/icons/House'
import { User } from 'phosphor-react-native/src/icons/User'

import { C, GLOW } from './tokens'
import { T } from './primitives'
import { useT } from '@/lib/i18n'

const ITEMS: Record<string, { icon: PhosphorIcon; label: string }> = {
  home: { icon: House, label: 'nav.home' },
  theory: { icon: BookOpen, label: 'nav.theory' },
  schedule: { icon: CalendarDots, label: 'nav.schedule' },
  progress: { icon: ChartLineUp, label: 'nav.progress' },
  profile: { icon: User, label: 'nav.profile' },
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const t = useT()
  return (
    <View style={[{ backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingBottom: Math.max(insets.bottom - 6, 6) }, GLOW.nav]}>
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 6 }}>
        {state.routes.map((route, index) => {
          const item = ITEMS[route.name]
          if (!item) return null
          const active = state.index === index
          const Icon = item.icon
          const color = active ? C.brand : C.dim
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(item.label)}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
                if (!active && !e.defaultPrevented) navigation.navigate(route.name as never)
              }}
              style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <View style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: active ? C.brand : 'transparent' }} />
              <View style={active ? { ...GLOW.tile, shadowOpacity: 0.55, shadowRadius: 9, elevation: 0 } : null}>
                <Icon size={26} color={color} weight={active ? 'fill' : 'regular'} />
              </View>
              {/* "Fortschritt" is wider than a 320pt-wide tab slot — shrink instead of "Fortsch…" */}
              <T variant="nav" color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ maxWidth: '100%' }}>
                {t(item.label)}
              </T>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
