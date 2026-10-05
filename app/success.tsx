/**
 * Figma "DE/Erfolg" (1298:2229): celebration after passing an exam.
 * Open with `/success?exam=theory|practical`; without the param it falls back to the profile flags.
 */

import React, { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight'
import { Confetti } from 'phosphor-react-native/src/icons/Confetti'
import { Medal } from 'phosphor-react-native/src/icons/Medal'
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle'
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel'
import { Trophy } from 'phosphor-react-native/src/icons/Trophy'
import { X } from 'phosphor-react-native/src/icons/X'

import { Button, C, F, IconButton, Screen, T } from '@/components/ds'
import { useT } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'

const AMBER = '#FFC83D'

export default function Success() {
  const t = useT()
  const { profile } = useUser()
  const params = useLocalSearchParams<{ exam?: string }>()
  const exam: 'theory' | 'practical' =
    params.exam === 'practical' || params.exam === 'theory'
      ? params.exam
      : profile?.practical_passed
        ? 'practical'
        : 'theory'
  const name = (profile?.first_name ?? '').trim()

  const scale = useRef(new Animated.Value(0.6)).current
  const fade = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }),
    ]).start()
  }, [scale, fade])

  const close = () => (router.canGoBack() ? router.back() : router.replace('/home' as any))
  const toRoad = () => router.replace('/progress' as any)

  const body =
    exam === 'theory'
      ? name
        ? t('success.v2.theoryBody', { name })
        : t('success.v2.theoryBodyNoName')
      : name
        ? t('success.v2.practicalBody', { name })
        : t('success.v2.practicalBodyNoName')

  return (
    <Screen glow={60} gap={0} contentStyle={{ paddingTop: 10 }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <IconButton icon={X} tone="plain" onPress={close} accessibilityLabel={t('ds.close')} />
      </View>

      {/* Medal cluster (180×180) */}
      <Animated.View style={{ width: 180, height: 180, alignSelf: 'center', marginTop: 72, transform: [{ scale }] }}>
        <View
          style={{
            position: 'absolute',
            left: 20,
            top: 20,
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: C.brand,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: C.brand,
            shadowOpacity: 0.7,
            shadowRadius: 25,
            shadowOffset: { width: 0, height: 0 },
            elevation: 12,
          }}
        >
          <Medal size={80} color={C.onBrand} weight="fill" />
        </View>
        <View style={{ position: 'absolute', left: 4, top: 18 }}>
          <Sparkle size={28} color={AMBER} weight="fill" />
        </View>
        <View style={{ position: 'absolute', left: 150, top: 30 }}>
          <Sparkle size={20} color={C.brand} weight="fill" />
        </View>
        <View style={{ position: 'absolute', left: 150, top: 140 }}>
          <Confetti size={26} color={AMBER} weight="fill" />
        </View>
        <View style={{ position: 'absolute', left: 10, top: 150 }}>
          <Sparkle size={18} color={C.white} weight="fill" />
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: fade }}>
        {/* Title + body */}
        <View style={{ marginTop: 40, paddingHorizontal: 12, gap: 12, alignItems: 'center' }}>
          <View style={{ alignItems: 'center' }}>
            <T
              color={C.brand}
              style={{ fontFamily: F.black, fontSize: 44, lineHeight: 46, letterSpacing: -0.88, textAlign: 'center' }}
            >
              {t('success.v2.title')}
            </T>
            <T variant="headingL" style={{ textAlign: 'center' }}>
              {exam === 'theory' ? t('success.v2.theory') : t('success.v2.practical')}
            </T>
          </View>
          <T variant="bodyL" color={C.muted} style={{ textAlign: 'center' }}>
            {body}
          </T>
        </View>

        {/* Next stage */}
        <View
          style={{
            marginTop: 22,
            marginHorizontal: 4,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.lineGreen,
            borderRadius: 18,
            paddingLeft: 14,
            paddingRight: 16,
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center' }}>
            {exam === 'theory' ? (
              <SteeringWheel size={24} color={C.brand} weight="fill" />
            ) : (
              <Trophy size={24} color={C.brand} weight="fill" />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="caption" color={C.brand}>
              {(exam === 'theory' ? t('success.v2.nextLabel') : t('success.v2.goalLabel')).toUpperCase()}
            </T>
            <T variant="titleM">{exam === 'theory' ? t('success.v2.nextTheory') : t('success.v2.nextPractical')}</T>
          </View>
        </View>

        <View style={{ marginTop: 36, marginHorizontal: 4 }}>
          <Button label={t('success.v2.cta')} iconRight={ArrowRight} onPress={toRoad} />
        </View>
      </Animated.View>
    </Screen>
  )
}
