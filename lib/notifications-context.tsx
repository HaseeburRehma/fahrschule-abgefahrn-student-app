/**
 * NotificationsProvider — the in-app notification feed.
 *
 * Reads the current user's latest notifications and keeps them live via a
 * single Supabase realtime channel (centralized here because two independent
 * subscribers crash the channel). Exposes unreadCount + optimistic mutations.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { getSupabase } from '@/lib/supabase/client'
import { uniqueChannelName } from '@/lib/supabase/channel'
import { useUser } from '@/lib/user-context'
import type { NotificationRow } from '@/lib/types'

interface NotificationsContextValue {
  items: NotificationRow[]
  unreadCount: number
  loading: boolean
  refresh: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = useUser()
  const userId: string | null = session?.user?.id ?? null

  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const activeUser = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      if (activeUser.current === userId) setItems((data ?? []) as NotificationRow[])
    } catch {
      // keep prior items
    } finally {
      if (activeUser.current === userId) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    activeUser.current = userId
    if (!userId) {
      setItems([])
      return
    }
    refresh()

    const supabase = getSupabase()
    const channel = supabase
      .channel(uniqueChannelName(`notifications:${userId}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          setItems((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as NotificationRow
              if (prev.some((n) => n.id === row.id)) return prev
              return [row, ...prev]
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as NotificationRow
              return prev.map((n) => (n.id === row.id ? row : n))
            }
            if (payload.eventType === 'DELETE') {
              const id = (payload.old as any)?.id
              return prev.filter((n) => n.id !== id)
            }
            return prev
          })
        },
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {}
    }
  }, [userId, refresh])

  const markAsRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )
    try {
      await getSupabase()
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
    } catch {}
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!userId) return
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    try {
      await getSupabase()
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
    } catch {}
  }, [userId])

  const deleteNotification = useCallback(async (id: string) => {
    const prevItems = items
    setItems((prev) => prev.filter((n) => n.id !== id))
    try {
      await getSupabase().from('notifications').delete().eq('id', id)
    } catch {
      setItems(prevItems) // rollback
    }
  }, [items])

  const unreadCount = useMemo(
    () => items.filter((n) => !n.is_read).length,
    [items],
  )

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unreadCount,
      loading,
      refresh,
      markAsRead,
      markAllAsRead,
      deleteNotification,
    }),
    [items, unreadCount, loading, refresh, markAsRead, markAllAsRead, deleteNotification],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx)
    throw new Error('useNotifications must be used within <NotificationsProvider>')
  return ctx
}
