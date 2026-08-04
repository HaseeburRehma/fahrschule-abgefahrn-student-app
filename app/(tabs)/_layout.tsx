import React from 'react'
import { View, Text } from 'react-native'
import { Tabs } from 'expo-router'
import { Home, Bell, BookOpen, CalendarDays, Settings } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useNotifications } from '@/lib/notifications-context'

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <View className="absolute -right-2 -top-1 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1">
      <Text className="text-[10px] font-bold text-white">
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  )
}

export default function TabsLayout() {
  const { t } = useTranslation()
  const { unreadCount } = useNotifications()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#15803D',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          borderTopColor: '#E5E7EB',
          backgroundColor: '#FFFFFF',
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tabs.notifications'),
          tabBarIcon: ({ color, size }) => (
            <View>
              <Bell color={color} size={size} />
              <TabBadge count={unreadCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="theory"
        options={{
          title: t('tabs.theory'),
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('tabs.schedule'),
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
