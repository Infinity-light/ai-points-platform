import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { IsUUID, IsNotEmpty, IsOptional } from 'class-validator';
import { MeetingService } from './meeting.service';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

class CreateMeetingDto {
  @IsUUID()
  @IsNotEmpty()
  projectId!: string;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('meetings')
@UseGuards(PoliciesGuard)
export class MeetingController {
  constructor(private readonly meetingService: MeetingService) {}

  @Post()
  @CheckPolicies('votes', 'create')
  createMeeting(@Body() dto: CreateMeetingDto, @Request() req: RequestWithUser) {
    return this.meetingService.createMeeting({
      tenantId: req.user.tenantId,
      projectId: dto.projectId,
      createdBy: req.user.sub,
    });
  }

  @Get()
  @CheckPolicies('votes', 'read')
  listMeetings(
    @Query('projectId') projectId: string | undefined,
    @Request() req: RequestWithUser,
  ) {
    return this.meetingService.listMeetings({
      tenantId: req.user.tenantId,
      projectId,
    });
  }

  @Get(':id')
  @CheckPolicies('votes', 'read')
  getMeeting(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.meetingService.getMeeting(id, req.user.tenantId);
  }

  @Patch(':id/close')
  @CheckPolicies('votes', 'close')
  closeMeeting(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.meetingService.closeMeeting({
      meetingId: id,
      tenantId: req.user.tenantId,
      closedBy: req.user.sub,
    });
  }
}
