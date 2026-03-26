import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TenantInterceptor } from './tenant/interceptors/tenant.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // 全局 ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 全局 TenantInterceptor
  const tenantInterceptor = app.get(TenantInterceptor);
  app.useGlobalInterceptors(tenantInterceptor);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
