/**
 * Shared pieces for the Theorie-Quiz & gamification screens (Figma sections 09 / 11):
 * mascot images, speech bubble, the light "celebration" card with Tomorrow
 * stats, the HUD (streak / XP / hearts) and the Mon–Sun day dots.
 */

import React from 'react'
import { Image, Pressable, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { Fire } from 'phosphor-react-native/src/icons/Fire'
import { Heart } from 'phosphor-react-native/src/icons/Heart'
import { Lightning } from 'phosphor-react-native/src/icons/Lightning'

import { C, F, FloatIdle, PopIn, PulseRing, T } from '@/components/ds'
import type { DayState } from '@/lib/quiz/gamification'

/* eslint-disable @typescript-eslint/no-require-imports */
export const MASCOT = {
  /** waving head-and-shoulders on a light background (Quiz Intro, Tagesziel card) */
  wave: require('../../assets/mascot/wave.jpg'),
  /** full-body lion on green (Lektion gemeistert, Streak) */
  celebrate: require('../../assets/mascot/celebrate.jpg'),
  thumbs: require('../../assets/mascot/pose-thumbs.png'),
  think: require('../../assets/mascot/pose-think.png'),
}
/* eslint-enable @typescript-eslint/no-require-imports */

/** Figma "Mascot/Placeholder": rounded mascot avatar used in the feedback sheet. */
export function MascotAvatar({ pose, size = 64 }: { pose: 'thumbs' | 'think'; size?: number }) {
  return (
    <PopIn>
    <View
      style={{ width: size, height: size, borderRadius: 16, backgroundColor: '#FEFBFA', overflow: 'hidden' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={MASCOT[pose]} resizeMode="contain" style={{ width: size, height: size }} />
    </View>
    </PopIn>
  )
}

/** Full-bleed mascot background (decorative) with the Figma "Maskottchen" idle float. */
export function MascotBackdrop({ source, style }: { source: number; style?: StyleProp<ImageStyle> }) {
  return (
    <FloatIdle distance={8} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Image
        source={source}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }, style]}
      />
    </FloatIdle>
  )
}

/** Figma "Speech Bubble": dark bubble with a downward tail. */
export function SpeechBubble({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignSelf: 'flex-start', maxWidth: 240 }, style]}>
      <View
        style={{
          backgroundColor: C.surface,
          borderColor: C.line,
          borderWidth: 1,
          borderRadius: 18,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <T variant="bodyL">{children}</T>
      </View>
      <View
        style={{
          marginLeft: 16,
          width: 0,
          height: 0,
          borderLeftWidth: 9,
          borderRightWidth: 9,
          borderTopWidth: 10,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: C.surface,
        }}
      />
    </View>
  )
}

/* ------------------------------------------------------------------ light celebration card */

export function PaperCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: C.paper,
          borderRadius: 28,
          paddingHorizontal: 20,
          paddingVertical: 22,
          gap: 16,
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export type PaperTone = 'green' | 'pink' | 'gold' | 'blue'
const PAPER_TONE: Record<PaperTone, string> = {
  green: C.paperGreen,
  pink: C.paperPink,
  gold: C.paperGoldText,
  blue: C.paperBlue,
}

/** Three-up stat tiles ("10 Fragen · 5 Leben · +50 Punkte"). */
export function PaperStats({
  items,
  tint = 'neutral',
}: {
  items: { value: string; label: string; tone: PaperTone }[]
  /** neutral = #F1F3EF tiles (intro), green = #EDF4EA tiles (results) */
  tint?: 'neutral' | 'green'
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {items.map((s) => (
        <View
          key={s.label}
          accessible
          accessibilityLabel={`${s.value} ${s.label}`}
          style={{
            flex: 1,
            alignItems: 'center',
            gap: 4,
            borderRadius: 16,
            paddingVertical: 16,
            paddingHorizontal: 8,
            backgroundColor: tint === 'green' ? C.paperTileGreen : C.paperTile,
          }}
        >
          <T style={{ fontFamily: F.tomorrowBold, fontSize: 22 }} color={PAPER_TONE[s.tone]}>
            {s.value}
          </T>
          <T style={{ fontFamily: F.tomorrowMedium, fontSize: 12 }} color={tint === 'green' ? C.paperSubGreen : C.paperSub}>
            {s.label}
          </T>
        </View>
      ))}
    </View>
  )
}

/** Primary pill on the light card (Tomorrow Bold, dark green text). */
export function PaperButton({ label, onPress, variant = 'primary' }: { label: string; onPress: () => void; variant?: 'primary' | 'soft' }) {
  const primary = variant === 'primary'
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          height: primary ? 54 : 46,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? C.brand : C.paperTile,
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <T style={{ fontFamily: F.tomorrowBold, fontSize: primary ? 16 : 14 }} color={primary ? C.paperDeep : C.paperInk}>
        {label}
      </T>
    </Pressable>
  )
}

export function PaperTitle({ title, subtitle, align = 'center' }: { title: string; subtitle?: string; align?: 'left' | 'center' }) {
  return (
    <View style={{ gap: 4 }}>
      <T style={{ fontFamily: F.tomorrowBold, fontSize: 26, textAlign: align }} color={C.paperDeep} accessibilityRole="header">
        {title}
      </T>
      {subtitle ? (
        <T style={{ fontFamily: F.tomorrowMedium, fontSize: 14, textAlign: align }} color={C.paperGreenText}>
          {subtitle}
        </T>
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------------ HUD */

/** Figma "HUD/Resources": 🔥 streak · ⚡ XP · ❤ lives. Omitted values are hidden. */
export function Hud({ streak, xp, lives }: { streak?: number; xp?: string; lives?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      {streak !== undefined ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Fire size={22} color={C.gold} weight="fill" />
          <T variant="headingM">{String(streak)}</T>
        </View>
      ) : null}
      {xp !== undefined ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Lightning size={22} color={C.brand} weight="fill" />
          <T variant="headingM">{xp}</T>
        </View>
      ) : null}
      {lives !== undefined ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Heart size={22} color={C.heart} weight="fill" />
          <T variant="headingM">{String(lives)}</T>
        </View>
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------------ week dots */

/** Mon–Sun row. `light` = streak celebration card, otherwise the dark Tagesziel row. */
export function WeekDots({ days, labels, light }: { days: DayState[]; labels: string[]; light?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
      {days.map((d, i) => {
        const done = d === 'done' || d === 'todayDone'
        const today = d === 'today' || d === 'todayDone'
        let bg: string = light ? C.paperTileGreen : C.surface
        let border: string | undefined
        if (done) bg = C.brand
        else if (today) {
          bg = light ? '#DFF5E1' : C.tile
          border = light ? undefined : C.brand
        }
        return (
          <View key={i} style={{ alignItems: 'center', gap: 5, flex: 1 }}>
            <View style={{ width: light ? 34 : 36, height: light ? 34 : 36, alignItems: 'center', justifyContent: 'center' }}>
            {/* Figma "Streak-Puls": today's dot breathes */}
            {today ? <PulseRing size={light ? 34 : 36} scaleTo={1.45} duration={1800} filled /> : null}
            <View
              style={{
                width: light ? 34 : 36,
                height: light ? 34 : 36,
                borderRadius: 999,
                backgroundColor: bg,
                borderWidth: border ? 1.5 : 0,
                borderColor: border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {done ? (
                <Check size={16} color={light ? C.paperDeep : C.onBrand} weight="bold" />
              ) : today ? (
                <Fire size={16} color={light ? C.paperGreen : C.brand} weight="fill" />
              ) : null}
            </View>
            </View>
            <T
              style={light ? { fontFamily: F.tomorrowMedium, fontSize: 11 } : undefined}
              variant={light ? undefined : 'caption'}
              color={light ? C.paperSubGreen : today ? C.brand : C.dim}
            >
              {labels[i]}
            </T>
          </View>
        )
      })}
    </View>
  )
}

export const WEEKDAY_LABELS = {
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
}
