import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../user/guards/roles.guard';
import { Roles } from '../user/decorators/roles.decorator';
import { Role } from '../user/enums/role.enum';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @Roles(Role.PROJECT_LEAD, Role.HR_ADMIN, Role.SUPER_ADMIN)
  create(@Body() dto: CreateProjectDto, @Request() req: RequestWithUser) {
    return this.projectService.create(req.user.tenantId, req.user.sub, dto);
  }

  @Get()
  findAll(@Request() req: RequestWithUser, @Query('mine') mine?: string) {
    if (mine === 'true') {
      return this.projectService.findMyProjects(req.user.tenantId, req.user.sub);
    }
    return this.projectService.findAll(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.projectService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(Role.PROJECT_LEAD, Role.HR_ADMIN, Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Request() req: RequestWithUser,
  ) {
    return this.projectService.update(id, req.user.tenantId, dto);
  }

  @Patch(':id/archive')
  @Roles(Role.PROJECT_LEAD, Role.HR_ADMIN, Role.SUPER_ADMIN)
  archive(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.projectService.archive(id, req.user.tenantId);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.projectService.getMembers(id, req.user.tenantId);
  }

  @Post(':id/members')
  @Roles(Role.PROJECT_LEAD, Role.HR_ADMIN, Role.SUPER_ADMIN)
  addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @Request() req: RequestWithUser,
  ) {
    return this.projectService.addMember(id, req.user.tenantId, dto.userId);
  }

  @Delete(':id/members/:userId')
  @Roles(Role.PROJECT_LEAD, Role.HR_ADMIN, Role.SUPER_ADMIN)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.projectService.removeMember(id, req.user.tenantId, userId);
  }
}
