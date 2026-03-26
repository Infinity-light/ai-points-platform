import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsService } from './points.service';
import { PointRecord } from './entities/point-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PointRecord])],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
