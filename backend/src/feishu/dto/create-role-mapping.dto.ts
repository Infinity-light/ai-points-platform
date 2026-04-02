import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateRoleMappingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  feishuRoleName!: string;

  @Matches(UUID_PATTERN, { message: 'platformRoleId must be a valid UUID' })
  platformRoleId!: string;
}
