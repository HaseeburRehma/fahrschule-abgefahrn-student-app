/**
 * Shared pieces for the Theorie-Quiz & gamification screens (Figma sections 09 / 11):
 * mascot images, the green mascot stage, the light "Celebration Card" with
 * Tomorrow stats, the HUD (streak / XP / hearts) and the Mon–Sun day dots.
 */

import React from 'react'
import { Image, Pressable, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { Fire } from 'phosphor-react-native/src/icons/Fire'
import { Heart } from 'phosphor-react-native/src/icons/Heart'
import { Lightning } from 'phosphor-react-native/src/icons/Lightning'
import { Star } from 'phosphor-react-native/src/icons/Star'

import { C, F, FloatIdle, PopIn, PulseRing, T, useAppWidth } from '@/components/ds'
import type { DayState } from '@/lib/quiz/gamification'

/* eslint-disable @typescript-eslint/no-require-imports */
export const MASCOT = {
  /**
   * Full-body lion on green (Quiz Intro, Quiz gemeistert, Streak, Tagesziel). The 549×900
   * artwork sits at x=320 on a 1189×1420 canvas whose green is extended from its edges,
   * so it can be cropped anywhere without a seam.
   */
  stage: require('../../assets/mascot/stage.jpg'),
  think: require('../../assets/mascot/pose-think.png'),
}
/* eslint-enable @typescript-eslint/no-require-imports */

/** Figma "Mascot Video Tile": 64pt green tile with the whole lion (feedback sheet). Pops in. */
export function MascotTile() {
  return (
    <PopIn>
      <View
        style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: C.celebrate, overflow: 'hidden' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {/* lion (source y 318–822) scaled to ~56pt tall, centred */}
        <View style={{ position: 'absolute', left: 32, top: -33 }}>
          <StageImage lionW={61} />
        </View>
      </View>
    </PopIn>
  )
}

/**
 * Figma "Mascot Video BG": the full-body lion standing on a full-screen green
 * stage (09 Quiz Intro / Quiz gemeistert / Streak). At 390pt the image is 412pt
 * wide with its top 150pt above the screen, which puts the lion between y≈88
 * and y≈466 — the framing of the Figma video. Idle float = "Maskottchen".
 */
export function MascotStage() {
  const width = useAppWidth()
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // scale from the 390×844 frame; capped by height so tablets don't get a giant lion
  const s = Math.min(width / 390, height / 844)
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.celebrate, overflow: 'hidden' }}
    >
      <FloatIdle distance={8} style={{ position: 'absolute', left: width / 2, top: insets.top - 204 * s }}>
        <StageImage lionW={412 * s} />
      </FloatIdle>
    </View>
  )
}

/**
 * The stage artwork with the lion's 549px source frame rendered `lionW` wide,
 * horizontally centred on the parent's left edge (position the parent at the
 * centre line). Top of the source frame = top of this view.
 */
export function StageImage({ lionW }: { lionW: number }) {
  const k = lionW / 549
  return (
    <Image
      source={MASCOT.stage}
      resizeMode="cover"
      style={{ position: 'absolute', left: -(1189 / 2) * k, top: 0, width: 1189 * k, height: 1420 * k }}
    />
  )
}

/* ------------------------------------------------------------------ light celebration card */

export function PaperCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const width = useAppWidth()
  return (
    <View
      style={[
        {
          backgroundColor: C.paper,
          borderRadius: 28,
          padding: 20,
          gap: 13,
          // Figma: 16pt side margins, bottom 14pt above the screen edge (the home indicator sits over its padding)
          width: Math.min(width - 32, 520),
          alignSelf: 'center',
          marginBottom: 14,
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
export function PaperStats({ items }: { items: { value: string; label: string; tone: PaperTone }[] }) {
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
            gap: 3,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 6,
            backgroundColor: C.paperTileGreen,
          }}
        >
          <T style={{ fontFamily: F.tomorrowBold, fontSize: 19, lineHeight: 23 }} color={PAPER_TONE[s.tone]} numberOfLines={1}>
            {s.value}
          </T>
          <T style={{ fontFamily: F.tomorrowMedium, fontSize: 11, lineHeight: 13 }} color={C.paperSubGreen} numberOfLines={1}>
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
          height: primary ? 49 : 44,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? C.brand : C.paperTile,
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <T style={{ fontFamily: F.tomorrowBold, fontSize: primary ? 16 : 14, lineHeight: primary ? 19 : 17 }} color={primary ? C.paperDeep : C.paperInk}>
        {label}
      </T>
    </Pressable>
  )
}

export function PaperTitle({ title, subtitle, align = 'center' }: { title: string; subtitle?: string; align?: 'left' | 'center' }) {
  return (
    <View style={{ gap: 13 }}>
      <T style={{ fontFamily: F.tomorrowBold, fontSize: 26, lineHeight: 31, textAlign: align }} color={C.paperDeep} accessibilityRole="header">
        {title}
      </T>
      {subtitle ? (
        <T style={{ fontFamily: F.tomorrowMedium, fontSize: 14, lineHeight: 17, textAlign: align }} color={C.paperGreenText}>
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

/** Mon–Sun row: `light` = streak celebration card, otherwise the dark Tagesziel row. */
export function WeekDots({ days, labels, light }: { days: DayState[]; labels: string[]; light?: boolean }) {
  return light ? <LightWeek days={days} labels={labels} /> : <DarkWeek days={days} labels={labels} />
}

/** Figma 09/Streak: 34pt dots, 8pt apart, centred; ✓ done, ★ today (breathing). */
function LightWeek({ days, labels }: { days: DayState[]; labels: string[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
      {days.map((d, i) => {
        const done = d === 'done' || d === 'todayDone'
        const today = d === 'today' || d === 'todayDone'
        const bg = done ? C.brand : today ? '#DFF5E1' : C.paperTileGreen
        return (
          <View key={i} style={{ width: 34, alignItems: 'center', gap: 5 }}>
            <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
              {/* Figma "Streak-Puls" */}
              {today ? <PulseRing size={34} scaleTo={1.45} duration={1800} filled /> : null}
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                {done ? (
                  <Check size={16} color={C.paperDeep} weight="bold" />
                ) : today ? (
                  <Star size={14} color={C.paperGreen} weight="fill" />
                ) : null}
              </View>
            </View>
            <T style={{ fontFamily: F.tomorrowMedium, fontSize: 11, lineHeight: 13 }} color={C.paperSubGreen}>
              {labels[i]}
            </T>
          </View>
        )
      })}
    </View>
  )
}

/** Figma 11/Tagesziel: done = green pill with ✓, today = outlined pill with 🔥, rest = empty 38pt circles. */
function DarkWeek({ days, labels }: { days: DayState[]; labels: string[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      {days.map((d, i) => {
        const done = d === 'done' || d === 'todayDone'
        const today = d === 'today'
        return (
          <View key={i} style={{ alignItems: 'center', gap: 6, minWidth: 20 }}>
            {done ? (
              <View style={{ width: 18, height: 38, borderRadius: 19, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={18} color={C.onBrand} weight="bold" />
              </View>
            ) : today ? (
              <View
                style={{
                  width: 22,
                  height: 38,
                  borderRadius: 19,
                  borderWidth: 2,
                  borderColor: C.brand,
                  backgroundColor: 'rgba(0,255,36,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Fire size={18} color={C.brand} weight="fill" />
              </View>
            ) : (
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }} />
            )}
            <T variant="caption" color={today || d === 'todayDone' ? C.brand : C.dim}>
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
