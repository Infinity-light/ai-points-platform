import { IsString, IsNotEmpty, IsOptional, MaxLength, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AnnealingConfigDto {
  @IsOptional()
  cyclesPerStep?: number;

  @IsOptional()
  maxSteps?: number;
}

class ScheduleConfigDto {
  @IsOptional()
  periodType?: 'weekly' | 'monthly';

  @IsOptional()
  dayOfWeek?: number;

  @IsOptional()
  dayOfMonth?: number;
}

class SettlementConfigDto {
  @IsOptional()
  mode?: 'manual' | 'reminder' | 'auto';

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ScheduleConfigDto)
  schedule?: ScheduleConfigDto;

  // Legacy fields for backward compatibility
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
