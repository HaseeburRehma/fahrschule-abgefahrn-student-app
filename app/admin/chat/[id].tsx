import React, { useEffect, useState } from 'react'
import { Stack, useLocalSearchParams } from 'expo-router'

import { useUser } from '@/lib/user-context'
import { fetchProfile } from '@/lib/admin'
import { displayName } from '@/lib/data'
import { ChatThread } from '@/components/chat-thread'
import { Loader } from '@/components/ui'
import { F } from '@/components/ds/tokens'

export default function AdminChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useUser()
  const adminId: string | null = session?.user?.id ?? null
  const [title, setTitle] = useState('…')

  useEffect(() => {
    if (id)
      fetchProfile(id)
        .then((p) => setTitle(displayName(p) || p?.email || '…'))
        .catch(() => {})
  }, [id])

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: F.xbold },
          headerBackTitleStyle: { fontFamily: F.medium },
        }}
      />
      {id && adminId ? (
        <ChatThread studentId={id} senderId={adminId} isAdmin />
      ) : (
        <Loader />
      )}
    </>
  )
}
