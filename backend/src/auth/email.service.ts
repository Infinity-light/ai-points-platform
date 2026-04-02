import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.from =
      this.configService.get<string>('auth.emailFrom') ??
      'AI积分平台 <noreply@godpenai.com>';
    this.apiKey = this.configService.get<string>('auth.resendApiKey') ?? '';
  }

  async sendVerificationCode(
    email: string,
    code: string,
    name: string,
  ): Promise<void> {
    const subject = '【AI积分平台】邮箱验证码';
    const html = `
      <p>您好，${name}！</p>
      <p>您的邮箱验证码为：</p>
      <h2 style="letter-spacing: 4px; color: #333;">${code}</h2>
      <p>验证码有效期为 15 分钟，请尽快完成验证。</p>
      <p>如非本人操作，请忽略此邮件。</p>
    `;

    if (!this.apiKey) {
      this.logger.error('RESEND_API_KEY 未配置，无法发送邮件');
      throw new Error('邮件服务未配置，请联系管理员');
    }

    const body = JSON.stringify({ from: this.from, to: [email], subject, html });

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!resp.ok) {
      const err = await resp.text();
      this.logger.error(`发送验证码邮件失败: HTTP ${resp.status} - ${err}`);
      throw new Error('验证码邮件发送失败，请稍后重试');
    }

    this.logger.log(`验证码邮件已发送至 ${email}`);
  }
}
