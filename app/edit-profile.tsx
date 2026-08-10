import React, { useState } from 'react'
import { Alert, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { updateMyProfile } from '@/lib/data'
import { Button, Card, ErrorText, TextField } from '@/components/ui'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}

export default function EditProfile() {
  const { t } = useTranslation()
  const router = useRouter()
  const { session, profile, refreshProfile } = useUser()

  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const uid = session?.user?.id
    if (!uid) return
    setError(null)
    setBusy(true)
    try {
      await updateMyProfile(uid, {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
      })
      await refreshProfile()
      notify(t('profile.saved'))
      router.back()
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('settings.editProfile'),
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800' },
        }}
      />
      <ScrollView contentContainerClassName="p-5 gap-4">
        <Card className="gap-3">
          {profile?.email ? (
            <Text className="text-sm text-neutral-400">{profile.email}</Text>
          ) : null}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label={t('admin.firstName')}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View className="flex-1">
              <TextField
                label={t('admin.lastName')}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>
          <TextField
            label={t('admin.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </Card>
        <ErrorText>{error}</ErrorText>
        <Button label={t('common.save')} onPress={save} loading={busy} />
      </ScrollView>
    </SafeAreaView>
  )
}
