import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DividendService } from './dividend.service';
import { DividendController } from './dividend.controller';
import { Dividend } from './entities/dividend.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dividend]),
    UserModule,
  ],
  controllers: [DividendController],
  providers: [DividendService],
  exports: [DividendService],
})
export class DividendModule {}
