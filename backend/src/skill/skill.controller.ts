import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SkillService } from './skill.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller()
// Auth handled by global CompositeAuthGuard
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  @Get('projects/:projectId/skills')
  findForProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.skillService.findForProject(req.user.tenantId, projectId);
  }

  @Get('skills/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.skillService.findOne(id, req.user.tenantId);
  }

  @Get('skills/:id/submissions')
  findSubmissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.skillService.findSubmissions(id, req.user.tenantId);
  }
}
