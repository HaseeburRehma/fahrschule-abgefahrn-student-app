import React from 'react'
import { Stack } from 'expo-router'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { ChatThread } from '@/components/chat-thread'
import { Loader } from '@/components/ui'

export default function StudentChat() {
  const { t } = useTranslation()
  const { session } = useUser()
  const uid: string | null = session?.user?.id ?? null

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('chat.withSchool'),
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800' },
        }}
      />
      {uid ? (
        <ChatThread studentId={uid} senderId={uid} isAdmin={false} />
      ) : (
        <Loader />
      )}
    </>
  )
}
