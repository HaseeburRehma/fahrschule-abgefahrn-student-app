/**
 * "Keine offizielle Behörden-App" notice with links to the official sources.
 * Google Play's Misleading Claims policy requires both for apps that present
 * government information (licence rules, the official question catalogue).
 *
 *  - full    → notice + every source as a tappable row (Theorie tab, Info screen)
 *  - compact → one line + "Quellen ansehen" (topic detail), opens the Info screen
 */

import React from 'react'
import { Linking, View } from 'react-native'
import { router } from 'expo-router'
import { ArrowSquareOut } from 'phosphor-react-native/src/icons/ArrowSquareOut'
import { Info } from 'phosphor-react-native/src/icons/Info'

import { Pressable } from '@/components/ds/pressable'
import { C, T } from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import { SCHOOL } from '@/lib/school'

function open(url: string) {
  Linking.openURL(url).catch(() => {})
}

export function OfficialSourcesNote({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()

  if (compact) {
    return (
      <Pressable
        onPress={() => router.push('/info' as any)}
        accessibilityRole="link"
        accessibilityLabel={`${t('sources.short')} ${t('sources.more')}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}
      >
        <Info size={16} color={C.dim} />
        <T variant="caption" color={C.dim} style={{ flex: 1 }}>
          {t('sources.short')} <T variant="caption" color={C.brand}>{t('sources.more')}</T>
        </T>
      </Pressable>
    )
  }

  return (
    <View
      testID="official-sources"
      style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 10 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Info size={18} color={C.brand} weight="fill" />
        <T variant="titleM">{t('sources.title')}</T>
      </View>
      <T variant="bodyS" color={C.muted}>{t('sources.body', { school: SCHOOL.legalName })}</T>
      <View style={{ gap: 2 }}>
        {SCHOOL.officialSources.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => open(s.url)}
            accessibilityRole="link"
            accessibilityLabel={t(s.key)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, opacity: pressed ? 0.6 : 1 })}
          >
            <ArrowSquareOut size={16} color={C.brand} />
            <T variant="bodyS" color={C.brand} style={{ flex: 1 }}>{t(s.key)}</T>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
