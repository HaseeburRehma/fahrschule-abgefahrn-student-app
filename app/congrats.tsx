import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Dimensions, Easing, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'

import { useTranslation } from '@/lib/i18n'
import { Brand } from '@/components/ui'

const CONFETTI = ['🎉', '🎊', '✨', '🟢', '🦁', '🚗']

function Confetti() {
  const { width, height } = Dimensions.get('window')
  const pieces = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        key: i,
        x: Math.random() * width,
        delay: Math.random() * 1500,
        dur: 2500 + Math.random() * 2000,
        emoji: CONFETTI[i % CONFETTI.length],
        size: 18 + Math.random() * 14,
      })),
    [width],
  )
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {pieces.map((p) => (
        <Piece
          key={p.key}
          x={p.x}
          delay={p.delay}
          dur={p.dur}
          emoji={p.emoji}
          size={p.size}
          height={height}
        />
      ))}
    </View>
  )
}

function Piece({
  x,
  delay,
  dur,
  emoji,
  size,
  height,
}: {
  x: number
  delay: number
  dur: number
  emoji: string
  size: number
  height: number
}) {
  const y = useRef(new Animated.Value(-40)).current
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(y, {
        toValue: height + 40,
        duration: dur,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    anim.start()
    return () => anim.stop()
  }, [y, dur, delay, height])
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: x,
        fontSize: size,
        transform: [{ translateY: y }],
      }}
    >
      {emoji}
    </Animated.Text>
  )
}

export default function Congrats() {
  const { t } = useTranslation()
  const router = useRouter()
  const scale = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start()
  }, [scale])

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />
      <Confetti />
      <View className="flex-1 items-center justify-center gap-6 px-8">
        <Animated.View style={{ transform: [{ scale }] }}>
          <Brand size={110} />
        </Animated.View>
        <Text className="text-center text-3xl font-extrabold text-neutral-100">
          {t('exam.congrats')}
        </Text>
        <Text className="text-center text-base text-neutral-300">
          {t('exam.congratsBody')}
        </Text>
        <Pressable
          onPress={() => router.replace('/(tabs)/home')}
          className="mt-4 rounded-2xl bg-brand px-8 py-4"
        >
          <Text className="text-base font-bold text-ink">{t('common.close')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
