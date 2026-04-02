import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiConfigModule } from '../ai-config/ai-config.module';

@Module({
  imports: [AiConfigModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
