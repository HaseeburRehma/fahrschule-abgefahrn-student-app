/**
 * Figma "DE/Chat" (1287:1544): student ↔ school thread with a school header.
 */

import React from 'react'
import { Linking, Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft'
import { Phone } from 'phosphor-react-native/src/icons/Phone'
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel'

import { C, IconButton, Screen, T } from '@/components/ds'
import { ChatThread } from '@/components/chat-thread'
import { useT } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { SCHOOL } from '@/lib/school'

const HEADER_H = 64

function ChatHeader() {
  const t = useT()
  const back = () => (router.canGoBack() ? router.back() : router.replace('/home' as any))
  return (
    <View
      style={{
        height: HEADER_H,
        backgroundColor: C.card,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <IconButton icon={ArrowLeft} onPress={back} accessibilityLabel={t('ds.back')} />
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: C.tile,
          borderWidth: 1.5,
          borderColor: C.brand,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SteeringWheel size={24} color={C.brand} weight="fill" />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T variant="titleM" numberOfLines={1}>{t('chat.v2.title')}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.brand }} />
          <T variant="caption" color={C.muted} numberOfLines={1}>{t('chat.v2.status')}</T>
        </View>
      </View>
      <Pressable
        onPress={() => Linking.openURL(`tel:${SCHOOL.phoneTel}`).catch(() => {})}
        accessibilityRole="button"
        accessibilityLabel={t('chat.v2.call')}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 42,
          height: 42,
          borderRadius: 13,
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.line,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Phone size={20} color={C.brand} />
      </Pressable>
    </View>
  )
}

export default function StudentChat() {
  const { session } = useUser()
  const insets = useSafeAreaInsets()
  const uid: string | null = session?.user?.id ?? null

  return (
    <Screen
      scroll={false}
      padded={false}
      header={<ChatHeader />}
      gap={0}
      contentStyle={{ paddingTop: 0, paddingBottom: 0 }}
    >
      {uid ? (
        <ChatThread studentId={uid} senderId={uid} isAdmin={false} keyboardOffset={insets.top + HEADER_H} />
      ) : null}
    </Screen>
  )
}
