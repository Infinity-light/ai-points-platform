import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsUUID('all')
  roleId!: string;
}

export class AssignProjectRoleDto {
  @IsUUID('all')
  projectId!: string;

  @IsUUID('all')
  roleId!: string;
}
