import { changeEmailConfirmation, type RenderedEmail, resetPasswordEmail, verifyEmail } from '@clozera/emails'
import { env } from '../config/env.ts'
import { emailTransport } from './transport.ts'

interface Recipient {
  email: string
  name: string
  emailVerified?: boolean
}

export interface MailerOptions {
  /**
   * Deliver after the HTTP response instead of awaiting it. Keeps auth endpoints fast and stops
   * response timing from revealing whether an email address has an account. Scripts await delivery.
   */
  background: boolean
}

async function deliver(to: string, rendering: Promise<RenderedEmail>): Promise<void> {
  const email = await rendering
  const transport = await emailTransport()
  await transport.send({ to, ...email })
}

export function createMailer({ background }: MailerOptions) {
  const dispatch = (to: string, rendering: () => Promise<RenderedEmail>): Promise<void> => {
    const delivery = deliver(to, rendering())
    if (!background) return delivery
    // Never log addresses or links: they identify people and carry sign-in tokens.
    delivery.catch((error: unknown) => console.error('Email delivery failed:', (error as Error).message))
    return Promise.resolve()
  }
  const appUrl = env.FRONTEND_URL

  return {
    /** New accounts are unverified, so a verified recipient is confirming a changed address. */
    verification: (user: Recipient, url: string) =>
      dispatch(user.email, () =>
        verifyEmail({ appUrl, name: user.name, url, reason: user.emailVerified ? 'change' : 'signup' })
      ),
    passwordReset: (user: Recipient, url: string) =>
      dispatch(user.email, () => resetPasswordEmail({ appUrl, name: user.name, url })),
    emailChangeConfirmation: (user: Recipient, newEmail: string, url: string) =>
      dispatch(user.email, () => changeEmailConfirmation({ appUrl, name: user.name, newEmail, url })),
  }
}

export type Mailer = ReturnType<typeof createMailer>
