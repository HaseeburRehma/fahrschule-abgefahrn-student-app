import React from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack } from 'expo-router'
import {
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Clock,
  FileText,
  Globe,
  ChevronRight,
} from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { SCHOOL, mapsUrl, whatsappUrl } from '@/lib/school'
import { Card } from '@/components/ui'

function open(url: string) {
  Linking.openURL(url).catch(() => {})
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl bg-neutral-800 px-3 py-3 active:opacity-70"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-brand/10">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-neutral-100">{label}</Text>
        {value ? (
          <Text className="text-xs text-neutral-400">{value}</Text>
        ) : null}
      </View>
      <ChevronRight size={18} color="#6B7280" />
    </Pressable>
  )
}

export default function InfoScreen() {
  const { t, locale } = useTranslation()

  const faqs = [
    locale === 'de'
      ? { q: 'Wie melde ich mich an?', a: 'Über die Online-Anmeldung auf der Website oder direkt in der Fahrschule.' }
      : { q: 'How do I register?', a: 'Via the online registration on the website or directly at the driving school.' },
    locale === 'de'
      ? { q: 'Wo sehe ich meine Theorietermine?', a: 'Im Tab „Termine“. Neue Termine erscheinen automatisch, sobald sie zugewiesen sind.' }
      : { q: 'Where do I see my theory dates?', a: 'In the "Schedule" tab. New dates appear automatically once assigned.' },
    locale === 'de'
      ? { q: 'Wie erreiche ich die Fahrschule?', a: 'Per Telefon, WhatsApp oder E-Mail – siehe Kontakt oben.' }
      : { q: 'How do I reach the driving school?', a: 'By phone, WhatsApp or email — see Contact above.' },
  ]

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('info.title'),
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800' },
        }}
      />
      <ScrollView contentContainerClassName="p-5 gap-4">
        {/* Contact */}
        <Card className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            {t('info.contact')}
          </Text>
          <Text className="mb-1 text-base font-bold text-neutral-100">
            {SCHOOL.legalName}
          </Text>
          <Row
            icon={<Phone size={18} color="#00FF24" />}
            label={t('info.call')}
            value={SCHOOL.phone}
            onPress={() => open(`tel:${SCHOOL.phoneTel}`)}
          />
          <Row
            icon={<MessageCircle size={18} color="#00FF24" />}
            label={t('info.whatsapp')}
            value={SCHOOL.mobile}
            onPress={() => open(whatsappUrl())}
          />
          <Row
            icon={<Mail size={18} color="#00FF24" />}
            label={t('info.email')}
            value={SCHOOL.email}
            onPress={() => open(`mailto:${SCHOOL.email}`)}
          />
          <Row
            icon={<MapPin size={18} color="#00FF24" />}
            label={t('info.directions')}
            value={`${SCHOOL.street}, ${SCHOOL.city}`}
            onPress={() => open(mapsUrl())}
          />
        </Card>

        {/* Hours */}
        <Card className="gap-2">
          <View className="flex-row items-center gap-2">
            <Clock size={18} color="#00FF24" />
            <Text className="font-semibold text-neutral-100">
              {t('info.hours')}
            </Text>
          </View>
          {SCHOOL.hours.map((h) => (
            <View key={h.time + h.de} className="flex-row justify-between">
              <Text className="text-sm text-neutral-300">
                {locale === 'de' ? h.de : h.en}
              </Text>
              <Text className="text-sm font-medium text-neutral-100">
                {h.time}
              </Text>
            </View>
          ))}
        </Card>

        {/* FAQ */}
        <Card className="gap-3">
          <Text className="font-semibold text-neutral-100">{t('info.faq')}</Text>
          {faqs.map((f) => (
            <View key={f.q} className="gap-0.5">
              <Text className="text-sm font-bold text-neutral-200">{f.q}</Text>
              <Text className="text-sm text-neutral-400">{f.a}</Text>
            </View>
          ))}
        </Card>

        {/* Legal */}
        <Card className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            {t('info.legal')}
          </Text>
          <Row
            icon={<FileText size={18} color="#00FF24" />}
            label={t('info.impressum')}
            onPress={() => open(SCHOOL.impressumUrl)}
          />
          <Row
            icon={<FileText size={18} color="#00FF24" />}
            label={t('info.datenschutz')}
            onPress={() => open(SCHOOL.datenschutzUrl)}
          />
          <Row
            icon={<Globe size={18} color="#00FF24" />}
            label={t('info.website')}
            onPress={() => open(SCHOOL.websiteUrl)}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}
