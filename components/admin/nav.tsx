/**
 * Admin navigation — one list used by the desktop sidebar and the phone
 * dashboard, grouped the way a driving school thinks about its work.
 */

import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { SquaresFour } from 'phosphor-react-native/src/icons/SquaresFour'
import { Users } from 'phosphor-react-native/src/icons/Users'
import { Tray } from 'phosphor-react-native/src/icons/Tray'
import { PaperPlaneTilt } from 'phosphor-react-native/src/icons/PaperPlaneTilt'
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle'
import { CalendarPlus } from 'phosphor-react-native/src/icons/CalendarPlus'
import { CalendarCheck } from 'phosphor-react-native/src/icons/CalendarCheck'
import { Clock } from 'phosphor-react-native/src/icons/Clock'
import { ClockCounterClockwise } from 'phosphor-react-native/src/icons/ClockCounterClockwise'
import { FileText } from 'phosphor-react-native/src/icons/FileText'
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle'
import { Key } from 'phosphor-react-native/src/icons/Key'
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck'
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple'
import { ChartLineUp } from 'phosphor-react-native/src/icons/ChartLineUp'
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft'

import { useTranslation } from '@/lib/i18n'
import { useFeatureFlags } from '@/lib/flags'
import { useUser } from '@/lib/user-context'
import { Logo } from '@/components/ds'
import { GREEN } from '@/components/admin/kit'

type IconC = React.ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' }>

export interface NavItem {
  href: string
  label: string
  Icon: IconC
}
export interface NavGroup {
  title: string
  items: NavItem[]
}

export function useAdminNav(): NavGroup[] {
  const { t } = useTranslation()
  const { flags } = useFeatureFlags()
  const pick = (items: (NavItem | false)[]) => items.filter(Boolean) as NavItem[]
  return [
    {
      title: t('admin.nav.students'),
      items: pick([
        { href: '/admin/students', label: t('admin.students'), Icon: Users },
        { href: '/admin/invites', label: t('inv.title'), Icon: EnvelopeSimple },
        flags.performance_dashboard && { href: '/admin/performance', label: t('perf.title'), Icon: ChartLineUp },
        { href: '/admin/intake', label: t('admin.intake'), Icon: Tray },
      ]),
    },
    {
      title: t('admin.nav.teaching'),
      items: [
        { href: '/admin/classes', label: t('admin.classes'), Icon: CalendarPlus },
        { href: '/admin/appointments', label: t('admin.appointments'), Icon: CalendarCheck },
        { href: '/admin/availability', label: t('admin.availability'), Icon: Clock },
        { href: '/admin/documents', label: t('admin.documents'), Icon: FileText },
      ],
    },
    {
      title: t('admin.nav.messages'),
      items: [
        { href: '/admin/chat', label: t('admin.chat'), Icon: ChatCircle },
        { href: '/admin/notify', label: t('admin.notify'), Icon: PaperPlaneTilt },
        { href: '/admin/history', label: t('admin.history'), Icon: ClockCounterClockwise },
        { href: '/admin/motivation', label: t('admin.motivation'), Icon: Sparkle },
      ],
    },
    {
      title: t('admin.nav.settings'),
      items: [
        { href: '/admin/settings', label: t('admin.v2.signupCode'), Icon: Key },
        { href: '/admin/admins', label: t('admin.v2.admins.title'), Icon: ShieldCheck },
      ],
    },
  ]
}

/** Is `href` the current section? '/admin' only matches exactly, the rest match their sub-pages too. */
export function isActive(pathname: string | null | undefined, href: string): boolean {
  const p = (pathname ?? '').replace(/\/+$/, '') || '/'
  if (href === '/admin') return p === '/admin'
  return p === href || p.startsWith(`${href}/`)
}

export const SIDEBAR_WIDTH = 252

/** Desktop / tablet sidebar (≥ 1024 px). Phones use the dashboard as their menu. */
export function AdminSidebar() {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const groups = useAdminNav()
  const { profile } = useUser()
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || ''

  const Item = ({ href, label, Icon }: NavItem) => {
    const active = isActive(pathname, href)
    return (
      <Pressable
        onPress={() => router.navigate(href as any)}
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        className={`flex-row items-center gap-3 rounded-xl px-3 py-2.5 ${active ? 'bg-brand/10' : 'hover:bg-neutral-900 active:bg-neutral-900'}`}
      >
        <Icon size={18} color={active ? GREEN : '#A3A3A3'} weight={active ? 'bold' : 'regular'} />
        <Text className={`font-m-semibold flex-1 text-[13px] ${active ? 'text-brand' : 'text-neutral-300'}`} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    )
  }

  return (
    <View style={{ width: SIDEBAR_WIDTH }} className="border-r border-neutral-900 bg-[#070707]">
      <View className="gap-1 px-5 pb-4 pt-6">
        <Logo width={150} />
        <Text className="font-m-bold mt-2 text-[11px] uppercase tracking-widest text-neutral-500">{t('admin.title')}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16, gap: 18 }}>
        <Item href="/admin" label={t('admin.nav.overview')} Icon={SquaresFour} />
        {groups.map((g) => (
          <View key={g.title} className="gap-0.5">
            <Text className="font-m-bold mb-1 px-3 text-[10px] uppercase tracking-widest text-neutral-600">{g.title}</Text>
            {g.items.map((i) => (
              <Item key={i.href} {...i} />
            ))}
          </View>
        ))}
      </ScrollView>
      <View className="gap-2 border-t border-neutral-900 p-3">
        {name ? (
          <View className="flex-row items-center gap-3 px-2 py-1">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-brand/15">
              <Text className="font-m-black text-xs text-brand">{name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text className="font-m-semibold flex-1 text-xs text-neutral-300" numberOfLines={1}>
              {name}
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={() => router.replace('/(tabs)/profile' as any)}
          accessibilityRole="link"
          className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-neutral-900 active:bg-neutral-900"
        >
          <ArrowLeft size={18} color="#A3A3A3" />
          <Text className="font-m-semibold text-[13px] text-neutral-400">{t('admin.nav.backToApp')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
