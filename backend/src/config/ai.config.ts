import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  apiKey: process.env.LLM_API_KEY ?? '',
  baseUrl: process.env.LLM_BASE_URL ?? 'https://api.anthropic.com/v1',
  model: process.env.LLM_MODEL ?? 'claude-sonnet-4-6',
  temperature: Number(process.env.LLM_TEMPERATURE ?? '0.3'),
}));
