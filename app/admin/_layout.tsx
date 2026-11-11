import React from 'react'
import { View } from 'react-native'
import { Redirect, Stack } from 'expo-router'

import { useUser } from '@/lib/user-context'
import { Loader } from '@/components/ui'
import { F } from '@/components/ds/tokens'
import { useSidebar } from '@/components/admin/kit'
import { AdminSidebar } from '@/components/admin/nav'

/**
 * Admin area — gated to admins. Non-admins are bounced to the tabs.
 * Desktop / tablet (≥ 1024 px): fixed sidebar + content. Phones: native stack,
 * the dashboard is the menu.
 */
export default function AdminLayout() {
  const { ready, isAdmin } = useUser()
  const sidebar = useSidebar()
  if (!ready) return <Loader />
  if (!isAdmin) return <Redirect href="/(tabs)/home" />
  const stack = (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0A0A0A' },
        headerShadowVisible: false,
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: F.xbold },
        headerBackTitleStyle: { fontFamily: F.medium },
        contentStyle: { backgroundColor: '#000000' },
      }}
    />
  )
  if (!sidebar) return stack
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <AdminSidebar />
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  )
}
