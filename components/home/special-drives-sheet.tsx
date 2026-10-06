/** Figma "07/Sonderfahrten" (1309:2848): bottom sheet with the three mandatory special drives. */

import React, { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { MoonStars } from 'phosphor-react-native/src/icons/MoonStars'
import { RoadHorizon } from 'phosphor-react-native/src/icons/RoadHorizon'
import { Tree } from 'phosphor-react-native/src/icons/Tree'

import { Button, C, Sheet, SheetTitle, T, useToast } from '@/components/ds'
import { useT } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { updateMyProfile } from '@/lib/data'

type DriveKey = 'drive_autobahn' | 'drive_night' | 'drive_overland'

const ROWS: { key: DriveKey; icon: PhosphorIcon; title: string; min: string }[] = [
  { key: 'drive_autobahn', icon: RoadHorizon, title: 'progress.v2.special.autobahn', min: 'progress.v2.special.autobahnMin' },
  { key: 'drive_night', icon: MoonStars, title: 'progress.v2.special.night', min: 'progress.v2.special.nightMin' },
  { key: 'drive_overland', icon: Tree, title: 'progress.v2.special.overland', min: 'progress.v2.special.overlandMin' },
]

export function SpecialDrivesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const { profile, session, refreshProfile } = useUser()
  const uid = session?.user?.id ?? profile?.id ?? null

  const fromProfile = () => ({
    drive_autobahn: !!profile?.drive_autobahn,
    drive_night: !!profile?.drive_night,
    drive_overland: !!profile?.drive_overland,
  })
  const [flags, setFlags] = useState<Record<DriveKey, boolean>>(fromProfile)
  /** rows with a write in flight — tapping them again is ignored until it settles */
  const [pending, setPending] = useState<Partial<Record<DriveKey, boolean>>>({})
  const pendingRef = useRef<Set<DriveKey>>(new Set())

  useEffect(() => {
    // Don't let a profile refresh overwrite a row whose write is still in flight.
    const p = fromProfile()
    setFlags((f) => {
      const out = { ...p }
      pendingRef.current.forEach((k) => {
        out[k] = f[k]
      })
      return out
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.drive_autobahn, profile?.drive_night, profile?.drive_overland, visible])

  /** Students self-report completed special drives (same as the previous progress screen). */
  async function toggle(key: DriveKey) {
    if (!uid || pendingRef.current.has(key)) return
    const next = !flags[key]
    pendingRef.current.add(key)
    setPending((p) => ({ ...p, [key]: true }))
    setFlags((f) => ({ ...f, [key]: next }))
    try {
      await updateMyProfile(uid, { [key]: next } as Partial<Record<DriveKey, boolean>>)
      pendingRef.current.delete(key)
      await refreshProfile()
    } catch {
      setFlags((f) => ({ ...f, [key]: !next }))
      toast.show(t('ds.error.save'), 'error')
    } finally {
      pendingRef.current.delete(key)
      setPending((p) => ({ ...p, [key]: false }))
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetTitle title={t('progress.v2.special.title')} subtitle={t('progress.v2.special.subtitle')} />
      {ROWS.map((r) => {
        const done = flags[r.key]
        const Icon = r.icon
        return (
          <Pressable
            key={r.key}
            onPress={() => toggle(r.key)}
            disabled={!!pending[r.key]}
            accessibilityRole="checkbox"
            accessibilityLabel={t(r.title)}
            accessibilityState={{ checked: done, busy: !!pending[r.key] }}
            style={({ pressed }) => ({
              backgroundColor: C.surface,
              borderRadius: 16,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: done ? C.tile : C.sheet,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={22} color={done ? C.brand : C.muted} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleM">{t(r.title)}</T>
              <T variant="caption" color={C.dim}>{t(r.min)}</T>
            </View>
            {done ? (
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={16} color={C.onBrand} weight="bold" />
              </View>
            ) : (
              <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: C.line }} />
            )}
          </Pressable>
        )
      })}
      <Button
        label={t('progress.v2.special.request')}
        onPress={() => {
          onClose()
          router.push('/booking?type=special' as any)
        }}
      />
    </Sheet>
  )
}
