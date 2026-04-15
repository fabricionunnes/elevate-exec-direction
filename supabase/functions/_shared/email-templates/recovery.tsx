/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  previewText?: string
  title?: string
  introText?: string
  buttonLabel?: string
  smallText?: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
  previewText,
  title,
  introText,
  buttonLabel,
  smallText,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{previewText ?? `Redefinir sua senha — ${siteName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img
            src="https://czmyjgdixwhpfasfugkm.supabase.co/storage/v1/object/public/email-assets/logo-unv.png"
            width="180"
            height="auto"
            alt="Universidade Nacional de Vendas"
            style={{ margin: '0 auto' }}
          />
        </Section>
        <Section style={content}>
          <Heading style={h1}>{title ?? 'Redefinir sua senha'}</Heading>
          <Text style={text}>
            {introText ?? `Recebemos uma solicitação para redefinir a senha da sua conta na ${siteName}. Clique no botão abaixo para criar uma nova senha.`}
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={confirmationUrl}>
              {buttonLabel ?? 'Redefinir Senha'}
            </Button>
          </Section>
          <Text style={smallText}>
            {smallText ?? 'Se você não solicitou a redefinição de senha, pode ignorar este e-mail. Sua senha não será alterada.'}
          </Text>
        </Section>
        <Hr style={divider} />
        <Text style={footer}>
          © {new Date().getFullYear()} Universidade Nacional de Vendas — Direção Comercial como Serviço
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#f4f4f5', fontFamily: "'Segoe UI', Arial, sans-serif", padding: '20px 0' }
const container = { backgroundColor: '#ffffff', borderRadius: '12px', maxWidth: '560px', margin: '0 auto', overflow: 'hidden' as const }
const header = { backgroundColor: '#0A1628', padding: '28px 40px', textAlign: 'center' as const }
const content = { padding: '32px 40px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0A1628', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 20px' }
const buttonContainer = { textAlign: 'center' as const, margin: '28px 0' }
const button = { backgroundColor: '#DC2626', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 32px', textDecoration: 'none' }
const smallText = { fontSize: '13px', color: '#9ca3af', lineHeight: '1.5', margin: '20px 0 0' }
const divider = { borderColor: '#e5e7eb', margin: '0' }
const footer = { fontSize: '12px', color: '#9ca3af', textAlign: 'center' as const, padding: '20px 40px', margin: '0' }
