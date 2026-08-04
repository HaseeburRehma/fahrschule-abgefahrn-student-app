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
              on ? 'border-brand bg-brand-light' : 'border-neutral-200 bg-white'
            }`}
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded-md border ${
                on ? 'border-brand bg-brand' : 'border-neutral-300 bg-white'
              }`}
            >
              {on ? <Check size={14} color="#0A0A0A" /> : null}
            </View>
            <Text className="flex-1 font-medium text-neutral-900">
              {locale === 'de' ? p.name_de : p.name_en}
            </Text>
            <Text className="text-sm font-bold text-brand-dark">
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
            : 'border-neutral-200 bg-white'
        }`}
      >
        <Text
          className={`text-xs font-semibold ${
            selected === null ? 'text-white' : 'text-neutral-600'
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
              on ? 'border-brand bg-brand' : 'border-neutral-200 bg-white'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                on ? 'text-ink' : 'text-neutral-700'
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
