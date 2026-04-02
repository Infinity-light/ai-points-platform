import { IsString, IsNotEmpty, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CreateFeishuConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  appId!: string;

  @IsString()
  @IsNotEmpty()
  appSecret!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
