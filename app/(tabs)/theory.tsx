import React, { useCallback, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Check } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchTheoryTopics, fetchMyDoneTopics, setTopicDone } from '@/lib/data'
import { Loader } from '@/components/ui'
import type { TheoryTopic } from '@/lib/types'

export default function Theory() {
  const { t, locale } = useTranslation()
  const { profile, session } = useUser()
  const uid: string | null = session?.user?.id ?? null
  const [topics, setTopics] = useState<TheoryTopic[] | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())

  useFocusEffect(
    useCallback(() => {
      let alive = true
      fetchTheoryTopics()
        .then((rows) => alive && setTopics(rows))
        .catch(() => alive && setTopics([]))
      if (uid) {
        fetchMyDoneTopics(uid)
          .then((s) => alive && setDone(s))
          .catch(() => {})
      }
      return () => {
        alive = false
      }
    }, [uid]),
  )

  async function toggleDone(topicId: string) {
    if (!uid) return
    const isDone = done.has(topicId)
    // optimistic
    setDone((prev) => {
      const next = new Set(prev)
      isDone ? next.delete(topicId) : next.add(topicId)
      return next
    })
    try {
      await setTopicDone(uid, topicId, !isDone)
    } catch {
      setDone((prev) => {
        const next = new Set(prev)
        isDone ? next.add(topicId) : next.delete(topicId)
        return next
      })
    }
  }

  const currentId = profile?.current_theory_topic_id ?? null

  if (topics === null) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="px-5 pb-2 pt-3">
        <Text className="text-2xl font-extrabold text-neutral-100">
          {t('theory.title')}
        </Text>
        <Text className="mt-1 text-sm text-neutral-400">
          {t('theory.progress', { done: done.size, total: topics.length })}
        </Text>
      </View>

      <FlatList
        data={topics}
        keyExtractor={(x) => x.id}
        contentContainerClassName="px-5 pb-6 pt-1 gap-2"
        renderItem={({ item }) => {
          const isCurrent = item.id === currentId
          const isDone = done.has(item.id)
          return (
            <View
              className={`flex-row items-center gap-3 rounded-2xl border p-4 ${
                isCurrent
                  ? 'border-brand bg-brand/10'
                  : 'border-neutral-800 bg-neutral-900'
              }`}
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  isCurrent ? 'bg-brand' : 'bg-neutral-800'
                }`}
              >
                <Text
                  className={`text-sm font-black ${
                    isCurrent ? 'text-ink' : 'text-neutral-400'
                  }`}
                >
                  {item.number}
                </Text>
              </View>
              <Text
                className={`flex-1 font-semibold ${
                  isDone ? 'text-neutral-500 line-through' : 'text-neutral-100'
                }`}
              >
                {locale === 'de' ? item.title_de : item.title_en}
              </Text>
              {isCurrent ? (
                <View className="rounded-full bg-brand px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-ink">
                    {t('theory.current')}
                  </Text>
                </View>
              ) : null}
              {/* Done checkbox */}
              <Pressable
                onPress={() => toggleDone(item.id)}
                hitSlop={8}
                className={`h-7 w-7 items-center justify-center rounded-full border ${
                  isDone ? 'border-brand bg-brand' : 'border-neutral-600'
                }`}
              >
                {isDone ? <Check size={16} color="#0A0A0A" /> : null}
              </Pressable>
            </View>
          )
        }}
      />
    </SafeAreaView>
  )
}
