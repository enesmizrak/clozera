import { Text } from 'react-email'
import { ActionLink, Layout, mutedText, text } from '../components/layout.tsx'

export interface ResetPasswordProps {
  appUrl: string
  name: string
  url: string
}

export default function ResetPassword({ appUrl, name, url }: ResetPasswordProps) {
  return (
    <Layout appUrl={appUrl} preview="Reset your Clozera password." heading="Reset your password">
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>We received a request to set a new password for your Clozera account.</Text>
      <ActionLink href={url} label="Choose a new password" />
      <Text style={mutedText}>
        This link expires in 1 hour and signs you out on other devices once used. If you did not ask for a new
        password, you can ignore this email; your password stays the same.
      </Text>
    </Layout>
  )
}

ResetPassword.PreviewProps = {
  appUrl: 'http://localhost:5173',
  name: 'Ada',
  url: 'http://localhost:5173/api/auth/reset-password/preview?callbackURL=%2Freset-password',
} satisfies ResetPasswordProps
