import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProvider } from './entities/ai-provider.entity';
import { AiProviderKey } from './entities/ai-provider-key.entity';
import { OpenApiKey } from './entities/open-api-key.entity';
import { AiProviderService } from './ai-provider.service';
import { OpenApiKeyService } from './open-api-key.service';
import { AiConfigController } from './ai-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiProvider, AiProviderKey, OpenApiKey])],
  controllers: [AiConfigController],
  providers: [AiProviderService, OpenApiKeyService],
  exports: [TypeOrmModule, AiProviderService, OpenApiKeyService],
})
export class AiConfigModule {}
