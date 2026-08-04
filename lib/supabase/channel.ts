/**
 * Unique Supabase Realtime channel names.
 *
 * `supabase.channel(name)` keeps a registry keyed by name. If an effect that
 * creates a channel re-runs (StrictMode in dev, or any re-mount), the second
 * call returns the SAME already-SUBSCRIBED instance and `.on()` throws
 * "cannot add postgres_changes callbacks ... after subscribe()". Appending a
 * monotonic counter + timestamp makes each mount a distinct topic.
 */

let counter = 0

export function uniqueChannelName(base: string): string {
  counter += 1
  return `${base}::${Date.now()}-${counter}`
}
