import { Body, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from 'react-email'
import type { CSSProperties, ReactNode } from 'react'

/** Email clients need concrete colors; these mirror the web app's orange theme tokens. */
export const colors = {
  background: '#fffaf5',
  card: '#ffffff',
  foreground: '#431407',
  muted: '#85563e',
  primary: '#c2410c',
  primaryForeground: '#ffffff',
  border: '#fed7aa',
} as const

const fontFamily = "'Source Sans 3', 'Segoe UI', Helvetica, Arial, sans-serif"

export const text: CSSProperties = {
  color: colors.foreground,
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
}
export const mutedText: CSSProperties = { ...text, color: colors.muted, fontSize: '14px', lineHeight: '22px' }

export interface LayoutProps {
  appUrl: string
  preview: string
  heading: string
  children: ReactNode
}

export function Layout({ appUrl, preview, heading, children }: LayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.background, fontFamily, margin: 0, padding: '32px 0' }}>
        <Container
          style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            maxWidth: '520px',
            padding: '32px',
          }}
        >
          <Img src={`${appUrl}/brand/clozera-wordmark.png`} alt="Clozera" width="120" height="40" />
          <Heading
            as="h1"
            style={{ color: colors.foreground, fontSize: '24px', lineHeight: '32px', margin: '24px 0 16px' }}
          >
            {heading}
          </Heading>
          {children}
          <Hr style={{ borderColor: colors.border, margin: '32px 0 16px' }} />
          <Text style={{ ...mutedText, fontSize: '12px', lineHeight: '18px', margin: 0 }}>
            Clozera · Open-source language learning ·{' '}
            <Link href={appUrl} style={{ color: colors.muted }}>
              {appUrl.replace(/^https?:\/\//, '')}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

/** A button plus the raw link, for clients that block buttons or images. */
export function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <>
      <Section style={{ margin: '24px 0' }}>
        <Link
          href={href}
          style={{
            backgroundColor: colors.primary,
            borderRadius: '8px',
            color: colors.primaryForeground,
            display: 'inline-block',
            fontSize: '16px',
            fontWeight: 600,
            padding: '12px 20px',
            textDecoration: 'none',
          }}
        >
          {label}
        </Link>
      </Section>
      <Text style={mutedText}>
        If the button does not work, copy this link into your browser:
        <br />
        <Link href={href} style={{ color: colors.primary, wordBreak: 'break-all' }}>
          {href}
        </Link>
      </Text>
    </>
  )
}
