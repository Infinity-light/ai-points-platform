import { IsString, IsOptional, IsDateString, Length } from 'class-validator';

export class CreateOpenApiKeyDto {
  @IsString()
  @Length(1, 100)
  label!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
