import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { Upload } from './entities/upload.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Upload]),
    MulterModule.register({ dest: './uploads' }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
