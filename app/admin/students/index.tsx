import React, { useCallback, useMemo, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { UserPlus } from 'phosphor-react-native/src/icons/UserPlus'
import { CaretRight as ChevronRight } from 'phosphor-react-native/src/icons/CaretRight'
import { Prohibit as CircleSlash } from 'phosphor-react-native/src/icons/Prohibit'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'

import { useTranslation } from '@/lib/i18n'
import { fetchStudentsWithPlans, type StudentWithPlan } from '@/lib/admin'
import { displayName } from '@/lib/data'
import { Loader } from '@/components/ui'

export default function StudentsList() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [rows, setRows] = useState<StudentWithPlan[] | null>(null)
  const [query, setQuery] = useState('')

  useFocusEffect(
    useCallback(() => {
      let alive = true
      fetchStudentsWithPlans()
        .then((s) => alive && setRows(s))
        .catch(() => alive && setRows([]))
      return () => {
        alive = false
      }
    }, []),
  )

  const filtered = useMemo(() => {
    const list = rows ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => {
      const hay = `${displayName(r.profile)} ${r.profile.email ?? ''} ${
        r.profile.phone ?? ''
      }`.toLowerCase()
      return hay.includes(q)
    })
  }, [rows, query])

  if (rows === null) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: `${t('admin.students')} (${rows.length})` }} />
      <FlatList
        data={filtered}
        keyExtractor={(s) => s.profile.id}
        contentContainerClassName="p-5 gap-2"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="mb-1 gap-2">
            <Pressable
              onPress={() => router.push('/admin/students/new')}
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-4"
            >
              <UserPlus size={18} color="#0A0A0A" />
              <Text className="font-m-bold text-ink">{t('admin.addStudent')}</Text>
            </Pressable>
            {rows.length > 0 ? (
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('admin.searchStudents')}
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                className="font-m-medium rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-base text-neutral-100"
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const p = item.profile
          return (
            <Pressable
              onPress={() => router.push(`/admin/students/${p.id}`)}
              className="flex-row items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                <Text className="font-m-black text-brand">
                  {(displayName(p) || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                  <Text className="font-m-semibold text-neutral-100">
                    {displayName(p) || p.email}
                  </Text>
                  {!p.is_active ? (
                    <CircleSlash size={14} color="#EF4444" />
                  ) : null}
                </View>
                {p.email ? (
                  <Text className="font-m-regular text-xs text-neutral-400">{p.email}</Text>
                ) : null}

                {/* Plan (packages) */}
                <View className="mt-1 flex-row flex-wrap gap-1">
                  {item.packages.length ? (
                    item.packages.map((pkg) => (
                      <View
                        key={pkg.id}
                        className="rounded-full bg-brand/10 px-2 py-0.5"
                      >
                        <Text className="text-[11px] font-m-semibold text-brand">
                          {locale === 'de' ? pkg.name_de : pkg.name_en}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text className="font-m-regular text-[11px] text-neutral-500">
                      {t('admin.noPlan')}
                    </Text>
                  )}
                </View>

                {/* Current theory class */}
                <View className="mt-0.5 flex-row items-center gap-1">
                  <BookOpen size={12} color="#6B7280" />
                  <Text className="font-m-regular text-[11px] text-neutral-400">
                    {item.topic
                      ? `${item.topic.number}. ${
                          locale === 'de'
                            ? item.topic.title_de
                            : item.topic.title_en
                        }`
                      : t('admin.noTopic')}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color="#6B7280" />
            </Pressable>
          )
        }}
        ListEmptyComponent={
          <Text className="font-m-regular mt-16 text-center text-neutral-400">
            {query ? t('common.empty') : t('admin.noStudents')}
          </Text>
        }
      />
    </SafeAreaView>
  )
}
