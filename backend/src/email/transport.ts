import { env } from '../config/env.ts'

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
}

export interface EmailTransport {
  send(email: OutgoingEmail): Promise<void>
}

/** Emails "sent" while NODE_ENV=test. Tests read and clear it; nothing leaves the process. */
export const testOutbox: OutgoingEmail[] = []

const memoryTransport: EmailTransport = {
  send: async email => {
    testOutbox.push(email)
  },
}

const consoleTransport: EmailTransport = {
  send: async email => {
    console.info(`[email] To: ${email.to}\n[email] Subject: ${email.subject}\n${email.text}\n`)
  },
}

/** Resend's HTTP API. The SDK is loaded only when this transport is used. */
async function resendTransport(apiKey: string): Promise<EmailTransport> {
  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)
  return {
    send: async email => {
      const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        replyTo: env.EMAIL_REPLY_TO,
        ...email,
      })
      if (error) throw new Error(`Resend rejected the email: ${error.name}`)
    },
  }
}

/** Plain SMTP, used with Mailpit during local development. */
async function smtpTransport(url: string): Promise<EmailTransport> {
  const { createTransport } = await import('nodemailer')
  const transporter = createTransport(url)
  return {
    send: async email => {
      await transporter.sendMail({ from: env.EMAIL_FROM, replyTo: env.EMAIL_REPLY_TO, ...email })
    },
  }
}

let selected: Promise<EmailTransport> | undefined

/** The transport chosen by EMAIL_TRANSPORT (validated in config/env.ts), created once. */
export function emailTransport(): Promise<EmailTransport> {
  selected ??= (() => {
    switch (env.emailTransport) {
      case 'memory':
        return Promise.resolve(memoryTransport)
      case 'console':
        return Promise.resolve(consoleTransport)
      case 'smtp':
        return smtpTransport(env.SMTP_URL ?? '')
      case 'resend':
        return resendTransport(env.RESEND_API_KEY ?? '')
      default:
        throw new Error(`Unknown email transport: ${String(env.emailTransport)}`)
    }
  })()
  return selected
}
