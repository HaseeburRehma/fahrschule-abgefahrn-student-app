/**
 * Figma "Prüfungstermin" (1309:2969 / EN "Add exam" 1315:4071):
 * bottom sheet to enter the theory or practical exam date.
 *
 * Cross-platform date entry without native deps: a dd.mm.yyyy masked field
 * (auto-inserted dots, number pad) with calendar-validity checks.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Keyboard, Platform, TextInput, View } from 'react-native'
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots'
import { Info } from 'phosphor-react-native/src/icons/Info'
import { WarningCircle } from 'phosphor-react-native/src/icons/WarningCircle'

import { Button, C, F, Sheet, SheetTitle, T, useToast } from '@/components/ds'
import { useT } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { updateMyProfile } from '@/lib/data'
import { deDateToIso, isoToDeDate, maskDeDate } from './dates'

export type ExamKind = 'theory' | 'practical'

export function ExamDateSheet({
  visible,
  kind,
  onClose,
  onSaved,
}: {
  visible: boolean
  kind: ExamKind
  onClose: () => void
  /** called after the profile was updated + refreshed */
  onSaved?: () => void
}) {
  const t = useT()
  const toast = useToast()
  const { profile, session, refreshProfile } = useUser()
  const uid: string | null = session?.user?.id ?? null
  const current = kind === 'theory' ? profile?.theory_exam_date : profile?.practical_exam_date

  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    if (visible) {
      setValue(isoToDeDate(current))
      setError(null)
    }
  }, [visible, current])

  async function persist(iso: string | null) {
    if (!uid || savingRef.current) return
    const patch =
      kind === 'theory'
        ? { theory_exam_date: iso, theory_passed: null }
        : { practical_exam_date: iso, practical_passed: null }
    savingRef.current = true
    setSaving(true)
    try {
      await updateMyProfile(uid, patch)
      await refreshProfile()
      toast.show(iso ? t('exams.v2.sheet.saved') : t('exams.v2.sheet.removed'), 'success')
      onSaved?.()
      onClose()
    } catch {
      toast.show(t('common.error'), 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  function save() {
    if (savingRef.current) return
    // Figma has no separate "remove" control: saving an empty field clears the date.
    if (!value.trim()) {
      if (current) persist(null)
      else onClose()
      return
    }
    const iso = deDateToIso(value)
    if (!iso) {
      setError(t('exams.v2.sheet.invalid'))
      return
    }
    if (iso === current) {
      onClose()
      return
    }
    persist(iso)
  }

  const borderColor = error ? C.danger : focused ? C.brand : C.line

  return (
    <Sheet visible={visible} onClose={() => !savingRef.current && onClose()} dismissable={!saving}>
      <SheetTitle title={kind === 'theory' ? t('exams.v2.sheet.theory') : t('exams.v2.sheet.practical')} />

      <T variant="labelL" color={C.muted}>{t('exams.v2.sheet.date')}</T>

      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor,
            borderRadius: 16,
            paddingHorizontal: 16,
          }}
        >
          <CalendarDots size={20} color={C.brand} />
          <TextInput
            value={value}
            onChangeText={(s) => {
              setValue(maskDeDate(s))
              if (error) setError(null)
            }}
            placeholder={t('exams.v2.sheet.placeholder')}
            placeholderTextColor={C.dim}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={10}
            returnKeyType="done"
            onSubmitEditing={save}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor={C.brand}
            cursorColor={C.brand}
            accessibilityLabel={t('exams.v2.sheet.date')}
            style={
              {
                flex: 1,
                color: C.white,
                fontFamily: F.medium,
                fontSize: 16,
                lineHeight: 24,
                paddingVertical: 16,
                outlineWidth: 0,
              } as any
            }
          />
        </View>
        {error ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <WarningCircle size={16} color={C.danger} />
            <T variant="caption" color={C.danger} style={{ flex: 1 }}>{error}</T>
          </View>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: C.surface,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <Info size={18} color={C.muted} />
        <T variant="bodyS" color={C.muted} style={{ flex: 1 }}>{t('exams.v2.sheet.info')}</T>
      </View>

      <Button label={t('exams.v2.sheet.save')} onPress={save} loading={saving} />
    </Sheet>
  )
}

