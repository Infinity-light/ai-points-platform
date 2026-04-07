import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsDateString,
  IsArray,
  IsUUID,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReimbursementService } from './reimbursement.service';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { ReimbursementType } from './entities/reimbursement.entity';

class CreateReimbursementItemDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @IsDateString()
  expenseDate!: string;

  @IsArray()
  @IsOptional()
  receiptUploadIds?: string[];
}

class CreateReimbursementDto {
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'asset_purchase',
    'travel',
    'office_supply',
    'training',
    'software_license',
    'cloud_service',
    'other',
  ])
  reimbursementType!: ReimbursementType;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReimbursementItemDto)
  items!: CreateReimbursementItemDto[];
}

class UpdateReimbursementDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReimbursementItemDto)
  @IsOptional()
  items?: CreateReimbursementItemDto[];
}

class SubmitReimbursementDto {
  @IsUUID()
  @IsOptional()
  departmentHeadId?: string;
}

class MarkPaidDto {
  @IsString()
  @IsOptional()
  paymentReference?: string;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('reimbursements')
@UseGuards(PoliciesGuard)
export class ReimbursementController {
  constructor(private readonly reimbursementService: ReimbursementService) {}

  @Get()
  @CheckPolicies('reimbursements', 'read')
  list(
    @Request() req: RequestWithUser,
    @Query('submitterId') submitterId?: string,
    @Query('status') status?: string,
  ) {
    return this.reimbursementService.findAll(req.user.tenantId, { submitterId, status });
  }

  @Post()
  @CheckPolicies('reimbursements', 'create')
  create(@Request() req: RequestWithUser, @Body() dto: CreateReimbursementDto) {
    return this.reimbursementService.create(req.user.tenantId, req.user.sub, dto);
  }

  @Get(':id')
  @CheckPolicies('reimbursements', 'read')
  findOne(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.reimbursementService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @CheckPolicies('reimbursements', 'update')
  update(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateReimbursementDto,
  ) {
    return this.reimbursementService.update(id, req.user.tenantId, req.user.sub, dto);
  }

  @Post(':id/submit')
  @CheckPolicies('reimbursements', 'create')
  submit(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: SubmitReimbursementDto,
  ) {
    return this.reimbursementService.submit(
      id,
      req.user.tenantId,
      req.user.sub,
      dto.departmentHeadId,
    );
  }

  @Post(':id/pay')
  @CheckPolicies('reimbursements', 'approve')
  markPaid(@Request() req: RequestWithUser, @Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.reimbursementService.markPaid(id, req.user.tenantId, dto);
  }

  @Post(':id/complete')
  @CheckPolicies('reimbursements', 'update')
  markComplete(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.reimbursementService.markComplete(id, req.user.tenantId, req.user.sub);
  }

  @Delete(':id')
  @CheckPolicies('reimbursements', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.reimbursementService.delete(id, req.user.tenantId, req.user.sub);
  }
}
