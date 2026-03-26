import { IsEnum } from 'class-validator';
import { Role } from '../../user/enums/role.enum';

export class UpdateRoleDto {
  @IsEnum(Role)
  role!: Role;
}
