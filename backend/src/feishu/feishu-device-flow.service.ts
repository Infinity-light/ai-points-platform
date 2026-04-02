import { Injectable, Logger } from '@nestjs/common';

const DEVICE_FLOW_URL =
  'https://accounts.feishu.cn/oauth/v1/app/registration';
const POLL_INTERVAL_MS = 5_000;
const MAX_TIMEOUT_MS = 5 * 60 * 1000;

export interface DeviceFlowBeginResult {
  available: boolean;
  verificationUri?: string;
  deviceCode?: string;
  expiresIn?: number;
}

export interface DeviceFlowPollResult {
  status: 'pending' | 'completed' | 'expired' | 'error';
  clientId?: string;
  clientSecret?: string;
  message?: string;
}

@Injectable()
export class FeishuDeviceFlowService {
  private readonly logger = new Logger(FeishuDeviceFlowService.name);

  async beginDeviceFlow(): Promise<DeviceFlowBeginResult> {
    try {
      const res = await fetch(DEVICE_FLOW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'begin' }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`Device flow begin failed: HTTP ${res.status}`);
        return { available: false };
      }

      const data = await res.json();
      return {
        available: true,
        verificationUri: data.verification_uri ?? data.verification_uri_complete,
        deviceCode: data.device_code,
        expiresIn: data.expires_in ?? Math.floor(MAX_TIMEOUT_MS / 1000),
      };
    } catch (err) {
      this.logger.warn(`Device flow API unavailable: ${err}`);
      return { available: false };
    }
  }

  async pollDeviceFlow(deviceCode: string): Promise<DeviceFlowPollResult> {
    try {
      const res = await fetch(DEVICE_FLOW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'poll', device_code: deviceCode }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        return { status: 'error', message: `HTTP ${res.status}` };
      }

      const data = await res.json();

      if (data.client_id && data.client_secret) {
        return {
          status: 'completed',
          clientId: data.client_id,
          clientSecret: data.client_secret,
        };
      }

      if (data.error === 'authorization_pending' || data.status === 'pending') {
        return { status: 'pending' };
      }

      if (data.error === 'expired_token' || data.error === 'expired') {
        return { status: 'expired', message: '授权已过期，请重新发起' };
      }

      return { status: 'pending' };
    } catch (err) {
      return { status: 'error', message: String(err) };
    }
  }
}
