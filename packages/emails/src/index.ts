import { render, toPlainText } from '@react-email/render'
import type { ReactElement } from 'react'
import ChangeEmail, { type ChangeEmailProps } from './templates/change-email.tsx'
import ResetPassword, { type ResetPasswordProps } from './templates/reset-password.tsx'
import VerifyEmail, { type VerifyEmailProps } from './templates/verify-email.tsx'

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

async function renderEmail(subject: string, element: ReactElement): Promise<RenderedEmail> {
  const html = await render(element)
  return { subject, html, text: toPlainText(html) }
}

export const verifyEmail = (props: VerifyEmailProps) =>
  renderEmail(
    props.reason === 'change' ? 'Confirm your new email address' : 'Confirm your email for Clozera',
    VerifyEmail(props)
  )

export const resetPasswordEmail = (props: ResetPasswordProps) =>
  renderEmail('Reset your Clozera password', ResetPassword(props))

export const changeEmailConfirmation = (props: ChangeEmailProps) =>
  renderEmail('Approve the email change on your Clozera account', ChangeEmail(props))

export type { ChangeEmailProps, ResetPasswordProps, VerifyEmailProps }
