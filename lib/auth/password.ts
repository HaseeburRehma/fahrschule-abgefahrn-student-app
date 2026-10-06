/**
 * Client-side password policy — mirrors Supabase Auth (min length 8 +
 * password_required_characters: letters + digits) and the `signup-with-code`
 * edge function (400 { error: 'weak_password' }).
 */

export const PASSWORD_MIN = 8
/** bcrypt (Supabase Auth) only uses the first 72 bytes; GoTrue rejects longer passwords. */
export const PASSWORD_MAX = 72

export type PasswordIssue = 'required' | 'short' | 'weak' | 'long' | null

export function passwordIssue(pw: string): PasswordIssue {
  if (!pw) return 'required'
  if (pw.length < PASSWORD_MIN) return 'short'
  if (pw.length > PASSWORD_MAX) return 'long'
  // Supabase "letters and digits" = ASCII a–z/A–Z + 0–9 (umlauts don't count as letters there)
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'weak'
  return null
}

/** i18n key for a password issue (keys live in lib/i18n/v2/auth.ts). */
export function passwordIssueKey(issue: Exclude<PasswordIssue, null>): string {
  switch (issue) {
    case 'required':
      return 'auth.val.passwordRequired'
    case 'long':
      return 'auth.val.passwordLong'
    default:
      // short + weak share the policy sentence so the user sees every rule at once
      return 'auth.val.passwordRule'
  }
}
