import React from 'react'
import { Stack } from 'expo-router'

import { C } from '@/components/ds'

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
}
