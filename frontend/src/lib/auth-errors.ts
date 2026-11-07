/** Learner-facing messages for Better Auth error codes. */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password.',
  INVALID_PASSWORD: 'Your current password is incorrect.',
  USER_ALREADY_EXISTS: 'An account with this email already exists.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with this email already exists.',
  USERNAME_IS_ALREADY_TAKEN: 'This username is already taken.',
  USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER: 'This username is already taken.',
  INVALID_TOKEN: 'This link is invalid or has expired.',
  EMAIL_IS_THE_SAME: 'This is already your email address.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
}

export function authErrorMessage(
  error: { code?: string; message?: string; status?: number } | null | undefined,
  fallback: string
): string {
  if (!error) return fallback
  if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.'
  return (error.code && MESSAGES[error.code]) || error.message || fallback
}
