/**
 * Figma "DE/Info" (1291:1659): school card, contact actions (call, WhatsApp,
 * email, route), opening hours, social links + legal links.
 */

import React from 'react'
import { Linking, Pressable, View } from 'react-native'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple'
import { FacebookLogo } from 'phosphor-react-native/src/icons/FacebookLogo'
import { FileText } from 'phosphor-react-native/src/icons/FileText'
import { Globe } from 'phosphor-react-native/src/icons/Globe'
import { InstagramLogo } from 'phosphor-react-native/src/icons/InstagramLogo'
import { MapPin } from 'phosphor-react-native/src/icons/MapPin'
import { Phone } from 'phosphor-react-native/src/icons/Phone'
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck'
import { TiktokLogo } from 'phosphor-react-native/src/icons/TiktokLogo'
import { WhatsappLogo } from 'phosphor-react-native/src/icons/WhatsappLogo'
import { YoutubeLogo } from 'phosphor-react-native/src/icons/YoutubeLogo'

import { C, ListGroup, ListRow, Logo, Screen, SectionLabel, T, TopBar } from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import { SCHOOL, mapsUrl, whatsappUrl } from '@/lib/school'

function open(url: string) {
  Linking.openURL(url).catch(() => {})
}

function ContactRow({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: PhosphorIcon
  label: string
  value: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: pressed ? '#161816' : 'transparent',
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={21} color={C.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="caption" color={C.dim}>{label}</T>
        <T variant="titleM">{value}</T>
      </View>
      <CaretRight size={20} color={C.dim} />
    </Pressable>
  )
}

function SocialButton({ icon: Icon, url, label }: { icon: PhosphorIcon; url: string; label: string }) {
  return (
    <Pressable
      onPress={() => open(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: 52,
        borderRadius: 14,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon size={24} color={C.brand} />
    </Pressable>
  )
}

export default function InfoScreen() {
  const { t, locale } = useTranslation()

  return (
    <Screen glow={-40} header={<TopBar title={t('info.v2.title')} />} gap={14}>
      {/* School */}
      <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 18, gap: 6 }}>
        <Logo width={180} />
        <T variant="bodyS" color={C.muted}>{SCHOOL.legalName}</T>
      </View>

      {/* Contact */}
      <ListGroup>
        <ContactRow icon={Phone} label={t('info.v2.call')} value={SCHOOL.phone} onPress={() => open(`tel:${SCHOOL.phoneTel}`)} />
        <ContactRow icon={WhatsappLogo} label={t('info.v2.whatsapp')} value={SCHOOL.mobile} onPress={() => open(whatsappUrl())} />
        <ContactRow icon={EnvelopeSimple} label={t('info.v2.email')} value={SCHOOL.email} onPress={() => open(`mailto:${SCHOOL.email}`)} />
        <ContactRow
          icon={MapPin}
          label={t('info.v2.route')}
          value={`${SCHOOL.street}, ${SCHOOL.city}`}
          onPress={() => open(mapsUrl())}
        />
      </ListGroup>

      {/* Hours */}
      <SectionLabel>{t('info.v2.hours')}</SectionLabel>
      <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 16, gap: 10 }}>
        {SCHOOL.hours.map((h) => (
          <View key={h.de} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T variant="bodyL" color={C.muted} style={{ flex: 1 }}>{locale === 'de' ? h.de : h.en}</T>
            <T variant="labelL" color={h.closed ? C.dim : C.white}>{h.closed ? t('info.v2.closed') : h.time}</T>
          </View>
        ))}
      </View>

      {/* Social */}
      <SectionLabel>{t('info.v2.follow')}</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SocialButton icon={InstagramLogo} url={SCHOOL.social.instagram} label="Instagram" />
        <SocialButton icon={FacebookLogo} url={SCHOOL.social.facebook} label="Facebook" />
        <SocialButton icon={TiktokLogo} url={SCHOOL.social.tiktok} label="TikTok" />
        <SocialButton icon={YoutubeLogo} url={SCHOOL.social.youtube} label="YouTube" />
      </View>

      {/* Legal (required links; not in the Figma frame) */}
      <SectionLabel>{t('info.v2.legal')}</SectionLabel>
      <ListGroup>
        <ListRow icon={FileText} title={t('info.v2.impressum')} onPress={() => open(SCHOOL.impressumUrl)} />
        <ListRow icon={ShieldCheck} title={t('info.v2.privacy')} onPress={() => open(SCHOOL.datenschutzUrl)} />
        <ListRow icon={Globe} title={t('info.v2.website')} onPress={() => open(SCHOOL.websiteUrl)} />
      </ListGroup>
    </Screen>
  )
}
