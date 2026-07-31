import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'

@Injectable()
export class TransactionalEmailService {
  constructor(private readonly config: ConfigService) {}

  isEnabled() {
    return ['1', 'true', 'yes', 'on'].includes(
      String(this.config.get<string | boolean>('RELAY_TRANSACTIONAL_EMAIL_ENABLED') ?? '')
        .trim()
        .toLowerCase(),
    )
  }

  async sendEmailVerification(email: string, name: string, token: string) {
    const url = `${this.webOrigin()}/?verify_email=${encodeURIComponent(token)}`
    return this.send({
      to: email,
      subject: 'Verify your Relay Console email',
      text: `Hi ${name},\n\nVerify your Relay Console email by opening this link:\n${url}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
      html: `<p>Hi ${this.escapeHtml(name)},</p><p>Verify your Relay Console email:</p><p><a href="${this.escapeHtml(url)}">Verify email</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`,
      idempotencyKey: `email-verification/${randomUUID()}`,
    })
  }

  async sendPasswordReset(email: string, name: string, token: string) {
    const url = `${this.webOrigin()}/?reset_password=${encodeURIComponent(token)}`
    return this.send({
      to: email,
      subject: 'Reset your Relay Console password',
      text: `Hi ${name},\n\nReset your Relay Console password by opening this link:\n${url}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, you can ignore this email.`,
      html: `<p>Hi ${this.escapeHtml(name)},</p><p>Reset your Relay Console password:</p><p><a href="${this.escapeHtml(url)}">Reset password</a></p><p>This link expires in 30 minutes and can be used once. If you did not request it, you can ignore this email.</p>`,
      idempotencyKey: `password-reset/${randomUUID()}`,
    })
  }

  async sendEmailChangeVerification(
    email: string,
    name: string,
    token: string,
  ) {
    const url = `${this.webOrigin()}/?change_email=${encodeURIComponent(token)}`
    return this.send({
      to: email,
      subject: 'Confirm your new Relay Console email',
      text: `Hi ${name},\n\nConfirm this as your new Relay Console email by opening this link:\n${url}\n\nThis link expires in 30 minutes and can be used once. If you did not request this change, do not open the link.`,
      html: `<p>Hi ${this.escapeHtml(name)},</p><p>Confirm this as your new Relay Console email:</p><p><a href="${this.escapeHtml(url)}">Confirm new email</a></p><p>This link expires in 30 minutes and can be used once. If you did not request this change, do not open the link.</p>`,
      idempotencyKey: `email-change-verification/${randomUUID()}`,
    })
  }

  async sendEmailChangeSecurityNotice(email: string, name: string) {
    return this.send({
      to: email,
      subject: 'Relay Console email change requested',
      text: `Hi ${name},\n\nA request was made to change the email address on your Relay Console account. Your current email remains active until the new address is verified. If this was not you, change your password immediately and contact support.`,
      html: `<p>Hi ${this.escapeHtml(name)},</p><p>A request was made to change the email address on your Relay Console account. Your current email remains active until the new address is verified.</p><p>If this was not you, change your password immediately and contact support.</p>`,
      idempotencyKey: `email-change-security-notice/${randomUUID()}`,
    })
  }

  async sendEmailChangeCompletedNotice(email: string, name: string) {
    return this.send({
      to: email,
      subject: 'Relay Console email changed',
      text: `Hi ${name},\n\nThe email address on your Relay Console account was changed. All existing sessions and outstanding account-recovery links were revoked. If this was not you, contact support immediately.`,
      html: `<p>Hi ${this.escapeHtml(name)},</p><p>The email address on your Relay Console account was changed. All existing sessions and outstanding account-recovery links were revoked.</p><p>If this was not you, contact support immediately.</p>`,
      idempotencyKey: `email-change-completed/${randomUUID()}`,
    })
  }

  private async send(input: { to: string; subject: string; text: string; html: string; idempotencyKey: string }) {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('TRANSACTIONAL_EMAIL_NOT_ENABLED')
    }
    const apiKey = this.required('RESEND_API_KEY')
    const from = this.required('RELAY_EMAIL_FROM')
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    })
    if (!response.ok) {
      throw new BadGatewayException('TRANSACTIONAL_EMAIL_PROVIDER_FAILED')
    }
    return response.json() as Promise<{ id: string }>
  }

  private webOrigin() {
    const value = this.required('RELAY_PUBLIC_WEB_ORIGIN')
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new ServiceUnavailableException('RELAY_PUBLIC_WEB_ORIGIN_INVALID')
    }
    return url.origin
  }

  private required(key: string) {
    const value = this.config.get<string>(key)?.trim()
    if (!value) throw new ServiceUnavailableException(`${key}_REQUIRED`)
    return value
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character] ?? character)
  }
}
