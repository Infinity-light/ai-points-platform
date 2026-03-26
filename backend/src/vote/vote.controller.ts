import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { VoteService } from './vote.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../user/guards/roles.guard';
import { Roles } from '../user/decorators/roles.decorator';
import { Role } from '../user/enums/role.enum';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IsBoolean, IsArray, IsUUID, ArrayMinSize, IsNotEmpty } from 'class-validator';

class CreateVoteSessionDto {
  @IsUUID()
  @IsNotEmpty()
  projectId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  taskIds!: string[];
}

class CastVoteDto {
  @IsBoolean()
  vote!: boolean;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('vote-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoteController {
  constructor(private readonly voteService: VoteService) {}

  @Post()
  @Roles(Role.PROJECT_LEAD, Role.HR_ADMIN, Role.SUPER_ADMIN)
  createSession(@Body() dto: CreateVoteSessionDto, @Request() req: RequestWithUser) {
    return this.voteService.createSession(req.user.tenantId, dto.projectId, req.user.sub, dto.taskIds);
  }

  @Get('project/:projectId')
  getProjectSessions(@Param('projectId') projectId: string, @Request() req: RequestWithUser) {
    return this.voteService.getSessionsForProject(req.user.tenantId, projectId);
  }

  @Get(':id')
  getSession(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.voteService.getSession(id, req.user.tenantId);
  }

  @Post(':id/votes')
  castVote(
    @Param('id') id: string,
    @Body() dto: CastVoteDto,
    @Request() req: RequestWithUser,
  ) {
    return this.voteService.castVote(id, req.user.tenantId, req.user.sub, dto.vote);
  }

  @Patch(':id/close')
  @Roles(Role.PROJECT_LEAD, Role.HR_ADMIN, Role.SUPER_ADMIN)
  closeSession(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.voteService.closeSession(id, req.user.tenantId);
  }

  @Get(':id/votes')
  getVotes(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.voteService.getVotesForSession(id, req.user.tenantId);
  }
}
