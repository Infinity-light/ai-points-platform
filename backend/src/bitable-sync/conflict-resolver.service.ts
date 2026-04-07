import { Injectable } from '@nestjs/common';
import type { ConflictStrategy } from '../feishu/entities/feishu-bitable-binding.entity';

export type ConflictResolution = 'use_platform' | 'use_feishu' | 'skip';

export interface ConflictResolveOptions {
  strategy: ConflictStrategy;
  platformUpdatedAt: Date | null;
  feishuUpdatedAt: Date | null;
}

@Injectable()
export class ConflictResolverService {
  resolve(opts: ConflictResolveOptions): ConflictResolution {
    if (opts.strategy === 'platform_wins') {
      return 'use_platform';
    }

    if (opts.strategy === 'feishu_wins') {
      return 'use_feishu';
    }

    // last_write_wins: compare timestamps; more recent update wins
    if (!opts.platformUpdatedAt && !opts.feishuUpdatedAt) {
      return 'use_platform';
    }
    if (!opts.platformUpdatedAt) {
      return 'use_feishu';
    }
    if (!opts.feishuUpdatedAt) {
      return 'use_platform';
    }

    return opts.platformUpdatedAt >= opts.feishuUpdatedAt ? 'use_platform' : 'use_feishu';
  }
}
