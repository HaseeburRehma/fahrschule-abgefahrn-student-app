import React, { useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Check } from 'phosphor-react-native/src/icons/Check'

import { useTranslation } from '@/lib/i18n'
import { formatPrice } from '@/lib/format'
import { displayName } from '@/lib/data'
import type { Package, Profile, TheoryTopic } from '@/lib/types'

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
            <Text className="flex-1 font-m-medium text-neutral-100">
              {locale === 'de' ? p.name_de : p.name_en}
            </Text>
            <Text className="text-sm font-m-bold text-brand">
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
          className={`text-xs font-m-semibold ${
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
              className={`text-xs font-m-semibold ${
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

/** Single-select chip row (same look as TopicPicker). */
export function ChipSelect<V extends string>({
  options,
  selected,
  onSelect,
  disabled,
}: {
  options: { value: V; label: string }[]
  selected: V | null
  onSelect: (v: V) => void
  disabled?: boolean
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === selected
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            disabled={disabled}
            className={`rounded-full border px-3 py-2 ${
              on ? 'border-brand bg-brand' : 'border-neutral-800 bg-neutral-900'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <Text
              className={`text-xs font-m-semibold ${
                on ? 'text-ink' : 'text-neutral-300'
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * Student search picker. With `allLabel`, a leading chip selects `null`
 * (e.g. "Für alle Fahrschüler"); otherwise tapping the selected chip clears it.
 */
export function StudentPicker({
  students,
  selected,
  onSelect,
  placeholder,
  allLabel,
  disabled,
}: {
  students: Profile[]
  selected: string | null
  onSelect: (id: string | null) => void
  placeholder: string
  allLabel?: string
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const current = students.find((s) => s.id === selected) ?? null
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = students.filter((s) => s.id !== selected)
    return (q
      ? list.filter((s) => `${displayName(s)} ${s.email ?? ''}`.toLowerCase().includes(q))
      : list
    ).slice(0, 6)
  }, [query, students, selected])

  const chip = (key: string, label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      disabled={disabled}
      className={`rounded-full border px-3 py-2 ${
        on ? 'border-brand bg-brand' : 'border-neutral-800 bg-neutral-900'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={`text-xs font-m-semibold ${on ? 'text-ink' : 'text-neutral-300'}`}>
        {label}
      </Text>
    </Pressable>
  )

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {allLabel ? chip('__all', allLabel, selected === null, () => onSelect(null)) : null}
        {current
          ? chip(current.id, allLabel ? displayName(current) : `${displayName(current)} ✕`, true, () =>
              allLabel ? undefined : onSelect(null),
            )
          : null}
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        placeholderTextColor="#A3A3A3"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
        className="font-m-medium w-full rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100"
      />
      {matches.length ? (
        <View className="flex-row flex-wrap gap-2">
          {matches.map((s) =>
            chip(s.id, displayName(s), false, () => {
              onSelect(s.id)
              setQuery('')
            }),
          )}
        </View>
      ) : null}
    </View>
  )
}
