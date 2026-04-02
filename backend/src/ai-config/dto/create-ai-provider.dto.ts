import {
  IsString,
  IsIn,
  IsOptional,
  IsUrl,
  MaxLength,
  Length,
  IsObject,
} from 'class-validator';

export class CreateAiProviderDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsIn(['anthropic', 'openai', 'azure_openai', 'custom'])
  type!: 'anthropic' | 'openai' | 'azure_openai' | 'custom';

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateAiProviderKeyDto {
  @IsString()
  @Length(1, 100)
  label!: string;

  @IsString()
  @Length(1, 500)
  key!: string; // raw key value; stored as-is in encryptedKey field

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;
}
