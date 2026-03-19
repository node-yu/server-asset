import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SignificantChangeItem {
  accountName: string;
  prevAmount: number;
  currAmount: number;
  changeUsd: number;
  changePct: number;
}

export interface DailyCostNotifyPayload {
  date: string;
  totalAccounts: number;
  success: number;
  failed: number;
  failedAccounts?: { name: string; error: string }[];
  significantChanges?: SignificantChangeItem[];
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /** 发送每日费用通知：仅当有显著变动（>$50 且 >50%）或查询失败时发送 */
  async sendDailyCostNotify(payload: DailyCostNotifyPayload): Promise<void> {
    const hasSignificant = (payload.significantChanges?.length ?? 0) > 0;
    const hasFailed = (payload.failedAccounts?.length ?? 0) > 0;

    if (!hasSignificant && !hasFailed) {
      this.logger.log('[通知] 无显著变动且无失败，跳过发送');
      return;
    }

    const hasEmail = process.env.NOTIFY_EMAIL_TO?.trim();
    const hasWebhook = process.env.NOTIFY_WEBHOOK_URL?.trim();
    if (!hasEmail && !hasWebhook) return;

    const subject = hasSignificant
      ? `[云资产管家] ⚠️ 费用显著变动 ${payload.date}`
      : `[云资产管家] 每日费用查询 ${payload.date} - 部分失败`;
    const text = this.buildNotifyText(payload);

    if (hasEmail) {
      try {
        await this.sendEmail(subject, text);
        this.logger.log('[通知] 邮件已发送');
      } catch (e) {
        this.logger.error(`[通知] 邮件发送失败: ${(e as Error).message}`);
      }
    }

    if (hasWebhook) {
      try {
        await this.sendWebhook(payload, text);
        this.logger.log('[通知] Webhook 已发送');
      } catch (e) {
        this.logger.error(`[通知] Webhook 发送失败: ${(e as Error).message}`);
      }
    }
  }

  private buildNotifyText(payload: DailyCostNotifyPayload): string {
    const lines: string[] = [`日期: ${payload.date}`, ''];

    if (payload.significantChanges?.length) {
      lines.push('【费用显著变动】变动超过 $50 且 50%:');
      payload.significantChanges.forEach((s) => {
        const sign = s.changeUsd >= 0 ? '+' : '';
        lines.push(`  ${s.accountName}: $${s.prevAmount.toFixed(2)} → $${s.currAmount.toFixed(2)} (${sign}$${s.changeUsd.toFixed(2)}, ${sign}${s.changePct.toFixed(1)}%)`);
      });
      lines.push('');
    }

    if (payload.failedAccounts?.length) {
      lines.push('【查询失败】:');
      payload.failedAccounts.forEach((a) => lines.push(`  - ${a.name}: ${a.error}`));
    }

    return lines.join('\n');
  }

  private async sendEmail(subject: string, text: string): Promise<void> {
    const to = process.env.NOTIFY_EMAIL_TO?.trim();
    if (!to) {
      this.logger.warn('[通知] 未配置 NOTIFY_EMAIL_TO，跳过发送');
      return;
    }

    const clientId = process.env.NOTIFY_GMAIL_CLIENT_ID?.trim();
    const clientSecret = process.env.NOTIFY_GMAIL_CLIENT_SECRET?.trim();
    const refreshToken = process.env.NOTIFY_GMAIL_REFRESH_TOKEN?.trim();
    const user = process.env.NOTIFY_SMTP_USER?.trim() || process.env.NOTIFY_GMAIL_USER?.trim();

    if (clientId && clientSecret && refreshToken && user) {
      await this.sendEmailOAuth2(user, to, subject, text, clientId, clientSecret, refreshToken);
      return;
    }

    const pass = process.env.NOTIFY_SMTP_PASS?.trim();
    if (user && pass) {
      await this.sendEmailSmtp(user, to, subject, text, pass);
      return;
    }

    this.logger.warn('[通知] 邮件配置不完整。方式一(OAuth2): NOTIFY_GMAIL_CLIENT_ID、NOTIFY_GMAIL_CLIENT_SECRET、NOTIFY_GMAIL_REFRESH_TOKEN、NOTIFY_GMAIL_USER。方式二(应用密码): NOTIFY_SMTP_USER、NOTIFY_SMTP_PASS');
  }

  private async sendEmailOAuth2(
    user: string,
    to: string,
    subject: string,
    text: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<void> {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user,
        clientId,
        clientSecret,
        refreshToken,
      },
    });

    await transporter.sendMail({
      from: user,
      to,
      subject,
      text,
    });
  }

  private async sendEmailSmtp(user: string, to: string, subject: string, text: string, pass: string): Promise<void> {
    const host = process.env.NOTIFY_SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = parseInt(process.env.NOTIFY_SMTP_PORT || '465', 10);
    const from = process.env.NOTIFY_SMTP_FROM?.trim() || user;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
    });
  }

  private async sendWebhook(payload: DailyCostNotifyPayload, text: string): Promise<void> {
    const url = process.env.NOTIFY_WEBHOOK_URL?.trim();
    if (!url) return;

    const type = (process.env.NOTIFY_WEBHOOK_TYPE || 'dingtalk').toLowerCase();
    let body: object;

    if (type === 'dingtalk' || type === 'wecom') {
      const title = payload.significantChanges?.length ? '⚠️ 费用显著变动' : '每日费用查询';
      body = { msgtype: 'text', text: { content: `【云资产管家】${title} ${payload.date}\n${text}` } };
    } else if (type === 'slack') {
      body = { text: `【云资产管家】每日费用查询 ${payload.date}\n${text}` };
    } else {
      body = { title: '云资产管家 - 每日费用查询', ...payload, message: text };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
  }
}
