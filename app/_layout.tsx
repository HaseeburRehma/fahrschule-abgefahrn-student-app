import '../global.css'

import React from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/lib/theme'
import { I18nProvider } from '@/lib/i18n'
import { UserProvider } from '@/lib/user-context'
import { NotificationsProvider } from '@/lib/notifications-context'
import { AuthGuard } from '@/components/auth-guard'
import { SessionGuardRunner } from '@/components/session-guard-runner'
import { PushRegistrar } from '@/components/push-registrar'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <UserProvider>
              <NotificationsProvider>
                <StatusBar style="light" />
                <AuthGuard>
                  <SessionGuardRunner />
                  <PushRegistrar />
                  <Stack screenOptions={{ headerShown: false }} />
                </AuthGuard>
              </NotificationsProvider>
            </UserProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
