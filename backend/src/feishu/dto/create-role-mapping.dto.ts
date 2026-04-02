import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class CreateRoleMappingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  feishuRoleName!: string;

  @IsUUID()
  platformRoleId!: string;
}
