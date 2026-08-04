import { useSessionGuard } from '@/lib/session-guard'

/** Mounts the session-integrity guard. Renders nothing. */
export function SessionGuardRunner() {
  useSessionGuard()
  return null
}
