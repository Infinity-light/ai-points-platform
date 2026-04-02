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
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
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
@UseGuards(PoliciesGuard)
export class VoteController {
  constructor(private readonly voteService: VoteService) {}

  @Post()
  @CheckPolicies('votes', 'create')
  createSession(@Body() dto: CreateVoteSessionDto, @Request() req: RequestWithUser) {
    return this.voteService.createSession(req.user.tenantId, dto.projectId, req.user.sub, dto.taskIds);
  }

  @Get('project/:projectId')
  @CheckPolicies('votes', 'read')
  getProjectSessions(@Param('projectId') projectId: string, @Request() req: RequestWithUser) {
    return this.voteService.getSessionsForProject(req.user.tenantId, projectId);
  }

  @Get(':id')
  @CheckPolicies('votes', 'read')
  getSession(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.voteService.getSession(id, req.user.tenantId);
  }

  @Post(':id/votes')
  @CheckPolicies('votes', 'create')
  castVote(
    @Param('id') id: string,
    @Body() dto: CastVoteDto,
    @Request() req: RequestWithUser,
  ) {
    return this.voteService.castVote(id, req.user.tenantId, req.user.sub, dto.vote);
  }

  @Patch(':id/close')
  @CheckPolicies('votes', 'close')
  closeSession(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.voteService.closeSession(id, req.user.tenantId);
  }

  @Get(':id/votes')
  @CheckPolicies('votes', 'read')
  getVotes(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.voteService.getVotesForSession(id, req.user.tenantId);
  }
}
