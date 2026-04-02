import {
  Controller,
  Get,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { DepartmentService } from './department.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get('tree')
  async getTree(@Request() req: RequestWithUser) {
    const items = await this.departmentService.findTree(req.user.tenantId);
    return { items };
  }

  @Get(':id/members')
  async getMembers(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.departmentService.findMembersByDeptId(
      req.user.tenantId,
      id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }
}
