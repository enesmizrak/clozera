import { Text } from 'react-email'
import { ActionLink, Layout, mutedText, text } from '../components/layout.tsx'

export interface VerifyEmailProps {
  appUrl: string
  name: string
  url: string
  /** `signup` for a new account, `change` when confirming a new address for an existing account. */
  reason: 'signup' | 'change'
}

export default function VerifyEmail({ appUrl, name, url, reason }: VerifyEmailProps) {
  const isChange = reason === 'change'
  return (
    <Layout
      appUrl={appUrl}
      preview={
        isChange ? 'Confirm your new email address for Clozera.' : 'Confirm your email to start practicing.'
      }
      heading={isChange ? 'Confirm your new email address' : 'Confirm your email address'}
    >
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>
        {isChange
          ? 'Confirm this address to finish changing the email on your Clozera account.'
          : 'Welcome to Clozera! Confirm your email address to finish creating your account.'}
      </Text>
      <ActionLink href={url} label={isChange ? 'Confirm new email' : 'Confirm email'} />
      <Text style={mutedText}>
        This link expires in 24 hours. If you did not {isChange ? 'request this change' : 'create an account'}
        , you can ignore this email.
      </Text>
    </Layout>
  )
}

VerifyEmail.PreviewProps = {
  appUrl: 'http://localhost:5173',
  name: 'Ada',
  url: 'http://localhost:5173/api/auth/verify-email?token=preview',
  reason: 'signup',
} satisfies VerifyEmailProps
