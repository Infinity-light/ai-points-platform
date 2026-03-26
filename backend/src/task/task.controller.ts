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
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TransitionTaskDto } from './dto/transition-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('projects/:projectId/tasks')
@UseGuards(JwtAuthGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @Request() req: RequestWithUser,
  ) {
    return this.taskService.create(req.user.tenantId, projectId, req.user.sub, dto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string, @Request() req: RequestWithUser) {
    return this.taskService.findAll(req.user.tenantId, projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.taskService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Request() req: RequestWithUser,
  ) {
    return this.taskService.update(id, req.user.tenantId, dto);
  }

  @Patch(':id/transition')
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionTaskDto,
    @Request() req: RequestWithUser,
  ) {
    return this.taskService.transition(id, req.user.tenantId, req.user.sub, dto.status);
  }
}
