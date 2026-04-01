import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { Invite } from './entities/invite.entity';
import { InviteUsage } from './entities/invite-usage.entity';
import { UserModule } from '../user/user.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite, InviteUsage]),
    UserModule,
    RbacModule,
  ],
  controllers: [InviteController],
  providers: [InviteService],
  exports: [InviteService],
})
export class InviteModule {}
