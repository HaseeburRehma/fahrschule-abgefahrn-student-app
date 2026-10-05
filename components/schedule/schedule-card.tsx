/**
 * Termine list card (Figma 1283:1473 upcoming / 1304:2587 past):
 * 46px tile + title/subtitle + status pill, divider, meta row (date · time · place).
 */

import React from 'react'
import { Pressable, View } from 'react-native'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots'
import { Clock } from 'phosphor-react-native/src/icons/Clock'
import { MapPin } from 'phosphor-react-native/src/icons/MapPin'

import { C, Pill, Skeleton, T, type PillTone } from '@/components/ds'

export function ScheduleCard({
  icon: Icon,
  title,
  subtitle,
  pill,
  date,
  time,
  place,
  past,
  dimmed,
  onPress,
  onLongPress,
  children,
}: {
  icon: PhosphorIcon
  title: string
  subtitle?: string
  pill: { label: string; tone: PillTone; icon?: PhosphorIcon }
  date: string
  time?: string
  place?: string
  /** Vergangen style: surface tile, muted icon, dim date-only meta, 85 % opacity */
  past?: boolean
  /** e.g. cancelled upcoming appointment */
  dimmed?: boolean
  onPress?: () => void
  onLongPress?: () => void
  children?: React.ReactNode
}) {
  const metaColor = past ? C.dim : C.muted
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 20,
          padding: 16,
          gap: 12,
          opacity: past || dimmed ? 0.85 : 1,
        },
        pressed && (onPress || onLongPress) ? { opacity: 0.75 } : null,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: past ? 13 : 14,
            backgroundColor: past ? C.surface : C.tile,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={24} color={past ? C.muted : C.brand} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="titleM" numberOfLines={past ? 1 : 2}>{title}</T>
          {subtitle ? (
            <T variant="bodyS" color={C.muted} numberOfLines={past ? 1 : 2}>
              {subtitle}
            </T>
          ) : null}
        </View>
        <Pill label={pill.label} tone={pill.tone} icon={pill.icon} />
      </View>
      <View style={{ height: 1, backgroundColor: C.line }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap', rowGap: 6 }}>
        <MetaItem icon={CalendarDots} text={date} color={metaColor} />
        {time ? <MetaItem icon={Clock} text={time} color={metaColor} /> : null}
        {place ? <MetaItem icon={MapPin} text={place} color={metaColor} shrink /> : null}
      </View>
      {children}
    </Pressable>
  )
}

function MetaItem({ icon: Icon, text, color, shrink }: { icon: PhosphorIcon; text: string; color: string; shrink?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: shrink ? 1 : 0 }}>
      <Icon size={16} color={color} />
      <T variant="bodyS" color={color} numberOfLines={1} style={shrink ? { flexShrink: 1 } : undefined}>
        {text}
      </T>
    </View>
  )
}

/** Skeleton placeholder matching the card's footprint. */
export function ScheduleCardSkeleton() {
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Skeleton width={46} height={46} radius={14} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="55%" height={14} />
          <Skeleton width="75%" height={11} />
        </View>
        <Skeleton width={72} height={26} radius={13} />
      </View>
      <View style={{ height: 1, backgroundColor: C.line }} />
      <Skeleton width="70%" height={12} />
    </View>
  )
}
