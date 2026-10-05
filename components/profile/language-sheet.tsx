/**
 * Figma "07/Sprache" (1309:2754 · EN 1315:3736): language picker sheet.
 */

import React, { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { Globe } from 'phosphor-react-native/src/icons/Globe'

import { Button, C, GLOW, Sheet, T } from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import type { Locale } from '@/lib/types'

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderRadius: 16,
          backgroundColor: selected ? C.tile : C.surface,
          borderWidth: selected ? 1.5 : 1,
          borderColor: selected ? C.brand : C.line,
        },
        selected ? { ...GLOW.card, shadowOpacity: 0.22, shadowRadius: 12 } : null,
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <Globe size={22} color={selected ? C.brand : C.muted} />
      <T variant="titleM" style={{ flex: 1 }}>{label}</T>
      {selected ? (
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={15} color={C.onBrand} weight="bold" />
        </View>
      ) : (
        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: C.lineStrong }} />
      )}
    </Pressable>
  )
}

export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, locale, setLocale } = useTranslation()
  const [choice, setChoice] = useState<Locale>(locale)

  // Re-sync the pending choice each time the sheet opens.
  useEffect(() => {
    if (visible) setChoice(locale)
  }, [visible, locale])

  function done() {
    if (choice !== locale) setLocale(choice)
    onClose()
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <T variant="headingL">{t('profile.v2.lang.title')}</T>
      <Option label={t('profile.v2.lang.de')} selected={choice === 'de'} onPress={() => setChoice('de')} />
      <Option label={t('profile.v2.lang.en')} selected={choice === 'en'} onPress={() => setChoice('en')} />
      <Button label={t('ds.done')} onPress={done} />
    </Sheet>
  )
}
