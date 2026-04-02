import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsUUID, IsNotEmpty, IsString, IsOptional, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuctionService } from './auction.service';
import type { AuctionFilters } from './auction.service';
import { CompositeAuthGuard } from '../auth/guards/composite-auth.guard';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { AuctionStatus, AuctionType } from './entities/auction.entity';

class CreateAuctionBodyDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsOptional()
  targetEntity?: string;

  @IsUUID()
  @IsOptional()
  targetId?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minBid?: number;

  @IsDateString()
  endsAt!: string;
}

class PlaceBidBodyDto {
  @IsInt()
  @Min(0)
  @Type(() => Number)
  amount!: number;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('auctions')
@UseGuards(CompositeAuthGuard, PoliciesGuard)
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Post()
  @CheckPolicies('auctions', 'create')
  create(@Body() dto: CreateAuctionBodyDto, @Request() req: RequestWithUser) {
    return this.auctionService.create({
      tenantId: req.user.tenantId,
      createdBy: req.user.sub,
      dto: {
        type: dto.type as AuctionType,
        targetEntity: dto.targetEntity,
        targetId: dto.targetId,
        description: dto.description,
        minBid: dto.minBid,
        endsAt: new Date(dto.endsAt),
      },
    });
  }

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    const filters: AuctionFilters = {};
    if (status) filters.status = status as AuctionStatus;
    if (type) filters.type = type as AuctionType;
    return this.auctionService.list({ tenantId: req.user.tenantId, filters });
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.auctionService.get({ auctionId: id, tenantId: req.user.tenantId });
  }

  @Post(':id/bid')
  placeBid(
    @Param('id') id: string,
    @Body() dto: PlaceBidBodyDto,
    @Request() req: RequestWithUser,
  ) {
    return this.auctionService.placeBid({
      auctionId: id,
      userId: req.user.sub,
      tenantId: req.user.tenantId,
      amount: dto.amount,
    });
  }

  @Patch(':id/cancel')
  @CheckPolicies('auctions', 'close')
  cancel(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.auctionService.cancel({
      auctionId: id,
      tenantId: req.user.tenantId,
    });
  }
}
