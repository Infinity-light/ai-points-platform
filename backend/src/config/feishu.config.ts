import { registerAs } from '@nestjs/config';

export default registerAs('feishu', () => ({
  encryptKey: process.env.FEISHU_ENCRYPT_KEY ?? '',
  callbackUrl:
    process.env.FEISHU_CALLBACK_URL ?? 'http://localhost:4100/auth/feishu/callback',
}));
