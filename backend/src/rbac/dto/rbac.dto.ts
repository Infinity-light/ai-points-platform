import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

// Relaxed UUID pattern: our system role IDs (00000000-0000-0000-0000-000000000001)
// have variant nibble 0 which fails strict RFC 4122 validation (@IsUUID).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['tenant', 'project'])
  scope!: 'tenant' | 'project';
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class PermissionItemDto {
  @IsString()
  resource!: string;

  @IsString()
  action!: string;
}

export class SetPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionItemDto)
  permissions!: PermissionItemDto[];
}

export class AssignTenantRoleDto {
  @Matches(UUID_PATTERN, { message: 'roleId must be a valid UUID' })
  roleId!: string;
}

export class AssignProjectRoleDto {
  @Matches(UUID_PATTERN, { message: 'projectId must be a valid UUID' })
  projectId!: string;

  @Matches(UUID_PATTERN, { message: 'roleId must be a valid UUID' })
  roleId!: string;
}
