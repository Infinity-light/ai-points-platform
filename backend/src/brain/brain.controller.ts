import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BrainService } from './brain.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IsString, IsNotEmpty, IsArray } from 'class-validator';

class ChatDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}

class CreateFromSuggestionsDto {
  @IsArray()
  tasks!: Array<{ title: string; description?: string }>;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('brain')
// Auth handled by global CompositeAuthGuard
export class BrainController {
  constructor(private readonly brainService: BrainService) {}

  @Get('projects/:projectId/conversation')
  getConversation(@Param('projectId') projectId: string, @Request() req: RequestWithUser) {
    return this.brainService.getOrCreateConversation(
      req.user.tenantId,
      projectId,
      req.user.sub,
    );
  }

  @Delete('projects/:projectId/conversation')
  clearConversation(@Param('projectId') projectId: string, @Request() req: RequestWithUser) {
    return this.brainService.clearConversation(req.user.tenantId, projectId, req.user.sub);
  }

  @Post('projects/:projectId/chat')
  async chat(
    @Param('projectId') projectId: string,
    @Body() dto: ChatDto,
    @Request() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.brainService.streamChat(
      req.user.tenantId,
      projectId,
      req.user.sub,
      dto.message,
      res,
    );
  }

  @Post('projects/:projectId/create-tasks')
  createTasksFromSuggestions(
    @Param('projectId') projectId: string,
    @Body() dto: CreateFromSuggestionsDto,
    @Request() req: RequestWithUser,
  ) {
    return this.brainService.createTasksFromSuggestions(
      req.user.tenantId,
      projectId,
      req.user.sub,
      dto.tasks,
    );
  }
}
