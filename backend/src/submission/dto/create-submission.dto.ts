import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { SubmissionType } from '../entities/submission.entity';

export class CreateSubmissionDto {
  @IsUUID()
  taskId!: string;

  @IsEnum(SubmissionType)
  type!: SubmissionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content!: string; // 工作描述

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
