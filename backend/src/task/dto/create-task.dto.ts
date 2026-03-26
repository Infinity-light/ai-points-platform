import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsObject,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  estimatedPoints?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
