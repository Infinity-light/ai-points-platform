import { Exclude, Expose } from 'class-transformer';
import { Role } from '../enums/role.enum';

@Exclude()
export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  tenantId!: string;

  @Expose()
  email!: string;

  @Expose()
  name!: string;

  @Expose()
  phone!: string | null;

  @Expose()
  role!: Role;

  @Expose()
  isEmailVerified!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
