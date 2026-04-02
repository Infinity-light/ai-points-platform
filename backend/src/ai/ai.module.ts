import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { TextExtractorService } from './text-extractor.service';

@Module({
  imports: [AiConfigModule],
  providers: [AiService, TextExtractorService],
  exports: [AiService, TextExtractorService],
})
export class AiModule {}
