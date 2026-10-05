/**
 * Figma "DE/01 Splash" (1270:1146): glow, logo, "Dein Weg zum / Führerschein",
 * a slim progress bar and the school footer. Shown while the session resolves.
 */

import React, { useEffect, useRef } from 'react'
import { Animated, Easing, Platform, View } from 'react-native'

import { C, HeroGlow, HeroTitle, Logo, T } from '@/components/ds'
import { useT } from '@/lib/i18n'

export function SplashView() {
  const t = useT()
  const p = useRef(new Animated.Value(0.15)).current
  useEffect(() => {
    Animated.timing(p, { toValue: 0.9, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [p])
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, overflow: 'hidden', alignItems: 'center' }}>
      <HeroGlow top={150} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingBottom: 60 }}>
        <Logo width={250} />
        <HeroTitle size="L" align="center" line1={t('auth.splash.line1')} line2={t('auth.splash.line2')} variant1="headingL" />
      </View>
      <View style={{ position: 'absolute', bottom: Platform.OS === 'web' ? 70 : 90, alignItems: 'center', gap: 16 }}>
        <View style={{ width: 160, height: 4, borderRadius: 2, backgroundColor: C.surface, overflow: 'hidden' }}>
          <Animated.View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: C.brand,
              width: p.interpolate({ inputRange: [0, 1], outputRange: [0, 160] }),
              shadowColor: C.brand,
              shadowOpacity: 0.6,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        </View>
        <T variant="caption" color={C.dim} style={{ textAlign: 'center' }}>
          {'FAHRSCHULE ABGEFAHRN  DÜSSELDORF'}
        </T>
      </View>
    </View>
  )
}
