import { IsString, IsNotEmpty, IsOptional, MaxLength, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AnnealingConfigDto {
  @IsOptional()
  cyclesPerStep?: number;

  @IsOptional()
  maxSteps?: number;
}

class SettlementConfigDto {
  @IsOptional()
  periodType?: 'weekly' | 'monthly';

  @IsOptional()
  dayOfWeek?: number;

  @IsOptional()
  dayOfMonth?: number;
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AnnealingConfigDto)
  annealingConfig?: AnnealingConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SettlementConfigDto)
  settlementConfig?: SettlementConfigDto;
}
