import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Role } from './role.entity';

@Entity('role_permissions')
@Unique(['roleId', 'resource', 'action'])
@Index(['roleId'])
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  roleId!: string;

  @ManyToOne(() => Role, (role) => role.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role!: Role;

  @Column({ length: 100 })
  resource!: string;

  @Column({ length: 100 })
  action!: string;
}
