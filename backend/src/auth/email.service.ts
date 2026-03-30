import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('auth.emailFrom') ?? 'noreply@example.com';
    const port = this.configService.get<number>('auth.smtpPort') ?? 587;
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('auth.smtpHost'),
      port,
      secure: port === 465,
      auth: {
        user: this.configService.get<string>('auth.smtpUser'),
        pass: this.configService.get<string>('auth.smtpPass'),
      },
    });
  }

  async sendVerificationCode(email: string, code: string, name: string): Promise<void> {
    const subject = '【AI积分平台】邮箱验证码';
    const html = `
      <p>您好，${name}！</p>
      <p>您的邮箱验证码为：</p>
      <h2 style="letter-spacing: 4px; color: #333;">${code}</h2>
      <p>验证码有效期为 15 分钟，请尽快完成验证。</p>
      <p>如非本人操作，请忽略此邮件。</p>
    `;

    try {
      await this.transporter.sendMail({ from: this.from, to: email, subject, html });
      this.logger.log(`验证码邮件已发送至 ${email}`);
    } catch (error) {
      this.logger.error(`发送验证码邮件失败: ${String(error)}`);
      // 不抛出错误，让业务层决定如何处理（开发环境可以 console.log code）
      this.logger.warn(`[DEV] 验证码: ${code}`);
    }
  }
}
