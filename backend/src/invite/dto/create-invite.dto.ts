import { IsInt, IsOptional, IsString, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInviteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  maxUses?: number; // 默认 1

  @IsOptional()
  @IsDateString()
  expiresAt?: string; // ISO 日期字符串

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
