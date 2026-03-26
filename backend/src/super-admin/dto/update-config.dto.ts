import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @IsString()
  llmModel?: string;

  @IsOptional()
  @IsString()
  llmBaseUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  maxFileSizeMb?: number;
}
