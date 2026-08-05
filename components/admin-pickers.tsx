import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { formatPrice } from '@/lib/format'
import type { Package, TheoryTopic } from '@/lib/types'

export function PackagePicker({
  packages,
  selected,
  onToggle,
}: {
  packages: Package[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  const { locale } = useTranslation()
  return (
    <View className="gap-2">
      {packages.map((p) => {
        const on = selected.includes(p.id)
        return (
          <Pressable
            key={p.id}
            onPress={() => onToggle(p.id)}
            className={`flex-row items-center gap-3 rounded-xl border px-3 py-3 ${
              on ? 'border-brand bg-brand/10' : 'border-neutral-800 bg-neutral-900'
            }`}
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded-md border ${
                on ? 'border-brand bg-brand' : 'border-neutral-700 bg-neutral-900'
              }`}
            >
              {on ? <Check size={14} color="#0A0A0A" /> : null}
            </View>
            <Text className="flex-1 font-medium text-neutral-100">
              {locale === 'de' ? p.name_de : p.name_en}
            </Text>
            <Text className="text-sm font-bold text-brand">
              {formatPrice(Number(p.price_eur), locale)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function TopicPicker({
  topics,
  selected,
  onSelect,
}: {
  topics: TheoryTopic[]
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const { t, locale } = useTranslation()
  return (
    <View className="flex-row flex-wrap gap-2">
      <Pressable
        onPress={() => onSelect(null)}
        className={`rounded-full border px-3 py-2 ${
          selected === null
            ? 'border-neutral-800 bg-neutral-800'
            : 'border-neutral-800 bg-neutral-900'
        }`}
      >
        <Text
          className={`text-xs font-semibold ${
            selected === null ? 'text-white' : 'text-neutral-400'
          }`}
        >
          {t('common.none')}
        </Text>
      </Pressable>
      {topics.map((tp) => {
        const on = tp.id === selected
        return (
          <Pressable
            key={tp.id}
            onPress={() => onSelect(tp.id)}
            className={`rounded-full border px-3 py-2 ${
              on ? 'border-brand bg-brand' : 'border-neutral-800 bg-neutral-900'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                on ? 'text-ink' : 'text-neutral-300'
              }`}
            >
              {tp.number}. {locale === 'de' ? tp.title_de : tp.title_en}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
