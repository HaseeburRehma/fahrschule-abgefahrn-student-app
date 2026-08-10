import '../global.css'

import React from 'react'
import { View } from 'react-native'
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
import { BiometricGate } from '@/components/biometric-gate'

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
                  <BiometricGate>
                    {/* On web, center the app in a phone-width column so wide
                        desktop screens don't stretch the UI. On native the
                        web:* variants are no-ops (full width). */}
                    <View className="flex-1 w-full bg-black web:items-center">
                      <View className="flex-1 w-full web:max-w-2xl">
                        <Stack screenOptions={{ headerShown: false }} />
                      </View>
                    </View>
                  </BiometricGate>
                </AuthGuard>
              </NotificationsProvider>
            </UserProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
