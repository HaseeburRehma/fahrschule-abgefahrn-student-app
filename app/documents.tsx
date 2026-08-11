import React, { useCallback, useState } from 'react'
import { FlatList, Linking, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import { FileText, Download } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { fetchDocuments, getDocumentUrl, type DocRow } from '@/lib/documents'
import { formatDate } from '@/lib/format'
import { Loader } from '@/components/ui'

export default function DocumentsScreen() {
  const { t, locale } = useTranslation()
  const [rows, setRows] = useState<DocRow[] | null>(null)

  useFocusEffect(
    useCallback(() => {
      let alive = true
      fetchDocuments()
        .then((r) => alive && setRows(r))
        .catch(() => alive && setRows([]))
      return () => {
        alive = false
      }
    }, []),
  )

  async function open(doc: DocRow) {
    try {
      const url = await getDocumentUrl(doc.path)
      Linking.openURL(url).catch(() => {})
    } catch {}
  }

  if (rows === null) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('documents.title'),
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800' },
        }}
      />
      <FlatList
        data={rows}
        keyExtractor={(d) => d.id}
        contentContainerClassName="p-5 gap-2"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            className="flex-row items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <FileText size={20} color="#00FF24" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-neutral-100">{item.title}</Text>
              <Text className="text-xs text-neutral-400">
                {formatDate(item.created_at, locale)}
              </Text>
            </View>
            <Download size={18} color="#6B7280" />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="mt-16 text-center text-neutral-400">
            {t('documents.empty')}
          </Text>
        }
      />
    </SafeAreaView>
  )
}
