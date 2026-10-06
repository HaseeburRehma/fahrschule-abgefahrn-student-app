import React from 'react'
import { Redirect, Stack } from 'expo-router'

import { useUser } from '@/lib/user-context'
import { Loader } from '@/components/ui'
import { F } from '@/components/ds/tokens'

/** Admin area — gated to admins. Non-admins are bounced to the tabs. */
export default function AdminLayout() {
  const { ready, isAdmin } = useUser()
  if (!ready) return <Loader />
  if (!isAdmin) return <Redirect href="/(tabs)/home" />
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0A0A0A' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: F.xbold },
        headerBackTitleStyle: { fontFamily: F.medium },
      }}
    />
  )
}
