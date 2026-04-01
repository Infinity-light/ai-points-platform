import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FieldDefDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(['text', 'number', 'date', 'single_select', 'multi_select'])
  type!: 'text' | 'number' | 'date' | 'single_select' | 'multi_select';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsInt()
  order!: number;
}

export class UpdateCustomFieldsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDefDto)
  fields!: FieldDefDto[];
}
