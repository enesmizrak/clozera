import { Text } from 'react-email'
import { ActionLink, Layout, mutedText, text } from '../components/layout.tsx'

export interface ChangeEmailProps {
  appUrl: string
  name: string
  newEmail: string
  url: string
}

/** Sent to the current address, so an attacker with a session cannot move the account silently. */
export default function ChangeEmail({ appUrl, name, newEmail, url }: ChangeEmailProps) {
  return (
    <Layout
      appUrl={appUrl}
      preview="Approve the email change on your Clozera account."
      heading="Approve email change"
    >
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>
        Someone asked to change the email on your Clozera account to <strong>{newEmail}</strong>. If this was
        you, approve the change. We will then send a confirmation link to the new address.
      </Text>
      <ActionLink href={url} label="Approve change" />
      <Text style={mutedText}>
        This link expires in 24 hours. If you did not request this, ignore this email and change your
        password.
      </Text>
    </Layout>
  )
}

ChangeEmail.PreviewProps = {
  appUrl: 'http://localhost:5173',
  name: 'Ada',
  newEmail: 'ada@new.example',
  url: 'http://localhost:5173/api/auth/verify-email?token=preview',
} satisfies ChangeEmailProps
