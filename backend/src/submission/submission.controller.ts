import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CompositeAuthGuard } from '../auth/guards/composite-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('submissions')
@UseGuards(CompositeAuthGuard)
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Post()
  create(@Body() dto: CreateSubmissionDto, @Request() req: RequestWithUser) {
    return this.submissionService.create(req.user.tenantId, req.user.sub, dto);
  }

  @Get('task/:taskId')
  findByTask(@Param('taskId') taskId: string, @Request() req: RequestWithUser) {
    return this.submissionService.findByTask(taskId, req.user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.submissionService.findOne(id, req.user.tenantId);
  }
}
