import '../global.css'

import React from 'react'
import { View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular'
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium'
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold'
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold'
import { Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat/800ExtraBold'
import { Montserrat_900Black } from '@expo-google-fonts/montserrat/900Black'
import { Montserrat_900Black_Italic } from '@expo-google-fonts/montserrat/900Black_Italic'

import { ThemeProvider } from '@/lib/theme'
import { I18nProvider } from '@/lib/i18n'
import { UserProvider } from '@/lib/user-context'
import { NotificationsProvider } from '@/lib/notifications-context'
import { AuthGuard } from '@/components/auth-guard'
import { SessionGuardRunner } from '@/components/session-guard-runner'
import { PushRegistrar } from '@/components/push-registrar'
import { BiometricGate } from '@/components/biometric-gate'
import { C, ToastProvider } from '@/components/ds'

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Montserrat_900Black,
    Montserrat_900Black_Italic,
  })

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <StatusBar style="light" />
            {!fontsLoaded && !fontError ? (
              <View style={{ flex: 1, backgroundColor: C.bg }} />
            ) : (
              <UserProvider>
                <NotificationsProvider>
                  {/* On web, center the app in a phone-width column so wide
                      desktop screens don't stretch the UI. */}
                  <View style={{ flex: 1, width: '100%', backgroundColor: C.bg, alignItems: 'center' }}>
                    <View style={{ flex: 1, width: '100%', maxWidth: 672 }}>
                      <ToastProvider>
                        <AuthGuard>
                          <SessionGuardRunner />
                          <PushRegistrar />
                          <BiometricGate>
                            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
                              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                              <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                            </Stack>
                          </BiometricGate>
                        </AuthGuard>
                      </ToastProvider>
                    </View>
                  </View>
                </NotificationsProvider>
              </UserProvider>
            )}
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
