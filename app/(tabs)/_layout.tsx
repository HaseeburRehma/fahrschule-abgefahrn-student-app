import React from 'react'
import { Tabs } from 'expo-router'

import { C, TabBar } from '@/components/ds'

/** Figma BottomNav: Start · Theorie · Termine · Fortschritt · Profil. */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="theory" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
