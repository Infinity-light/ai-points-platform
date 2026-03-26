import {
  Controller,
  Post,
  Body,
  Headers,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';

interface GitHubWebhookPayload {
  ref?: string;
  commits?: Array<{
    id: string;
    message: string;
    timestamp: string;
    url: string;
    author?: { name: string; email: string };
  }>;
  repository?: { full_name: string; html_url: string };
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('git')
  async handleGitWebhook(
    @Body() payload: GitHubWebhookPayload,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-github-event') githubEvent?: string,
    @Headers('x-gitlab-event') gitlabEvent?: string,
  ) {
    // Only process push events
    if (githubEvent && githubEvent !== 'push') {
      return { message: `Ignored event: ${githubEvent}` };
    }

    if (!tenantId) {
      throw new BadRequestException('缺少 X-Tenant-ID header');
    }

    const commits = payload.commits ?? [];
    const processed: string[] = [];

    for (const commit of commits) {
      const taskIds = this.webhookService.extractTaskIds(commit.message);
      for (const taskId of taskIds) {
        try {
          await this.webhookService.processCommit({
            tenantId,
            taskId,
            commitHash: commit.id,
            commitMessage: commit.message,
            repoUrl: payload.repository?.html_url ?? '',
            commitUrl: commit.url,
          });
          processed.push(`${taskId}:${commit.id.slice(0, 8)}`);
        } catch (err) {
          this.logger.error(`Failed to process commit ${commit.id} for task ${taskId}: ${String(err)}`);
        }
      }
    }

    return { processed, total: processed.length };
  }
}
